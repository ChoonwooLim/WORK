'use strict';

// Tests for services/smokeCheck.js — 배포 스모크 체크 (Task 4.2)
//
// Pins:
//   1. PASS 판정 = status < 500 인 어떤 HTTP 응답 (200/404/302 각각 핀)
//      — API 루트가 404 를 돌려줘도 앱은 살아있는 것: 배포를 막으면 안 됨
//   2. 5xx 는 FAIL — retries(기본 5) 회 전부 소진 후 {ok:false} (시도 횟수 핀)
//   3. 네트워크 오류는 재시도 대상 — 중간 실패 후 성공하면 {ok:true}
//   4. timeoutMs 가 checkHttp 에 그대로 전달됨 (기본값 포함) — 실제 타이머 없음
//   5. 재시도 간격 = intervalMs, sleep 호출 횟수 = 시도 횟수 - 1 (주입 sleep)
//   6. 결과 형태: { ok, lastStatus, lastError, attempts }
//   7. URL = http://127.0.0.1:<port><path>
//   8. onAttempt 진행 콜백 — 호출 내용 + 콜백 throw 가 체크를 깨지 않음
//   9. resolveHealthPath: 유효/무효('/'미시작·공백)→기본값+정확한 경고,
//      미지정→기본값·경고 없음, health_path / health.path / services.web 우선순위
//
// 실제 네트워크/타이머 없음 — checkHttp/sleep 전부 주입.

const test = require('node:test');
const assert = require('node:assert');

const {
    smokeCheck,
    resolveHealthPath,
    HEALTH_PATH_DEFAULT,
    SMOKE_DEFAULTS,
} = require('../services/smokeCheck');

// 스크립트 가능한 fake — results[i] 가 i번째 시도의 결과:
// number → HTTP status 응답, 'err' → 네트워크 오류 throw
function harness(results) {
    const h = { calls: [], sleeps: [] };
    h.opts = {
        checkHttp: async (url, opts) => {
            h.calls.push({ url, opts });
            const r = results[Math.min(h.calls.length - 1, results.length - 1)];
            if (r === 'err') throw new Error('ECONNREFUSED 127.0.0.1');
            return { status: r };
        },
        sleep: async (ms) => { h.sleeps.push(ms); },
    };
    return h;
}

test('기본값 계약: retries=5, intervalMs=2000 (총 예산 ~10초)', () => {
    assert.strictEqual(SMOKE_DEFAULTS.retries, 5);
    assert.strictEqual(SMOKE_DEFAULTS.intervalMs, 2000);
    assert.ok(SMOKE_DEFAULTS.timeoutMs >= 1000, 'timeoutMs 는 최소 1초 이상');
});

test('200 응답 → 즉시 통과 (1회 시도)', async () => {
    const h = harness([200]);
    const res = await smokeCheck(3100, '/', h.opts);
    assert.deepStrictEqual(res, { ok: true, lastStatus: 200, lastError: null, attempts: 1 });
    assert.strictEqual(h.calls.length, 1);
    assert.strictEqual(h.sleeps.length, 0, '성공 시 대기 없음');
});

test('404 응답 → 통과 (앱이 살아서 라우팅 중 — 4xx 는 배포를 막지 않는다)', async () => {
    const h = harness([404]);
    const res = await smokeCheck(3100, '/api', h.opts);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.lastStatus, 404);
    assert.strictEqual(res.attempts, 1);
});

test('302 리다이렉트 → 통과', async () => {
    const h = harness([302]);
    const res = await smokeCheck(3100, '/', h.opts);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.lastStatus, 302);
});

test('499 는 통과, 500 은 실패 (경계값)', async () => {
    const ok = await smokeCheck(3100, '/', harness([499]).opts);
    assert.strictEqual(ok.ok, true);

    const h = harness([500]);
    const bad = await smokeCheck(3100, '/', h.opts);
    assert.strictEqual(bad.ok, false);
    assert.strictEqual(bad.lastStatus, 500);
});

test('연속 500 → 기본 5회 시도 전부 소진 후 실패 (시도 횟수 핀)', async () => {
    const h = harness([500]);
    const res = await smokeCheck(3100, '/', h.opts);
    assert.deepStrictEqual(res, { ok: false, lastStatus: 500, lastError: null, attempts: 5 });
    assert.strictEqual(h.calls.length, 5, '기본 retries=5 → 정확히 5회 시도');
    assert.strictEqual(h.sleeps.length, 4, '마지막 시도 후에는 대기하지 않음');
    assert.ok(h.sleeps.every(ms => ms === 2000), '재시도 간격은 intervalMs(기본 2000ms)');
});

test('네트워크 오류 2회 후 200 → 통과 (오류는 재시도 대상)', async () => {
    const h = harness(['err', 'err', 200]);
    const res = await smokeCheck(3100, '/', h.opts);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.lastStatus, 200);
    assert.strictEqual(res.attempts, 3);
    // 이전 시도의 네트워크 오류는 참고용으로 보존된다
    assert.match(res.lastError, /ECONNREFUSED/);
});

test('네트워크 오류만 지속 → 실패, lastStatus 없음 + lastError 보존', async () => {
    const h = harness(['err']);
    const r = await smokeCheck(3100, '/', { ...h.opts, retries: 3 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.lastStatus, null);
    assert.match(r.lastError, /ECONNREFUSED/);
    assert.strictEqual(r.attempts, 3);
    assert.strictEqual(h.calls.length, 3);
});

test('5xx 와 네트워크 오류 혼재 → 마지막 status/error 모두 보고', async () => {
    const h = harness([503, 'err']);
    const res = await smokeCheck(3100, '/', { ...h.opts, retries: 2 });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.lastStatus, 503);
    assert.match(res.lastError, /ECONNREFUSED/);
});

test('URL 형식: http://127.0.0.1:<port><path>', async () => {
    const h = harness([200]);
    await smokeCheck(4321, '/healthz', h.opts);
    assert.strictEqual(h.calls[0].url, 'http://127.0.0.1:4321/healthz');
});

test('timeoutMs 가 checkHttp 로 전달됨 (명시값 + 기본값) — 실제 타이머 미사용', async () => {
    const h1 = harness([200]);
    await smokeCheck(3100, '/', { ...h1.opts, timeoutMs: 1234 });
    assert.strictEqual(h1.calls[0].opts.timeoutMs, 1234);

    const h2 = harness([200]);
    await smokeCheck(3100, '/', h2.opts);
    assert.strictEqual(h2.calls[0].opts.timeoutMs, SMOKE_DEFAULTS.timeoutMs);
});

test('retries/intervalMs 커스텀 값 존중', async () => {
    const h = harness([500]);
    const res = await smokeCheck(3100, '/', { ...h.opts, retries: 2, intervalMs: 700 });
    assert.strictEqual(res.attempts, 2);
    assert.deepStrictEqual(h.sleeps, [700]);
});

test('onAttempt 진행 콜백: 시도별 status/error 전달, 콜백 throw 는 무시', async () => {
    const h = harness(['err', 500, 200]);
    const seen = [];
    const res = await smokeCheck(3100, '/', {
        ...h.opts,
        onAttempt: (info) => {
            seen.push(info);
            throw new Error('로깅 실패가 체크를 깨면 안 됨');
        },
    });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(seen.length, 3);
    assert.strictEqual(seen[0].attempt, 1);
    assert.strictEqual(seen[0].total, 5);
    assert.match(seen[0].error, /ECONNREFUSED/);
    assert.strictEqual(seen[0].status, null);
    assert.strictEqual(seen[1].status, 500);
    assert.strictEqual(seen[2].status, 200);
    assert.strictEqual(seen[2].error, null);
});

// ── resolveHealthPath: orbitron.yaml 의 health_path 해석 + 검증 ──────────

test('resolveHealthPath: 미지정/비객체 → 기본값 "/", 경고 없음', () => {
    for (const doc of [null, undefined, {}, 'str', 42, { health: {} }]) {
        const r = resolveHealthPath(doc);
        assert.strictEqual(r.path, HEALTH_PATH_DEFAULT);
        assert.strictEqual(r.warning, null);
    }
    assert.strictEqual(HEALTH_PATH_DEFAULT, '/');
});

test('resolveHealthPath: 최상위 health_path 유효값 그대로 사용', () => {
    const r = resolveHealthPath({ health_path: '/healthz' });
    assert.deepStrictEqual(r, { path: '/healthz', warning: null });
});

test('resolveHealthPath: 중첩 health.path 지원', () => {
    const r = resolveHealthPath({ health: { path: '/api/health' } });
    assert.deepStrictEqual(r, { path: '/api/health', warning: null });
});

test('resolveHealthPath: services.web.health_path 가 최우선 (기존 services.web 오버라이드 관례)', () => {
    const r = resolveHealthPath({
        health_path: '/top',
        health: { path: '/nested' },
        services: { web: { health_path: '/web' } },
    });
    assert.strictEqual(r.path, '/web');
});

test('resolveHealthPath: "/" 미시작 → 기본값 + 정확한 경고', () => {
    const r = resolveHealthPath({ health_path: 'healthz' });
    assert.strictEqual(r.path, '/');
    assert.strictEqual(
        r.warning,
        `⚠️ 잘못된 health_path "healthz" — '/'로 시작하고 공백이 없어야 합니다. 기본값 '/' 사용. / Invalid health_path — must start with '/' and contain no spaces; using default '/'.`
    );
});

test('resolveHealthPath: 공백 포함 → 기본값 + 경고', () => {
    const r = resolveHealthPath({ health_path: '/health z' });
    assert.strictEqual(r.path, '/');
    assert.match(r.warning, /잘못된 health_path/);
    assert.match(r.warning, /"\/health z"/);
});

test('resolveHealthPath: 문자열 아닌 값(숫자 등) → 기본값 + 경고', () => {
    const r = resolveHealthPath({ health_path: 42 });
    assert.strictEqual(r.path, '/');
    assert.match(r.warning, /잘못된 health_path/);
});
