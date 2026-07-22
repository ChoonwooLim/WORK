'use strict';

// Tests for services/cronRules.js (Task 3.3) — pure cron parsing/matching only.
//
// Pins:
//   1. 5-필드 파서: *, 숫자, 범위, 스텝(*/n, a-b/n), 리스트, 혼합 리스트
//   2. invalid: 6/4 필드, 범위 밖 값, 쓰레기 토큰, 빈 문자열, */0, 역방향 범위
//   3. cronMatches: 분/시 정확 매칭, month 경계, dow 0·7=일요일
//   4. dom/dow 규칙 (Vixie): 둘 다 restricted → OR, 한쪽만 → AND,
//      '*' 로 시작하는 필드('*/2' 포함)는 unrestricted (star-bit)
//   5. nextRunAfter: 같은 시간 내, 다음 날 롤오버, 비윤년 2/29 스킵,
//      dom/dow OR, 불가능 일자(2/30) → null, strictly-after 경계
//   6. validateJobInput 매트릭스 (name 패턴 / schedule / command 길이)
//
// 시간 기준: cronRules 는 서버 로컬 시간 — 테스트도 로컬 Date 생성자를 써서
// 어떤 TZ 에서 돌려도 결정적이다.

const test = require('node:test');
const assert = require('node:assert');

const rules = require('../services/cronRules');
const { parseCronExpression, cronMatches, nextRunAfter, validateJobInput } = rules;

function setOf(parsed, key) {
    return [...parsed[key]].sort((a, b) => a - b);
}

// ── 1. Parser: each field type ──────────────────────────────────────────────

test('parse: all-star → full sets, dom/dow unrestricted', () => {
    const p = parseCronExpression('* * * * *');
    assert.ok(p);
    assert.strictEqual(p.minute.size, 60);
    assert.strictEqual(p.hour.size, 24);
    assert.strictEqual(p.dom.size, 31);
    assert.strictEqual(p.month.size, 12);
    assert.strictEqual(p.dow.size, 7);
    assert.strictEqual(p.domRestricted, false);
    assert.strictEqual(p.dowRestricted, false);
});

test('parse: plain numbers in every field', () => {
    const p = parseCronExpression('5 3 14 6 2');
    assert.ok(p);
    assert.deepStrictEqual(setOf(p, 'minute'), [5]);
    assert.deepStrictEqual(setOf(p, 'hour'), [3]);
    assert.deepStrictEqual(setOf(p, 'dom'), [14]);
    assert.deepStrictEqual(setOf(p, 'month'), [6]);
    assert.deepStrictEqual(setOf(p, 'dow'), [2]);
    assert.strictEqual(p.domRestricted, true);
    assert.strictEqual(p.dowRestricted, true);
});

test('parse: ranges (1-5)', () => {
    const p = parseCronExpression('1-5 0-2 10-12 11-12 1-3');
    assert.ok(p);
    assert.deepStrictEqual(setOf(p, 'minute'), [1, 2, 3, 4, 5]);
    assert.deepStrictEqual(setOf(p, 'hour'), [0, 1, 2]);
    assert.deepStrictEqual(setOf(p, 'dom'), [10, 11, 12]);
    assert.deepStrictEqual(setOf(p, 'month'), [11, 12]);
    assert.deepStrictEqual(setOf(p, 'dow'), [1, 2, 3]);
});

test('parse: star-step (*/15) and hour range-step (1-20/5)', () => {
    const p = parseCronExpression('*/15 1-20/5 * * *');
    assert.ok(p);
    assert.deepStrictEqual(setOf(p, 'minute'), [0, 15, 30, 45]);
    assert.deepStrictEqual(setOf(p, 'hour'), [1, 6, 11, 16]);
});

test('parse: range-step within bounds', () => {
    const p = parseCronExpression('1-30/5 * * * *');
    assert.ok(p);
    assert.deepStrictEqual(setOf(p, 'minute'), [1, 6, 11, 16, 21, 26]);
});

test('parse: value-step (5/15) = Vixie 5-max/15 extension', () => {
    const p = parseCronExpression('5/15 * * * *');
    assert.ok(p);
    assert.deepStrictEqual(setOf(p, 'minute'), [5, 20, 35, 50]);
});

test('parse: lists (1,15,30) and mixed list (1-3,10,20-40/10)', () => {
    const p1 = parseCronExpression('1,15,30 * * * *');
    assert.ok(p1);
    assert.deepStrictEqual(setOf(p1, 'minute'), [1, 15, 30]);

    const p2 = parseCronExpression('1-3,10,20-40/10 * * * *');
    assert.ok(p2);
    assert.deepStrictEqual(setOf(p2, 'minute'), [1, 2, 3, 10, 20, 30, 40]);
});

test('parse: dow 7 normalized to 0 (both mean Sunday), also inside ranges', () => {
    const p = parseCronExpression('0 0 * * 7');
    assert.ok(p);
    assert.deepStrictEqual(setOf(p, 'dow'), [0]);

    const p2 = parseCronExpression('0 0 * * 5-7');
    assert.ok(p2);
    assert.deepStrictEqual(setOf(p2, 'dow'), [0, 5, 6]);
});

test('parse: whitespace tolerated around/between fields', () => {
    assert.ok(parseCronExpression('  */5   *  *  *  *  '));
});

// ── 2. Parser: invalid inputs ───────────────────────────────────────────────

test('parse invalid: wrong field count (4 and 6 fields)', () => {
    assert.strictEqual(parseCronExpression('* * * *'), null);
    assert.strictEqual(parseCronExpression('* * * * * *'), null);
});

test('parse invalid: out-of-range values per field', () => {
    assert.strictEqual(parseCronExpression('60 * * * *'), null);  // minute > 59
    assert.strictEqual(parseCronExpression('* 24 * * *'), null);  // hour > 23
    assert.strictEqual(parseCronExpression('* * 0 * *'), null);   // dom < 1
    assert.strictEqual(parseCronExpression('* * 32 * *'), null);  // dom > 31
    assert.strictEqual(parseCronExpression('* * * 0 *'), null);   // month < 1
    assert.strictEqual(parseCronExpression('* * * 13 *'), null);  // month > 12
    assert.strictEqual(parseCronExpression('* * * * 8'), null);   // dow > 7
    assert.strictEqual(parseCronExpression('1-60 * * * *'), null); // range end out of bounds
});

test('parse invalid: garbage / empty / non-string', () => {
    assert.strictEqual(parseCronExpression(''), null);
    assert.strictEqual(parseCronExpression('   '), null);
    assert.strictEqual(parseCronExpression('hello world foo bar baz'), null);
    assert.strictEqual(parseCronExpression('*a * * * *'), null);
    assert.strictEqual(parseCronExpression('1--5 * * * *'), null);
    assert.strictEqual(parseCronExpression('1,,5 * * * *'), null);
    assert.strictEqual(parseCronExpression('-5 * * * *'), null);
    assert.strictEqual(parseCronExpression(null), null);
    assert.strictEqual(parseCronExpression(undefined), null);
    assert.strictEqual(parseCronExpression(42), null);
});

test('parse invalid: zero/garbage step and reversed range', () => {
    assert.strictEqual(parseCronExpression('*/0 * * * *'), null);
    assert.strictEqual(parseCronExpression('*/x * * * *'), null);
    assert.strictEqual(parseCronExpression('1-5/ * * * *'), null);
    assert.strictEqual(parseCronExpression('50-10 * * * *'), null); // wrap 미지원
});

// ── 3. cronMatches: exact matches and boundaries ────────────────────────────
// 로컬 Date 생성자 → TZ 무관 결정적. 2026-07-22 은 수요일(dow 3).

test('cronMatches: exact minute/hour match and miss', () => {
    const p = parseCronExpression('30 10 * * *');
    assert.strictEqual(cronMatches(p, new Date(2026, 6, 22, 10, 30)), true);
    assert.strictEqual(cronMatches(p, new Date(2026, 6, 22, 10, 31)), false);
    assert.strictEqual(cronMatches(p, new Date(2026, 6, 22, 11, 30)), false);
});

test('cronMatches: */15 minutes', () => {
    const p = parseCronExpression('*/15 * * * *');
    assert.strictEqual(cronMatches(p, new Date(2026, 6, 22, 9, 0)), true);
    assert.strictEqual(cronMatches(p, new Date(2026, 6, 22, 9, 45)), true);
    assert.strictEqual(cronMatches(p, new Date(2026, 6, 22, 9, 7)), false);
});

test('cronMatches: month boundaries (12 matches December, 1 January)', () => {
    const p = parseCronExpression('0 0 * 12 *');
    assert.strictEqual(cronMatches(p, new Date(2026, 11, 15, 0, 0)), true);  // Dec
    assert.strictEqual(cronMatches(p, new Date(2026, 0, 15, 0, 0)), false);  // Jan
    const p2 = parseCronExpression('0 0 * 1 *');
    assert.strictEqual(cronMatches(p2, new Date(2026, 0, 15, 0, 0)), true);
});

test('cronMatches: dow 0 and 7 both hit Sunday', () => {
    // 2026-07-26 은 일요일
    const sunday = new Date(2026, 6, 26, 0, 0);
    assert.strictEqual(sunday.getDay(), 0);
    assert.strictEqual(cronMatches(parseCronExpression('0 0 * * 0'), sunday), true);
    assert.strictEqual(cronMatches(parseCronExpression('0 0 * * 7'), sunday), true);
});

// ── 4. dom/dow OR rule (Vixie semantics, concrete dates) ────────────────────

test('dom/dow: BOTH restricted → OR (13th OR Friday)', () => {
    const p = parseCronExpression('0 0 13 * 5');
    // 2026-02-13 = 금요일 13일 (둘 다 매칭)
    const fri13 = new Date(2026, 1, 13, 0, 0);
    assert.strictEqual(fri13.getDay(), 5);
    assert.strictEqual(cronMatches(p, fri13), true);
    // 2026-03-06 = 금요일이지만 6일 (dow 만 매칭 → OR 로 실행)
    const fri6 = new Date(2026, 2, 6, 0, 0);
    assert.strictEqual(fri6.getDay(), 5);
    assert.strictEqual(cronMatches(p, fri6), true);
    // 2026-04-13 = 월요일 13일 (dom 만 매칭 → OR 로 실행)
    const mon13 = new Date(2026, 3, 13, 0, 0);
    assert.strictEqual(mon13.getDay(), 1);
    assert.strictEqual(cronMatches(p, mon13), true);
    // 2026-02-14 = 토요일 14일 (둘 다 미스)
    const sat14 = new Date(2026, 1, 14, 0, 0);
    assert.strictEqual(cronMatches(p, sat14), false);
});

test('dom/dow: only dom restricted → AND semantics (dow * always true)', () => {
    const p = parseCronExpression('0 0 13 * *');
    assert.strictEqual(cronMatches(p, new Date(2026, 3, 13, 0, 0)), true);  // 아무 요일이든 13일
    assert.strictEqual(cronMatches(p, new Date(2026, 2, 6, 0, 0)), false);  // 금요일이어도 6일은 미스
});

test('dom/dow: only dow restricted → AND semantics (dom * always true)', () => {
    const p = parseCronExpression('0 0 * * 5');
    assert.strictEqual(cronMatches(p, new Date(2026, 2, 6, 0, 0)), true);   // 금요일
    assert.strictEqual(cronMatches(p, new Date(2026, 3, 13, 0, 0)), false); // 월요일 13일 미스
});

test('dom/dow: */2 dom counts as UNRESTRICTED (Vixie star-bit) → AND with dow', () => {
    const p = parseCronExpression('0 0 */2 * 1');
    assert.strictEqual(p.domRestricted, false);
    assert.strictEqual(p.dowRestricted, true);
    // 2026-07-27 = 홀수일(27) 월요일 → dom */2(1,3,...31) hit + dow hit → 실행
    const mon27 = new Date(2026, 6, 27, 0, 0);
    assert.strictEqual(mon27.getDay(), 1);
    assert.strictEqual(cronMatches(p, mon27), true);
    // 2026-07-20 = 짝수일(20) 월요일 → dom 미스 → AND 라서 실행 안 됨
    const mon20 = new Date(2026, 6, 20, 0, 0);
    assert.strictEqual(mon20.getDay(), 1);
    assert.strictEqual(cronMatches(p, mon20), false);
    // 2026-07-21 = 홀수일(21) 화요일 → dow 미스 → 실행 안 됨 (OR 였다면 실행됐을 것)
    assert.strictEqual(cronMatches(p, new Date(2026, 6, 21, 0, 0)), false);
});

// ── 5. nextRunAfter ─────────────────────────────────────────────────────────

test('nextRunAfter: within the same hour (*/15 from 10:07 → 10:15)', () => {
    const p = parseCronExpression('*/15 * * * *');
    const next = nextRunAfter(p, new Date(2026, 6, 22, 10, 7, 12));
    assert.deepStrictEqual(next, new Date(2026, 6, 22, 10, 15, 0, 0));
});

test('nextRunAfter: strictly after — an exact-hit "from" returns the NEXT occurrence', () => {
    const p = parseCronExpression('*/15 * * * *');
    const next = nextRunAfter(p, new Date(2026, 6, 22, 10, 15, 0, 0));
    assert.deepStrictEqual(next, new Date(2026, 6, 22, 10, 30, 0, 0));
});

test('nextRunAfter: next-day rollover (daily 09:30 from 10:00 → tomorrow 09:30)', () => {
    const p = parseCronExpression('30 9 * * *');
    const next = nextRunAfter(p, new Date(2026, 6, 22, 10, 0));
    assert.deepStrictEqual(next, new Date(2026, 6, 23, 9, 30, 0, 0));
});

test('nextRunAfter: Feb-29 skips non-leap years (from 2026 → 2028-02-29)', () => {
    const p = parseCronExpression('0 0 29 2 *');
    const next = nextRunAfter(p, new Date(2026, 0, 1, 0, 0));
    assert.deepStrictEqual(next, new Date(2028, 1, 29, 0, 0, 0, 0));
});

test('nextRunAfter: Feb-29 across the 2100 century non-leap gap (2097 → 2104)', () => {
    // 2100 은 100 의 배수이되 400 의 배수가 아니라 비윤년 — 2096 다음 2/29 는
    // 2104 (8년 간격). 4년 탐색 상한이었다면 null 이 됐을 회귀 케이스.
    const p = parseCronExpression('0 0 29 2 *');
    const next = nextRunAfter(p, new Date(2097, 0, 1, 0, 0));
    assert.deepStrictEqual(next, new Date(2104, 1, 29, 0, 0, 0, 0));
});

test('nextRunAfter: impossible date (Feb 30) → null', () => {
    const p = parseCronExpression('0 0 30 2 *');
    assert.strictEqual(nextRunAfter(p, new Date(2026, 0, 1)), null);
});

test('nextRunAfter: dom/dow OR — from Feb 14 the next hit is the next Friday, not next 13th', () => {
    const p = parseCronExpression('0 0 13 * 5');
    // 2026-02-14(토) 이후 → 2026-02-20(금) 이 3/13 보다 먼저
    const next = nextRunAfter(p, new Date(2026, 1, 14, 0, 0));
    assert.deepStrictEqual(next, new Date(2026, 1, 20, 0, 0, 0, 0));
    assert.strictEqual(next.getDay(), 5);
});

test('nextRunAfter: month rollover picks first matching day of target month', () => {
    const p = parseCronExpression('0 12 1 12 *'); // Dec 1st 12:00
    const next = nextRunAfter(p, new Date(2026, 6, 22, 10, 0));
    assert.deepStrictEqual(next, new Date(2026, 11, 1, 12, 0, 0, 0));
});

test('nextRunAfter: invalid inputs → null', () => {
    assert.strictEqual(nextRunAfter(null, new Date()), null);
    const p = parseCronExpression('* * * * *');
    assert.strictEqual(nextRunAfter(p, new Date(NaN)), null);
    assert.strictEqual(nextRunAfter(p, 'not-a-date'), null);
});

// ── 6. validateJobInput ─────────────────────────────────────────────────────

const VALID_INPUT = { name: 'db-backup', schedule: '*/15 * * * *', command: 'pg_dump mydb' };

test('validateJobInput: valid input passes', () => {
    assert.deepStrictEqual(validateJobInput(VALID_INPUT), { ok: true });
    assert.deepStrictEqual(validateJobInput({ name: 'A1', schedule: '0 0 * * *', command: 'x' }), { ok: true });
    assert.deepStrictEqual(validateJobInput({ name: 'a'.repeat(100), schedule: '* * * * *', command: 'x' }), { ok: true });
});

test('validateJobInput: bad names rejected', () => {
    for (const name of ['', ' ', '-lead', '.lead', 'has space', 'semi;colon', 'a'.repeat(101), null, undefined, 7]) {
        const r = validateJobInput({ ...VALID_INPUT, name });
        assert.strictEqual(r.ok, false, `name ${JSON.stringify(name)} should fail`);
        assert.match(r.error, /name/);
    }
});

test('validateJobInput: bad schedules rejected', () => {
    for (const schedule of ['', '* * * *', '*/0 * * * *', 'sixty * * * *', null, 5]) {
        const r = validateJobInput({ ...VALID_INPUT, schedule });
        assert.strictEqual(r.ok, false, `schedule ${JSON.stringify(schedule)} should fail`);
        assert.match(r.error, /schedule/);
    }
});

test('validateJobInput: bad commands rejected (empty, whitespace-only, >2000 chars)', () => {
    for (const command of ['', '   ', 'x'.repeat(2001), null, 42]) {
        const r = validateJobInput({ ...VALID_INPUT, command });
        assert.strictEqual(r.ok, false, `command ${JSON.stringify(command).slice(0, 30)} should fail`);
        assert.match(r.error, /command/);
    }
    // 정확히 2000자는 통과
    assert.deepStrictEqual(validateJobInput({ ...VALID_INPUT, command: 'x'.repeat(2000) }), { ok: true });
});

test('validateJobInput: missing object → name error first', () => {
    assert.strictEqual(validateJobInput().ok, false);
    assert.strictEqual(validateJobInput({}).ok, false);
});
