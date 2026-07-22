'use strict';

// HTTP 스모크 체크 (Task 4.2) — nginx 전환 직전, 새 컨테이너의 앱-레벨 생존 확인.
//
// 배경: 배포 흐름은 컨테이너가 포트를 LISTEN 하는지(프로세스 준비)만 확인한 뒤
// nginx 를 새 컨테이너로 전환한다. 포트는 열었지만 모든 요청에 5xx 를 뱉는
// 앱(예: 부팅 직후 미설정 DB 연결로 전 요청 크래시)도 그대로 전환되어 즉시
// 장애가 된다. 이 모듈은 전환 전에 실제 HTTP 응답을 확인한다.
//
// 판정 규칙 (deployer Feature 7 / monitor.js 의 관례와 정렬):
//   PASS = status < 500 인 어떤 HTTP 응답. 4xx/3xx 포함 — 404 는 "앱이 살아서
//          라우팅했다"는 뜻이므로 API 루트가 404 여도 배포를 막으면 안 된다.
//   FAIL = 5xx 응답 또는 네트워크 오류(연결 거부/타임아웃)가 retries 회
//          모두 지속되는 경우.
//
// retries 는 "총 시도 횟수" (기본 5회, 간격 2초 → 마지막 시도 후 대기 없음
// = 대기 4회 × 2초 + 요청 시간 ≈ 기존 포트 대기 이후 ~10초 추가 예산).
//
// 순수 모듈: 외부 서비스/DB 의존 없음. checkHttp/sleep 주입 가능
// (monitor.js 의 테스트 주입 관례) — 테스트는 실제 네트워크/타이머 없이 돈다.
// resolveHealthPath 는 이미 파싱된 orbitron.yaml 객체를 받는다 (js-yaml 은
// deployer 쪽 책임 — 테스트 환경엔 node_modules 가 없을 수 있음).

const SMOKE_DEFAULTS = {
    timeoutMs: 3000,   // 시도당 HTTP 타임아웃
    retries: 5,        // 총 시도 횟수
    intervalMs: 2000,  // 시도 간 대기
};

const HEALTH_PATH_DEFAULT = '/';

// 기본 프로브 — monitor.js defaultCheckHttp 와 동일 패턴 (fetch +
// AbortSignal.timeout + redirect manual + 본문 즉시 폐기로 소켓 누수 방지).
async function defaultCheckHttp(url, { timeoutMs = SMOKE_DEFAULTS.timeoutMs } = {}) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'manual',
    });
    try { if (res.body) await res.body.cancel(); } catch { /* ignore */ }
    return { status: res.status };
}

function defaultSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// GET http://<host>:<port><path> 를 최대 retries 회 시도 (host 기본 127.0.0.1).
// 배포 스모크 체크는 host = 컨테이너 IP, port = /proc/net/tcp 로 감지된 실제
// 리슨 포트를 넘긴다 (nginx 가 프록시할 대상과 정확히 동일한 타깃 —
// host-mapped 포트는 PORT env 를 무시하는 하드코딩 앱에서 도달 불가하므로
// 프로브 대상이 아니다).
// 반환: { ok, lastStatus, lastError, attempts }
//   - lastStatus: 마지막으로 받은 HTTP status (응답이 한 번도 없었으면 null)
//   - lastError:  마지막 네트워크 오류 메시지 (없으면 null) — 성공 시에도
//                 이전 시도의 오류를 참고용으로 보존한다
//   - attempts:   실제 시도 횟수 (성공 시 그 시점까지)
// onAttempt({ attempt, total, status, error, url }) 는 진행 로그용 훅 —
// 콜백의 예외가 체크 자체를 깨지 않도록 격리한다.
async function smokeCheck(port, path = HEALTH_PATH_DEFAULT, options = {}) {
    const {
        host = '127.0.0.1',
        timeoutMs = SMOKE_DEFAULTS.timeoutMs,
        retries = SMOKE_DEFAULTS.retries,
        intervalMs = SMOKE_DEFAULTS.intervalMs,
        checkHttp = defaultCheckHttp,
        sleep = defaultSleep,
        onAttempt = null,
    } = options;

    const url = `http://${host}:${port}${path}`;
    const total = Math.max(1, retries);
    let lastStatus = null;
    let lastError = null;

    for (let attempt = 1; attempt <= total; attempt++) {
        let status = null;
        let error = null;
        try {
            const res = await checkHttp(url, { timeoutMs });
            if (res && typeof res.status === 'number') {
                status = res.status;
            } else {
                error = `checkHttp returned no numeric status (got ${JSON.stringify(res)})`;
            }
        } catch (e) {
            error = e && e.message ? e.message : String(e);
        }

        if (status !== null) lastStatus = status;
        if (error !== null) lastError = error;

        if (onAttempt) {
            try { onAttempt({ attempt, total, status, error, url }); } catch { /* 로깅 실패 무시 */ }
        }

        if (status !== null && status < 500) {
            return { ok: true, lastStatus, lastError, attempts: attempt };
        }
        if (attempt < total) await sleep(intervalMs);
    }

    return { ok: false, lastStatus, lastError, attempts: total };
}

// orbitron.yaml (이미 파싱된 객체) 에서 health_path 를 해석한다.
// 지원 위치 (기존 스키마 관례와 정렬 — deployer 의 yaml 접근 방식 참고):
//   1. services.web.health_path  — 기존 services.web.{build_command,port,...}
//                                  오버라이드 블록과 같은 자리 (최우선)
//   2. health.path               — 중첩형
//   3. health_path               — 최상위 (postDeploy 처럼 top-level 키)
// 검증: '/' 로 시작 + 공백 없음. 위반 시 경고 문자열과 함께 기본값 '/' 반환.
// 반환: { path, warning } — warning 은 없으면 null.
function resolveHealthPath(doc) {
    let raw;
    if (doc && typeof doc === 'object') {
        const web = doc.services && doc.services.web;
        if (web && web.health_path !== undefined) {
            raw = web.health_path;
        } else if (doc.health && typeof doc.health === 'object' && doc.health.path !== undefined) {
            raw = doc.health.path;
        } else {
            raw = doc.health_path;
        }
    }

    if (raw === undefined || raw === null) {
        return { path: HEALTH_PATH_DEFAULT, warning: null };
    }

    const value = String(raw);
    if (!value.startsWith('/') || /\s/.test(value)) {
        return {
            path: HEALTH_PATH_DEFAULT,
            warning: `⚠️ 잘못된 health_path "${value}" — '/'로 시작하고 공백이 없어야 합니다. 기본값 '/' 사용. / Invalid health_path — must start with '/' and contain no spaces; using default '/'.`,
        };
    }
    return { path: value, warning: null };
}

module.exports = {
    smokeCheck,
    resolveHealthPath,
    defaultCheckHttp,
    SMOKE_DEFAULTS,
    HEALTH_PATH_DEFAULT,
};
