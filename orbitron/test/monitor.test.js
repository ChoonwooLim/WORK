'use strict';

// Tests for services/monitor.js + services/alerts.js — 능동 헬스 모니터링 (Task 2.2)
//
// Pins:
//   0. 프로브는 nginx 경유 실제 서빙 경로: GET http://127.0.0.1:80/ +
//      Host: <subdomain>.<TUNNEL_DOMAIN> (기본 twinverse.org).
//      host-mapped 포트 직접 프로브 금지 — PORT env 를 무시하고 내부 포트에
//      하드코딩된 앱(nginx 리슨 포트 감지로 구제됨)을 죽은 것으로 오판해
//      멀쩡한 컨테이너를 재시작/unhealthy 처리한 실장애의 회귀 방지
//      (suit/twinland/joojooland, 2026-07).
//   1. 건강한 프로젝트 → 완전 no-op (쓰기/재시작/알림 없음)
//   2. HTTP 500 도 "살아있음" (nginx 가 앱의 500 을 돌려줌 = 앱이 응답했다);
//      301 도 "살아있음" (custom-domain 리다이렉트 — nginx 직접 응답);
//      502/504 는 "죽음" (nginx 가 업스트림에 도달하지 못함);
//      X-Orbitron-Default 헤더가 붙은 응답도 "죽음" (default.conf 의
//      catch-all 이 응답 = 프로젝트 conf 유실 — 랜딩 200 은 false alive)
//   3. 연속 3회 실패 → docker restart 정확히 1회 (outage 당 1회)
//   4. compose-* (compose-manual-* 포함) → 재시작 금지, unhealthy + 알림
//   5. 연속 6회 실패 → status='unhealthy' + 마지막 오류 포함 알림
//   6. 알림 쿨다운 30분 (억제 후 재허용), 복구 알림은 쿨다운 면제 + outage 당 1회
//   7. 복구 시 status='running' 복원 (재가드 WHERE status IN ...)
//   8. isDeploying 프로젝트는 프로브 자체를 건너뜀
//   9. SELECT 가 db_* 타입/포트 없음/building 등을 제외 (fake db 가 SQL 캡처)
//  10. pixel_streaming(env_vars.PROJECT_TYPE) 프로젝트 제외
//  11. tick() 오류 격리 — 어떤 실패도 throw 로 전파되지 않음
//
// 실제 네트워크/DB/docker 없음 — 전부 주입된 fake + 수동 시계.

const test = require('node:test');
const assert = require('node:assert');

const monitorSingleton = require('../services/monitor');
const { Monitor } = monitorSingleton;
const alerts = require('../services/alerts');

const MIN30 = 30 * 60 * 1000;

function project(overrides = {}) {
    return {
        id: 1, name: 'webapp', subdomain: 'webapp-sub', port: 3100,
        container_id: 'orbitron-webapp-abc123', status: 'running', env_vars: {},
        ...overrides,
    };
}

// fake 종합 하네스 — 호출 기록 + 스크립트 가능한 프로브 + 수동 시계
function harness({ projects = [project()], deployingIds = [] } = {}) {
    const h = {
        projects,
        selects: [],
        updates: [],   // { sql, params }
        probes: [],    // url
        restarts: [],  // project
        alertCalls: [], // { title, body }
        nowMs: 1_000_000,
        // 각 프로브의 결과 스크립트: 'ok' | 'err' | number(HTTP status) | function
        httpResult: 'ok',
    };
    const deps = {
        db: {
            query: async (sql, params) => {
                if (/^\s*SELECT/i.test(sql)) {
                    h.selects.push(sql);
                    return { rows: h.projects };
                }
                h.updates.push({ sql, params });
                return { rows: [] };
            },
        },
        checkHttp: async (url, opts) => {
            h.probes.push({ url, host: opts && opts.headers && opts.headers.Host });
            const r = typeof h.httpResult === 'function' ? h.httpResult(url) : h.httpResult;
            if (r === 'ok') return { status: 200, orbitronDefault: false };
            // 'default' = 프로젝트 conf 유실 시나리오: default server 가
            // X-Orbitron-Default 헤더와 함께 랜딩 페이지 200 을 돌려준다
            if (r === 'default') return { status: 200, orbitronDefault: true };
            if (typeof r === 'number') return { status: r, orbitronDefault: false };
            throw new Error('ECONNREFUSED 127.0.0.1');
        },
        restartContainer: async (p) => { h.restarts.push(p); },
        alert: async (title, body) => { h.alertCalls.push({ title, body }); },
        isDeploying: (id) => deployingIds.includes(id),
        now: () => h.nowMs,
    };
    h.monitor = new Monitor(deps);
    return h;
}

async function failTicks(h, n) {
    h.httpResult = 'err';
    for (let i = 0; i < n; i++) await h.monitor.tick();
}

// ── singleton 관례 ───────────────────────────────────────────────────────────

test('module exports a singleton with start/stop/tick and the Monitor class', () => {
    assert.strictEqual(typeof monitorSingleton.tick, 'function');
    assert.strictEqual(typeof monitorSingleton.start, 'function');
    assert.strictEqual(typeof monitorSingleton.stop, 'function');
    assert.strictEqual(typeof Monitor, 'function');
});

test('start() is idempotent and stop() clears the timer', () => {
    const h = harness();
    h.monitor.start();
    const timer = h.monitor.timer;
    assert.ok(timer);
    h.monitor.start(); // idempotent — 두 번째 start 가 타이머를 갈아치우지 않음
    assert.strictEqual(h.monitor.timer, timer);
    h.monitor.stop();
    assert.strictEqual(h.monitor.timer, null);
    h.monitor.stop(); // stop 도 idempotent
});

// ── 1+2. 건강 경로 ───────────────────────────────────────────────────────────

test('healthy project is a complete no-op (no writes, restarts, alerts)', async () => {
    const h = harness();
    await h.monitor.tick();
    await h.monitor.tick();
    assert.strictEqual(h.probes.length, 2);
    // nginx 경유 실제 서빙 경로 핀 — host-mapped 포트 직접 프로브로의 회귀 방지
    assert.strictEqual(h.probes[0].url, 'http://127.0.0.1:80/');
    assert.strictEqual(h.probes[0].host, 'webapp-sub.twinverse.org');
    assert.deepStrictEqual(h.updates, []);
    assert.deepStrictEqual(h.restarts, []);
    assert.deepStrictEqual(h.alertCalls, []);
});

test('HTTP 500 still counts as alive (nginx relayed the app\'s own 500 — the app answered)', async () => {
    const h = harness();
    h.httpResult = 500;
    for (let i = 0; i < 6; i++) await h.monitor.tick();
    assert.deepStrictEqual(h.restarts, []);
    assert.deepStrictEqual(h.updates, []);
    assert.deepStrictEqual(h.alertCalls, []);
});

test('HTTP 301 counts as alive (custom-domain redirect projects: nginx 301s the tunnel Host)', async () => {
    const h = harness();
    h.httpResult = 301;
    for (let i = 0; i < 6; i++) await h.monitor.tick();
    assert.deepStrictEqual(h.restarts, []);
    assert.deepStrictEqual(h.updates, []);
    assert.deepStrictEqual(h.alertCalls, []);
});

test('HTTP 502 counts as dead (nginx cannot reach the upstream) — restart on 3rd failure', async () => {
    const h = harness();
    h.httpResult = 502;
    for (let i = 0; i < 3; i++) await h.monitor.tick();
    assert.strictEqual(h.restarts.length, 1);
    // 알림/unhealthy 단계에서 마지막 오류로 502 가 보고되도록 기록됨
    assert.match(h.monitor.states.get(1).lastError, /HTTP 502/);
});

test('HTTP 504 counts as dead (upstream timeout through nginx)', async () => {
    const h = harness();
    h.httpResult = 504;
    for (let i = 0; i < 3; i++) await h.monitor.tick();
    assert.strictEqual(h.restarts.length, 1);
});

test('default-server response (X-Orbitron-Default) counts as dead even with status 200', async () => {
    // 프로젝트 conf 유실 시 unknown Host 는 default.conf 랜딩 페이지(200)에
    // 떨어진다 — 외부에서는 실제로 죽은 상태이므로 false alive 금지.
    const h = harness();
    h.httpResult = 'default';
    for (let i = 0; i < 3; i++) await h.monitor.tick();
    assert.strictEqual(h.restarts.length, 1);
    assert.strictEqual(h.monitor.states.get(1).lastError, 'nginx conf missing — default server answered');
});

test('orbitronDefault absent from an injected checkHttp result → treated as not-default (backward compat)', async () => {
    const h = harness();
    h.monitor.checkHttp = async () => ({ status: 200 }); // 옛 형태
    await h.monitor.tick();
    assert.deepStrictEqual(h.updates, []);
    assert.deepStrictEqual(h.restarts, []);
});

// ── 3. 3연속 실패 → 1회 재시작 ──────────────────────────────────────────────

test('3 consecutive failures trigger exactly one restart per outage', async () => {
    const h = harness();
    await failTicks(h, 2);
    assert.deepStrictEqual(h.restarts, []); // 2회까지는 관찰만
    await failTicks(h, 1);
    assert.strictEqual(h.restarts.length, 1);
    assert.strictEqual(h.restarts[0].id, 1);
    await failTicks(h, 2); // fail 4, 5
    assert.strictEqual(h.restarts.length, 1); // 재시작은 outage 당 1회뿐
    assert.deepStrictEqual(h.updates, []); // 아직 unhealthy 아님
});

test('recovery resets state — a new outage may restart again', async () => {
    const h = harness();
    await failTicks(h, 4);
    assert.strictEqual(h.restarts.length, 1);
    h.httpResult = 'ok';
    await h.monitor.tick(); // 복구 (unhealthy 마킹 전이라 조용히 리셋)
    assert.deepStrictEqual(h.updates, []);
    assert.deepStrictEqual(h.alertCalls, []); // 조용한 복구 — 알림 없음
    await failTicks(h, 3); // 새 outage
    assert.strictEqual(h.restarts.length, 2);
});

// ── 4. compose 는 재시작 금지 ────────────────────────────────────────────────

test('compose-manual project: no restart, unhealthy + alert on 3rd failure', async () => {
    const h = harness({ projects: [project({ container_id: 'compose-manual-xyz', name: 'iiff' })] });
    await failTicks(h, 3);
    assert.deepStrictEqual(h.restarts, []);
    assert.strictEqual(h.updates.length, 1);
    assert.match(h.updates[0].sql, /SET status = \$1/);
    assert.deepStrictEqual(h.updates[0].params, ['unhealthy', 1]);
    assert.match(h.updates[0].sql, /status IN \('running', 'unhealthy'\)/); // 재가드
    assert.strictEqual(h.alertCalls.length, 1);
    assert.match(h.alertCalls[0].title, /iiff/);
    assert.match(h.alertCalls[0].body, /자동 재시작하지 않습니다/);
    assert.match(h.alertCalls[0].body, /webapp-sub/); // subdomain 포함
    assert.match(h.alertCalls[0].body, /port 3100/); // port 포함
    await failTicks(h, 10); // 계속 실패해도 재시작 금지 + 쿨다운으로 재알림 억제
    assert.deepStrictEqual(h.restarts, []);
    assert.strictEqual(h.alertCalls.length, 1);
});

// ── 5. 6연속 실패 → unhealthy + 알림 ────────────────────────────────────────

test('6 consecutive failures mark unhealthy with last error in the alert', async () => {
    const h = harness();
    await failTicks(h, 5);
    assert.deepStrictEqual(h.updates, []);
    assert.deepStrictEqual(h.alertCalls, []);
    await failTicks(h, 1); // fail 6
    assert.strictEqual(h.restarts.length, 1); // 재시작 시도는 1회였음
    assert.deepStrictEqual(h.updates[0].params, ['unhealthy', 1]);
    assert.strictEqual(h.alertCalls.length, 1);
    assert.match(h.alertCalls[0].title, /webapp/);
    assert.match(h.alertCalls[0].body, /ECONNREFUSED/); // 마지막 오류 포함
    assert.match(h.alertCalls[0].body, /webapp-sub/); // subdomain 포함
    assert.match(h.alertCalls[0].body, /port 3100/); // port 포함
});

// ── 6. 알림 쿨다운 ──────────────────────────────────────────────────────────

test('failure alerts respect the 30min cooldown, then fire again', async () => {
    const h = harness();
    await failTicks(h, 8); // fail 6 에서 알림 1회, 7~8 은 쿨다운으로 억제
    assert.strictEqual(h.alertCalls.length, 1);
    h.nowMs += MIN30 - 1;
    await failTicks(h, 1); // 아직 30분 미만 → 억제
    assert.strictEqual(h.alertCalls.length, 1);
    h.nowMs += 1; // 정확히 30분 경과
    await failTicks(h, 1);
    assert.strictEqual(h.alertCalls.length, 2);
    // unhealthy UPDATE 는 처음 한 번만 (매 tick 마다 쓰지 않음)
    assert.strictEqual(h.updates.length, 1);
});

// ── 7. 복구 알림 + status 복원 ──────────────────────────────────────────────

test('recovery from unhealthy restores running and alerts once (cooldown-exempt)', async () => {
    const h = harness();
    await failTicks(h, 6); // unhealthy + 알림 (lastAlertAt = now)
    assert.strictEqual(h.alertCalls.length, 1);
    h.httpResult = 'ok';
    await h.monitor.tick(); // 복구 — 쿨다운 안이지만 복구 알림은 면제
    assert.strictEqual(h.updates.length, 2);
    assert.deepStrictEqual(h.updates[1].params, ['running', 1]);
    assert.match(h.updates[1].sql, /status IN \('running', 'unhealthy'\)/);
    assert.strictEqual(h.alertCalls.length, 2);
    assert.match(h.alertCalls[1].title, /복구됨/);
    await h.monitor.tick(); // 계속 건강 → 복구 알림은 outage 당 1회
    await h.monitor.tick();
    assert.strictEqual(h.alertCalls.length, 2);
});

// ── 8. 배포 중 스킵 ─────────────────────────────────────────────────────────

test('projects with an in-flight deployment are not probed at all', async () => {
    const h = harness({
        projects: [project(), project({ id: 2, name: 'deploying', port: 3200 })],
        deployingIds: [2],
    });
    h.httpResult = 'err';
    await failTicks(h, 3);
    // 프로브는 project 1 에만 (3회), project 2 는 0회
    assert.strictEqual(h.probes.length, 3);
    assert.ok(h.probes.every(p => p.url === 'http://127.0.0.1:80/' && p.host === 'webapp-sub.twinverse.org'));
    assert.strictEqual(h.restarts.length, 1);
    assert.strictEqual(h.restarts[0].id, 1);
});

// ── 9. SELECT 필터 (db 타입 제외 등) ────────────────────────────────────────

test('the SELECT excludes db types, requires a port, and includes unhealthy for recovery', async () => {
    const h = harness();
    await h.monitor.tick();
    const sql = h.selects[0];
    assert.match(sql, /status IN \('running', 'unhealthy'\)/);
    assert.match(sql, /type NOT IN \('db_postgres', 'db_redis'\)/);
    assert.match(sql, /port IS NOT NULL/);
    assert.match(sql, /subdomain/); // 알림 본문용
});

test('a project persisted as unhealthy (e.g. across a server restart) is restored on a healthy probe', async () => {
    // 서버 재시작으로 in-memory state(markedUnhealthy)는 사라졌지만 DB 행은
    // 'unhealthy' 인 상황 — row status 만으로도 복원 + 복구 알림이 나가야 한다.
    const h = harness({ projects: [project({ status: 'unhealthy' })] });
    await h.monitor.tick();
    assert.strictEqual(h.updates.length, 1);
    assert.deepStrictEqual(h.updates[0].params, ['running', 1]);
    assert.strictEqual(h.alertCalls.length, 1);
    assert.match(h.alertCalls[0].title, /복구됨/);
    // 복원 후(운영에선 UPDATE 로 행이 running 이 됨) 더 이상 알림 없음
    h.projects = [project({ status: 'running' })];
    await h.monitor.tick();
    assert.strictEqual(h.alertCalls.length, 1);
    assert.strictEqual(h.updates.length, 1);
});

// ── 10. pixel_streaming 제외 ────────────────────────────────────────────────

test('pixel_streaming projects (env_vars.PROJECT_TYPE) are skipped', async () => {
    const h = harness({
        projects: [project({ id: 3, name: 'ps', env_vars: { PROJECT_TYPE: 'pixel_streaming' } })],
    });
    h.httpResult = 'err';
    await h.monitor.tick();
    assert.deepStrictEqual(h.probes, []);
    assert.deepStrictEqual(h.restarts, []);
});

// ── 11. 오류 격리 ───────────────────────────────────────────────────────────

test('tick never throws: SELECT failure is contained', async () => {
    const h = harness();
    h.monitor._deps.db.query = async () => { throw new Error('db down'); };
    await assert.doesNotReject(() => h.monitor.tick());
});

test('tick never throws: per-project errors (UPDATE failure) do not stop the sweep', async () => {
    const h = harness({
        projects: [
            project({ container_id: 'compose-manual-a' }),
            project({ id: 2, name: 'second', port: 3200 }),
        ],
    });
    const realQuery = h.monitor._deps.db.query;
    h.monitor._deps.db.query = async (sql, params) => {
        if (/^\s*UPDATE/i.test(sql)) throw new Error('write refused');
        return realQuery(sql, params);
    };
    await failTicks(h, 3); // compose 는 3회차에 UPDATE 시도 → throw → 격리
    // 두 번째 프로젝트는 계속 점검되어 재시작까지 도달
    assert.strictEqual(h.restarts.length, 1);
    assert.strictEqual(h.restarts[0].id, 2);
});

test('state is pruned when a project leaves the monitored set', async () => {
    const h = harness();
    await failTicks(h, 2);
    assert.strictEqual(h.monitor.states.get(1).failures, 2);
    h.projects = []; // 프로젝트가 stopped/삭제됨
    await h.monitor.tick();
    assert.strictEqual(h.monitor.states.size, 0);
});

// ── alerts.js ───────────────────────────────────────────────────────────────

test('alerts: isConfigured reflects env, unconfigured sendAlert falls back to console.warn', async (t) => {
    const savedToken = process.env.TELEGRAM_BOT_TOKEN;
    const savedChat = process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    t.after(() => {
        if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
        if (savedChat !== undefined) process.env.TELEGRAM_CHAT_ID = savedChat;
    });

    assert.strictEqual(alerts.isConfigured(), false);
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
        const ok = await alerts.sendAlert('제목', '본문');
        assert.strictEqual(ok, false);
        assert.strictEqual(warns.length, 1);
        assert.match(warns[0], /telegram 미설정/);
        assert.match(warns[0], /제목/);
        assert.match(warns[0], /본문/);
    } finally {
        console.warn = origWarn;
    }
});

test('alerts: configured sendAlert POSTs plain text to the Telegram API (fetch stubbed)', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok123';
    process.env.TELEGRAM_CHAT_ID = 'chat456';
    t.after(() => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
    });
    assert.strictEqual(alerts.isConfigured(), true);

    const fetches = [];
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => { fetches.push({ url, opts }); return { ok: true, status: 200 }; };
    try {
        const ok = await alerts.sendAlert('🚨 down', 'details');
        assert.strictEqual(ok, true);
        assert.strictEqual(fetches.length, 1);
        assert.strictEqual(fetches[0].url, 'https://api.telegram.org/bottok123/sendMessage');
        const payload = JSON.parse(fetches[0].opts.body);
        assert.deepStrictEqual(payload, { chat_id: 'chat456', text: '🚨 down\n\ndetails' });
        assert.strictEqual(payload.parse_mode, undefined); // plain text — 이스케이프 버그 방지
    } finally {
        global.fetch = origFetch;
    }
});

test('alerts: text is truncated to the Telegram limit (long lastError must not kill the alert)', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    t.after(() => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
    });
    const fetches = [];
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => { fetches.push({ url, opts }); return { ok: true, status: 200 }; };
    try {
        const ok = await alerts.sendAlert('제목', 'x'.repeat(10000));
        assert.strictEqual(ok, true);
        const text = JSON.parse(fetches[0].opts.body).text;
        assert.strictEqual(text.length, alerts.TELEGRAM_MAX_TEXT); // 4000 (< 4096 한도)
        assert.ok(text.endsWith('…'));
        assert.ok(text.startsWith('제목\n\n'));
    } finally {
        global.fetch = origFetch;
    }
});

test('alerts: non-ok response logs the Telegram error body for diagnosis', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    t.after(() => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
    });
    const origFetch = global.fetch;
    const origErr = console.error;
    const errors = [];
    console.error = (...args) => errors.push(args.join(' '));
    global.fetch = async () => ({
        ok: false, status: 400,
        text: async () => '{"ok":false,"description":"Bad Request: chat not found"}',
    });
    try {
        const ok = await alerts.sendAlert('t', 'b');
        assert.strictEqual(ok, false);
        assert.strictEqual(errors.length, 1);
        assert.match(errors[0], /HTTP 400/);
        assert.match(errors[0], /chat not found/);
    } finally {
        global.fetch = origFetch;
        console.error = origErr;
    }
});

test('alerts: sendAlert never throws (fetch rejects → false)', async (t) => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    t.after(() => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_CHAT_ID;
    });
    const origFetch = global.fetch;
    const origErr = console.error;
    console.error = () => {};
    global.fetch = async () => { throw new Error('network down'); };
    try {
        const ok = await alerts.sendAlert('t', 'b');
        assert.strictEqual(ok, false);
    } finally {
        global.fetch = origFetch;
        console.error = origErr;
    }
});
