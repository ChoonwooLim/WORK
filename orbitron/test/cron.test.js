'use strict';

// Tests for services/cron.js — CronRunner (Task 3.3). 실제 DB/docker/알림 없음,
// 전부 주입된 fake + 수동 시계.
//
// Pins:
//   1. due 작업 실행: docker exec 인자 (containerId, command 원형 그대로) +
//      last_status='success' + last_run_at 기록
//   2. not-due 스킵 (분 미매칭 → exec 없음)
//   3. eligible SELECT 가 enabled=true / status='running' / container_id 를 SQL 로 거름
//   4. compose-* → exec 없이 last_status='skipped'
//   5. 겹침 가드: 같은 작업이 아직 실행 중이면 스킵 (tick / runNow 공유)
//   6. tick 당 동시 실행 최대 2 (세마포어)
//   7. 놓친 분 따라잡기 ≤5 + 초과분 건너뛰기 로그, 같은 분 double-fire 는 no-op
//   8. 실패 → last_status='failed' + 알림 (쿨다운 없음 — 매 실행 알림)
//   9. 출력 4KB 잘림
//  10. 타임아웃 (killed=true reject) → failed + '[timeout]' 표기
//  11. 잘못된 schedule 행은 건너뜀 (tick 은 죽지 않음)

const test = require('node:test');
const assert = require('node:assert');

const cronSingleton = require('../services/cron');
const { CronRunner } = cronSingleton;

const MIN = 60 * 1000;
// 기준 시각: 2026-07-22 10:30:00 (로컬) — 초/밀리초 0 의 분 경계
const T0 = new Date(2026, 6, 22, 10, 30, 0, 0).getTime();

function jobRow(overrides = {}) {
    return {
        id: 1, project_id: 7, name: 'backup', schedule: '* * * * *',
        command: 'echo hi', container_id: 'abc123', subdomain: 'myapp',
        project_name: 'MyApp', ...overrides,
    };
}

// fake db: SELECT 는 jobs 반환, UPDATE 는 캡처
function fakeDb(jobs) {
    const updates = [];
    const selects = [];
    return {
        updates,
        selects,
        query: async (sql, params) => {
            if (/^SELECT/i.test(sql)) {
                selects.push(sql);
                return { rows: jobs };
            }
            updates.push({ sql, params });
            return { rows: [] };
        },
    };
}

function makeRunner({ jobs = [], exec, nowMs = T0 } = {}) {
    const db = fakeDb(jobs);
    const alerts = [];
    const execCalls = [];
    const state = { nowMs };
    const runner = new CronRunner({
        db,
        alert: async (title, body) => { alerts.push({ title, body }); },
        now: () => state.nowMs,
        execInContainer: exec || (async (containerId, command) => {
            execCalls.push({ containerId, command });
            return { stdout: 'ok\n', stderr: '' };
        }),
    });
    return { runner, db, alerts, execCalls, state };
}

// ── 1. due 작업 실행 ────────────────────────────────────────────────────────

test('cron: due job executes via docker-exec deps with verbatim command, records success', async () => {
    const job = jobRow({ command: 'sh -x "quoted; $VAR" | grep x' });
    const { runner, db, execCalls } = makeRunner({ jobs: [job] });
    await runner.tick();

    assert.strictEqual(execCalls.length, 1);
    // command 는 가공/이스케이프 없이 원형 그대로 단일 인자로 전달돼야 한다
    assert.deepStrictEqual(execCalls[0], { containerId: 'abc123', command: 'sh -x "quoted; $VAR" | grep x' });

    assert.strictEqual(db.updates.length, 1);
    const [status, output, ranAtMs, id] = db.updates[0].params;
    assert.strictEqual(status, 'success');
    assert.strictEqual(output, 'ok\n');
    assert.strictEqual(ranAtMs, T0);
    assert.strictEqual(id, 1);
    assert.match(db.updates[0].sql, /last_run_at/);
});

// ── 2. not-due 스킵 ─────────────────────────────────────────────────────────

test('cron: not-due job is skipped (no exec, no update)', async () => {
    const job = jobRow({ schedule: '0 3 * * *' }); // 03:00 — 지금은 10:30
    const { runner, db, execCalls } = makeRunner({ jobs: [job] });
    await runner.tick();
    assert.strictEqual(execCalls.length, 0);
    assert.strictEqual(db.updates.length, 0);
});

// ── 3. eligibility 는 SQL 이 거른다 (disabled / not-running / container 없음) ──

test('cron: eligibility SELECT filters enabled + running + container_id in SQL', async () => {
    const { runner, db } = makeRunner({ jobs: [] });
    await runner.tick();
    assert.strictEqual(db.selects.length, 1);
    assert.match(db.selects[0], /j\.enabled = true/);
    assert.match(db.selects[0], /p\.status = 'running'/);
    assert.match(db.selects[0], /p\.container_id IS NOT NULL/);
});

// ── 4. compose 스킵 ─────────────────────────────────────────────────────────

test('cron: compose-managed project → no exec, last_status=skipped', async () => {
    const job = jobRow({ container_id: 'compose-a1b2c3' });
    const { runner, db, execCalls } = makeRunner({ jobs: [job] });
    await runner.tick();
    assert.strictEqual(execCalls.length, 0);
    assert.strictEqual(db.updates.length, 1);
    assert.strictEqual(db.updates[0].params[0], 'skipped');
});

// ── 5. 겹침 가드 ────────────────────────────────────────────────────────────

test('cron: overlap guard — job still running from manual trigger is not re-executed by tick', async () => {
    let release;
    const hang = new Promise((r) => { release = r; });
    let calls = 0;
    const { runner, state } = makeRunner({
        jobs: [jobRow()],
        exec: async () => { calls++; await hang; return { stdout: '', stderr: '' }; },
    });

    const manual = runner.runNow(jobRow()); // 실행 시작 (미완료)
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(calls, 1);

    state.nowMs = T0 + MIN; // 다음 분 — tick 은 due 지만 겹침 가드로 스킵
    await runner.tick();
    assert.strictEqual(calls, 1);

    release();
    const res = await manual;
    assert.strictEqual(res.status, 'success');

    // 완료 후에는 다시 실행 가능
    state.nowMs = T0 + 2 * MIN;
    await runner.tick();
    assert.strictEqual(calls, 2);
    release(); // 두 번째 실행도 같은 hang 프로미스 (이미 resolve 됨)
});

test('cron: runNow while running returns status=running (409 material)', async () => {
    let release;
    const hang = new Promise((r) => { release = r; });
    const { runner } = makeRunner({
        jobs: [],
        exec: async () => { await hang; return { stdout: '', stderr: '' }; },
    });
    const first = runner.runNow(jobRow());
    await new Promise((r) => setImmediate(r));
    const second = await runner.runNow(jobRow());
    assert.strictEqual(second.status, 'running');
    release();
    assert.strictEqual((await first).status, 'success');
});

// ── 6. tick 당 동시 실행 최대 2 ─────────────────────────────────────────────

test('cron: at most 2 jobs execute concurrently within a tick', async () => {
    const jobs = [jobRow({ id: 1 }), jobRow({ id: 2 }), jobRow({ id: 3 }), jobRow({ id: 4 })];
    let inFlight = 0;
    let peak = 0;
    const { runner } = makeRunner({
        jobs,
        exec: async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 5));
            inFlight--;
            return { stdout: '', stderr: '' };
        },
    });
    await runner.tick();
    assert.strictEqual(peak, 2);
});

// ── 7. 놓친 분 따라잡기 / double-fire ───────────────────────────────────────

test('cron: same-minute double fire → second tick is a no-op', async () => {
    const { runner, execCalls, state } = makeRunner({ jobs: [jobRow()] });
    await runner.tick();
    state.nowMs = T0 + 30 * 1000; // 같은 분 안에서 다시 깨어남
    await runner.tick();
    assert.strictEqual(execCalls.length, 1);
});

test('cron: delayed tick evaluates every missed minute (≤5) exactly once', async () => {
    // 10:33 에만 due 인 작업 — 10:30 평가 후 tick 이 10:35 로 밀려도 실행돼야 한다
    const job = jobRow({ schedule: '33 10 * * *' });
    const { runner, execCalls, state } = makeRunner({ jobs: [job] });
    await runner.tick(); // 10:30 평가 — not due
    assert.strictEqual(execCalls.length, 0);

    state.nowMs = T0 + 5 * MIN; // 10:35 — 창은 10:31..10:35 (5분 ≤ 상한)
    await runner.tick();
    assert.strictEqual(execCalls.length, 1); // 10:33 분이 backfill 로 평가됨
});

test('cron: backfill capped at 5 minutes — older missed minutes are skipped with a log', async () => {
    // 10:31 due 작업: 20분 지연이면 창이 10:46..10:50 로 잘려 실행되지 않아야 함
    const jobOld = jobRow({ id: 1, schedule: '31 10 * * *' });
    // 10:47 due 작업: 잘린 창 안 — 실행됨
    const jobIn = jobRow({ id: 2, schedule: '47 10 * * *' });
    const { runner, execCalls, state } = makeRunner({ jobs: [jobOld, jobIn] });
    await runner.tick(); // 10:30 — 둘 다 not due
    assert.strictEqual(execCalls.length, 0);

    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => { warns.push(args.join(' ')); };
    try {
        state.nowMs = T0 + 20 * MIN; // 10:50
        await runner.tick();
    } finally {
        console.warn = origWarn;
    }
    assert.strictEqual(execCalls.length, 1); // jobIn(10:47) 만
    assert.ok(warns.some((w) => w.includes('건너뜁니다')), '초과 누락 분 스킵 로그가 있어야 함');
});

test('cron: a job due in multiple backfilled minutes runs only once', async () => {
    const job = jobRow({ schedule: '* * * * *' }); // 매분 due
    const { runner, execCalls, state } = makeRunner({ jobs: [job] });
    await runner.tick(); // 10:30
    state.nowMs = T0 + 3 * MIN; // 10:33 — 창 10:31..10:33 (3분 모두 due)
    await runner.tick();
    assert.strictEqual(execCalls.length, 2); // tick 당 1회씩만
});

// ── 8. 실패 → failed + 알림 (쿨다운 없음) ───────────────────────────────────

test('cron: failure records last_status=failed and alerts every time (no cooldown)', async () => {
    const err = new Error('exit 1');
    err.stderr = 'boom\n';
    const { runner, db, alerts, state } = makeRunner({
        jobs: [jobRow()],
        exec: async () => { throw err; },
    });
    await runner.tick();
    assert.strictEqual(db.updates.length, 1);
    assert.strictEqual(db.updates[0].params[0], 'failed');
    assert.match(db.updates[0].params[1], /boom/);
    assert.strictEqual(alerts.length, 1);
    assert.match(alerts[0].title, /backup/);

    state.nowMs = T0 + MIN; // 다음 분에 또 실패 → 또 알림 (쿨다운 없음)
    await runner.tick();
    assert.strictEqual(alerts.length, 2);
});

// ── 9. 출력 4KB 잘림 ────────────────────────────────────────────────────────

test('cron: output truncated to 4KB in last_output', async () => {
    const big = 'x'.repeat(10 * 1024);
    const { runner, db } = makeRunner({
        jobs: [jobRow()],
        exec: async () => ({ stdout: big, stderr: '' }),
    });
    await runner.tick();
    const output = db.updates[0].params[1];
    assert.strictEqual(output.length, cronSingleton.MAX_OUTPUT_CHARS);
    assert.match(output, /truncated/);
});

// ── 10. 타임아웃 경로 ───────────────────────────────────────────────────────

test('cron: timeout (killed exec) → failed with [timeout] marker + alert', async () => {
    const err = new Error('spawn killed');
    err.killed = true;
    err.stdout = 'partial output';
    const { runner, db, alerts } = makeRunner({
        jobs: [jobRow()],
        exec: async () => { throw err; },
    });
    await runner.tick();
    assert.strictEqual(db.updates[0].params[0], 'failed');
    assert.match(db.updates[0].params[1], /\[timeout\]/);
    assert.match(db.updates[0].params[1], /partial output/);
    assert.strictEqual(alerts.length, 1);
});

// ── 11. 잘못된 schedule / tick 오류 격리 ────────────────────────────────────

test('cron: invalid stored schedule is skipped without killing the tick', async () => {
    const bad = jobRow({ id: 1, schedule: 'not a cron' });
    const good = jobRow({ id: 2 });
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => { warns.push(args.join(' ')); };
    let execCount = 0;
    try {
        const { runner } = makeRunner({
            jobs: [bad, good],
            exec: async () => { execCount++; return { stdout: '', stderr: '' }; },
        });
        await runner.tick();
    } finally {
        console.warn = origWarn;
    }
    assert.strictEqual(execCount, 1); // good 만 실행
    assert.ok(warns.some((w) => w.includes('잘못된 schedule')));
});

test('cron: db failure in tick never throws', async () => {
    const runner = new CronRunner({
        db: { query: async () => { throw new Error('db down'); } },
        alert: async () => {},
        now: () => T0,
    });
    const errors = [];
    const origError = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };
    try {
        await assert.doesNotReject(runner.tick());
    } finally {
        console.error = origError;
    }
    assert.ok(errors.some((e) => e.includes('tick 실패')));
});

// ── start()/stop() — 분 경계 정렬 타이머 정리 ───────────────────────────────

test('cron: start is idempotent and stop clears both timers (process not held)', () => {
    const { runner } = makeRunner({ jobs: [] });
    runner.start();
    const align = runner._alignTimer;
    assert.ok(align);
    runner.start(); // 중복 start 는 no-op
    assert.strictEqual(runner._alignTimer, align);
    runner.stop();
    assert.strictEqual(runner._alignTimer, null);
    assert.strictEqual(runner.timer, null);
});
