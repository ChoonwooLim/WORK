'use strict';

// ── Task 3.3: 예약 작업(cron) — 순수 판정 로직 ──────────────────────────────
// services/cron.js(CronRunner) / routes/cron.js / 대시보드가 쓰는 5-필드
// cron 파서·매칭·검증을 부수효과 없이 모아둔 모듈
// (previewRules.js / rollbackRules.js 패턴 — test/cronRules.test.js 가 핀).
//
// 지원 문법 (필드당): `*`, 숫자, 범위(1-5), 스텝(*/15, 1-30/5), 리스트(1,15,30)
// 및 이들의 조합 (예: `1-5,10,20-40/10`). 지원하지 않는 것 (의도된 제한):
// 이름(mon/jan), 역방향 랩 범위(50-10), @reboot 류 매크로, 초 필드(6-필드).
//
// 시간 기준: 모든 매칭/next-run 계산은 **서버 로컬 시간** (Date 의 로컬
// getter). 표준 cron 데몬과 동일한 의미론.
//
// dom/dow 규칙 (Vixie/Debian cron 표준을 그대로 핀):
//   "둘 다 제한(restricted)" — 즉 두 필드 모두 '*' 문자로 시작하지 않으면 —
//   OR 로 결합한다 (예: `0 0 13 * 5` = 매달 13일 **또는** 매주 금요일).
//   한쪽이라도 '*' 로 시작하면 (`*` 는 물론 `*/2` 도 포함 — Vixie 의
//   star-bit 동작) AND 결합이다. restricted 판정은 "필드가 '*' 로 시작하는가"
//   문자열 기준 — 값 집합이 전체와 같아지는 `0-59` 같은 표현은 restricted 다.

const MAX_COMMAND_LENGTH = 2000;
const MAX_JOBS_PER_PROJECT = 10;
// nextRunAfter 탐색 상한: 윤년 2/29 (`0 0 29 2 *`) 의 최악 간격은 4년이 아니라
// 세기 비윤년(2100 등, 100 의 배수이되 400 의 배수가 아닌 해) 주변의 8년이다
// (예: 2096 다음 2/29 는 2104). 8년 + 이틀 안에 없으면 (2/30 등 불가능 일자) null.
const NEXT_RUN_SEARCH_DAYS = 8 * 366 + 2;

const FIELD_SPECS = [
    { key: 'minute', min: 0, max: 59 },
    { key: 'hour', min: 0, max: 23 },
    { key: 'dom', min: 1, max: 31 },
    { key: 'month', min: 1, max: 12 },
    { key: 'dow', min: 0, max: 7 }, // 0 과 7 모두 일요일 (7 은 0 으로 정규화)
];

// 필드 하나 → Set<number> | null(invalid). 리스트 항목마다:
//   '*'            → min..max 전체
//   '*/s'          → min..max 를 s 스텝으로
//   'a'            → 단일 값
//   'a-b'          → 범위 (a<=b 만 — 랩 없음)
//   'a-b/s'        → 범위 스텝
function parseField(field, min, max, isDow) {
    if (typeof field !== 'string' || field.length === 0) return null;
    const out = new Set();
    for (const item of field.split(',')) {
        if (item.length === 0) return null; // '1,,5' 같은 빈 항목
        let rangePart = item;
        let step = 1;
        const slash = item.indexOf('/');
        if (slash !== -1) {
            rangePart = item.slice(0, slash);
            const stepStr = item.slice(slash + 1);
            if (!/^\d+$/.test(stepStr)) return null;
            step = parseInt(stepStr, 10);
            if (step < 1) return null; // '*/0' 등
        }

        let lo;
        let hi;
        if (rangePart === '*') {
            lo = min;
            hi = max;
        } else if (/^\d+$/.test(rangePart)) {
            lo = hi = parseInt(rangePart, 10);
            if (slash !== -1) hi = max; // Vixie: '5/15' = 5-max/15
        } else {
            const m = rangePart.match(/^(\d+)-(\d+)$/);
            if (!m) return null;
            lo = parseInt(m[1], 10);
            hi = parseInt(m[2], 10);
            if (lo > hi) return null; // 역방향 랩 범위 미지원
        }
        if (lo < min || hi > max) return null;

        for (let v = lo; v <= hi; v += step) {
            out.add(isDow && v === 7 ? 0 : v); // dow 7 → 0 (둘 다 일요일)
        }
    }
    return out.size > 0 ? out : null;
}

/**
 * 5-필드 cron 표현식 파싱.
 * @returns {{minute:Set,hour:Set,dom:Set,month:Set,dow:Set,
 *            domRestricted:boolean,dowRestricted:boolean}|null} invalid 면 null
 */
function parseCronExpression(expr) {
    if (typeof expr !== 'string') return null;
    const fields = expr.trim().split(/\s+/);
    if (fields.length !== 5) return null;

    const parsed = {};
    for (let i = 0; i < 5; i++) {
        const spec = FIELD_SPECS[i];
        const set = parseField(fields[i], spec.min, spec.max, spec.key === 'dow');
        if (!set) return null;
        parsed[spec.key] = set;
    }
    // Vixie star-bit: '*' 로 시작하는 필드('*', '*/2')는 dom/dow OR 규칙에서
    // unrestricted 로 취급 (모듈 헤더 주석 참고).
    parsed.domRestricted = !fields[2].startsWith('*');
    parsed.dowRestricted = !fields[4].startsWith('*');
    return parsed;
}

/**
 * 해당 Date(로컬 시간)의 분(minute)에 이 표현식이 실행돼야 하는가.
 * dom/dow: 둘 다 restricted → OR, 아니면 AND (unrestricted 집합은 전체라
 * AND 항으로 넣어도 무해 — 표준 의미론과 일치).
 */
function cronMatches(parsed, date) {
    if (!parsed || !(date instanceof Date) || Number.isNaN(date.getTime())) return false;
    if (!parsed.minute.has(date.getMinutes())) return false;
    if (!parsed.hour.has(date.getHours())) return false;
    if (!parsed.month.has(date.getMonth() + 1)) return false;

    const domHit = parsed.dom.has(date.getDate());
    const dowHit = parsed.dow.has(date.getDay());
    if (parsed.domRestricted && parsed.dowRestricted) return domHit || dowHit;
    return domHit && dowHit;
}

// cronMatches 의 "일자 부분"만 — nextRunAfter 의 일 단위 스킵용
function dayMatches(parsed, date) {
    if (!parsed.month.has(date.getMonth() + 1)) return false;
    const domHit = parsed.dom.has(date.getDate());
    const dowHit = parsed.dow.has(date.getDay());
    if (parsed.domRestricted && parsed.dowRestricted) return domHit || dowHit;
    return domHit && dowHit;
}

/**
 * from(Date) **이후 첫** 실행 시각(Date) — from 자신은 제외 (strictly after).
 * 일→시→분 순으로 건너뛰며 탐색; 4년+이틀 안에 없으면 null (불가능 일자).
 * UI 의 "다음 실행" 표시용 (routes/cron.js 가 목록 응답에 실어 보냄).
 */
function nextRunAfter(parsed, from) {
    if (!parsed || !(from instanceof Date) || Number.isNaN(from.getTime())) return null;

    // 다음 분 경계로 절상 (초/밀리초 버림 후 +1분)
    let t = new Date(from.getTime());
    t.setSeconds(0, 0);
    t = new Date(t.getTime() + 60 * 1000);

    const limit = new Date(from.getTime() + NEXT_RUN_SEARCH_DAYS * 24 * 60 * 60 * 1000);
    while (t <= limit) {
        if (!dayMatches(parsed, t)) {
            // 다음 날 00:00 으로 점프 (DST 는 로컬 Date 산술이 흡수)
            t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 0, 0);
            continue;
        }
        if (!parsed.hour.has(t.getHours())) {
            t = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours() + 1, 0, 0, 0);
            continue;
        }
        if (parsed.minute.has(t.getMinutes())) return t;
        t = new Date(t.getTime() + 60 * 1000);
    }
    return null;
}

// 작업 이름: 영숫자로 시작, 이후 영숫자/._- 만, 최대 100자 (DB varchar(100))
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * 작업 생성/수정 입력 검증 → { ok } | { ok:false, error }.
 * 명령 실행 로직은 여기 없다 — 순수 검증만.
 */
function validateJobInput({ name, schedule, command } = {}) {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
        return { ok: false, error: 'name: 영숫자로 시작하는 1~100자 (영숫자/._-)만 허용됩니다. / name must be 1-100 chars, alphanumeric plus ._- and start alphanumeric.' };
    }
    if (typeof schedule !== 'string' || !parseCronExpression(schedule)) {
        return { ok: false, error: 'schedule: 5-필드 cron 표현식이 아닙니다 (예: */15 * * * *). / schedule is not a valid 5-field cron expression.' };
    }
    if (typeof command !== 'string' || command.trim().length === 0) {
        return { ok: false, error: 'command: 비어 있을 수 없습니다. / command must not be empty.' };
    }
    if (command.length > MAX_COMMAND_LENGTH) {
        return { ok: false, error: `command: 최대 ${MAX_COMMAND_LENGTH}자입니다. / command must be at most ${MAX_COMMAND_LENGTH} chars.` };
    }
    return { ok: true };
}

module.exports = {
    parseCronExpression,
    cronMatches,
    nextRunAfter,
    validateJobInput,
    MAX_COMMAND_LENGTH,
    MAX_JOBS_PER_PROJECT,
};
