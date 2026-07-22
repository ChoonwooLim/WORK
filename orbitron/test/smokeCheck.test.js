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
//   7. URL = http://<host>:<port><path> (host 기본 127.0.0.1, 배포 경로는
//      컨테이너 IP 를 host 로 전달 — nginx 프록시 대상과 동일 타깃)
//   8. onAttempt 진행 콜백 — 호출 내용 + 콜백 throw 가 체크를 깨지 않음
//   9. resolveHealthPath: 유효/무효('/'미시작·공백)→기본값+정확한 경고,
//      미지정→기본값·경고 없음, health_path / health.path / services.web 우선순위
//  10. nginx.js 의 pure 감지 헬퍼: parseListenPorts(0.0.0.0 LISTEN 만) /
//      selectListenPort(기대 포트 우선, 없으면 첫 감지, 전무하면 null)
//
// 실제 네트워크/타이머 없음 — checkHttp/sleep 전부 주입.

const test = require('node:test');
const assert = require('node:assert');

const {
    smokeCheck,
    smokeStep,
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

test('URL 형식: 기본 host 는 127.0.0.1', async () => {
    const h = harness([200]);
    await smokeCheck(4321, '/healthz', h.opts);
    assert.strictEqual(h.calls[0].url, 'http://127.0.0.1:4321/healthz');
});

test('URL 형식: host 옵션 = 컨테이너 IP 타깃 (배포 스모크 체크 경로)', async () => {
    // 배포 흐름은 host-mapped 포트가 아니라 컨테이너 IP + 감지된 실제 리슨
    // 포트를 넘긴다 — nginx 가 프록시할 대상과 동일한 타깃 구성 핀.
    const h = harness([200]);
    await smokeCheck(8000, '/healthz', { ...h.opts, host: '172.18.0.5' });
    assert.strictEqual(h.calls[0].url, 'http://172.18.0.5:8000/healthz');
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

// ── smokeStep: 감지 결과 + 폴백 정책 (deployer 의 판정을 pure 로 추출) ────
// 감지 실패(detectedPort null)가 하드 게이트가 되면 안 된다: 사전-스모크
// 시절에는 12초 내 미바인딩 앱(무거운 모델 로딩 등)도 배포됐다. 폴백 프로브가
// 네트워크 오류로만 전멸했을 때에만 중단한다 (동작 패리티 핀).

test('smokeStep: 감지 성공 + 200 → 통과, usedFallback=false', async () => {
    const h = harness([200]);
    const step = await smokeStep({ detectedPort: 8000, fallbackPort: 3100, host: '172.18.0.5', path: '/', options: h.opts });
    assert.strictEqual(step.ok, true);
    assert.strictEqual(step.usedFallback, false);
    assert.strictEqual(step.port, 8000);
    assert.strictEqual(h.calls[0].url, 'http://172.18.0.5:8000/');
});

test('smokeStep: 감지 성공 + 연속 5xx → 중단 (스모크 체크 본연의 목적)', async () => {
    const h = harness([500]);
    const step = await smokeStep({ detectedPort: 8000, fallbackPort: 3100, host: '172.18.0.5', path: '/', options: h.opts });
    assert.strictEqual(step.ok, false);
    assert.strictEqual(step.result.attempts, 5);
});

test('smokeStep: 감지 null + 폴백 프로브 200 → 배포 진행 (핀: 늦은 바인딩 앱 보호)', async () => {
    const h = harness(['err', 200]); // 첫 시도엔 아직 미바인딩, 재시도에 응답
    const step = await smokeStep({ detectedPort: null, fallbackPort: 3100, host: '172.18.0.5', path: '/', options: h.opts });
    assert.strictEqual(step.ok, true);
    assert.strictEqual(step.usedFallback, true);
    assert.strictEqual(step.port, 3100); // 폴백은 기대 포트(actualPort)로
    assert.strictEqual(h.calls[0].url, 'http://172.18.0.5:3100/');
});

test('smokeStep: 감지 null + 전 시도 네트워크 오류 → 그때만 중단', async () => {
    const h = harness(['err']);
    const step = await smokeStep({ detectedPort: null, fallbackPort: 3100, host: '172.18.0.5', path: '/', options: h.opts });
    assert.strictEqual(step.ok, false);
    assert.strictEqual(step.usedFallback, true);
    assert.strictEqual(step.result.lastStatus, null);
    assert.strictEqual(step.result.attempts, 5);
});

test('smokeStep: 감지 null + 5xx 응답 → 소프트 통과 (응답 자체가 리슨 증거 — 사전 분기 패리티)', async () => {
    const h = harness([500]);
    const step = await smokeStep({ detectedPort: null, fallbackPort: 3100, host: '172.18.0.5', path: '/', options: h.opts });
    assert.strictEqual(step.ok, true);           // 배포는 진행
    assert.strictEqual(step.result.ok, false);   // 단, 프로브 자체는 실패로 기록 (경고 로그용)
    assert.strictEqual(step.result.lastStatus, 500);
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

// ── nginx.js 리슨 포트 감지의 pure 부분 (스모크 타깃 구성이 공유) ─────────
// detectContainerListenPorts(docker exec 폴링)와 컨테이너 IP inspect 는
// 부수효과라 여기서 테스트하지 않는다 — parse/select 가 판정 로직 전부를 진다.

const { parseListenPorts, selectListenPort } = require('../services/nginx');

const PROC_NET_TCP_SAMPLE = [
    '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    '   0: 00000000:1F40 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 12345 1 0000000000000000 100 0 0 10 0',
    '   1: 0100007F:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 12346 1 0000000000000000 100 0 0 10 0',
    '   2: 00000000:1F41 0100007F:D431 01 00000000:00000000 00:00000000 00000000  1000        0 12347 1 0000000000000000 100 0 0 10 0',
].join('\n');

test('parseListenPorts: 0.0.0.0 LISTEN(0A)만 추출 — 루프백 바인딩/비 LISTEN 제외', () => {
    const ports = parseListenPorts(PROC_NET_TCP_SAMPLE);
    // 0x1F40 = 8000 (0.0.0.0 LISTEN ✓), 0x0BB8 = 3000 (127.0.0.1 바인딩 ✗),
    // 0x1F41 = 8001 (state 01 = ESTABLISHED ✗)
    assert.deepStrictEqual([...ports], [8000]);
});

test('parseListenPorts: 빈/이상 입력 → 빈 Set', () => {
    assert.strictEqual(parseListenPorts('').size, 0);
    assert.strictEqual(parseListenPorts('garbage\nlines').size, 0);
});

// tcp6: local_address 가 32-hex. 기본 Node server.listen(port) 는 :: 에
// 바인드되어 /proc/net/tcp6 에만 나타난다 — tcp 만 보면 이런 앱의 배포가
// 전부 "리슨 없음"으로 중단된다 (하드 게이트 회귀 방지 핀).
const PROC_NET_TCP6_SAMPLE = [
    '  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    '   0: 00000000000000000000000000000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 22345 1 0000000000000000 100 0 0 10 0',
    '   1: 00000000000000000000000000000001:1F91 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 22346 1 0000000000000000 100 0 0 10 0',
    '   2: 0000000000000000FFFF00000100007F:1F92 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 22347 1 0000000000000000 100 0 0 10 0',
    '   3: 00000000000000000000000000000000:1F93 00000000000000000000000000000000:0000 01 00000000:00000000 00:00000000 00000000  1000        0 22348 1 0000000000000000 100 0 0 10 0',
].join('\n');

test('parseListenPorts: tcp6 — :: 바인딩(전부 0)만 수용, ::1/IPv4-mapped 루프백/비 LISTEN 제외', () => {
    const ports = parseListenPorts(PROC_NET_TCP6_SAMPLE);
    // 0x1F90 = 8080 (:: LISTEN ✓), 8081 (::1 ✗), 8082 (::ffff:127.0.0.1 ✗),
    // 8083 (state 01 ✗)
    assert.deepStrictEqual([...ports], [8080]);
});

test('parseListenPorts: tcp + tcp6 연결(cat 두 파일) 혼합 입력 → 양쪽 포트 합집합', () => {
    const ports = parseListenPorts(PROC_NET_TCP_SAMPLE + '\n' + PROC_NET_TCP6_SAMPLE);
    assert.deepStrictEqual([...ports].sort((a, b) => a - b), [8000, 8080]);
});

test('selectListenPort: 기대 포트가 열려 있으면 그대로', () => {
    assert.strictEqual(selectListenPort(new Set([3000, 8000]), 3000), 3000);
});

test('selectListenPort: 기대 포트 미리슨 → 첫 감지 포트 (하드코딩 CMD 구제)', () => {
    assert.strictEqual(selectListenPort(new Set([8000]), 3576), 8000);
});

test('selectListenPort: 아무것도 리슨하지 않으면 null (스모크 체크는 이걸 실패로 판정)', () => {
    assert.strictEqual(selectListenPort(new Set(), 3000), null);
});
