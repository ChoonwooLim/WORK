'use strict';

// Tests for services/buildQueue.js — 빌드 동시 실행 제한 큐 (Task 1.3)
//
// Pins:
//   1. FIFO 순서 보장 (limit 1 에서 제출 순서 == 시작/완료 순서)
//   2. 동시 실행 상한 실제 강제 (limit 2, 4 tasks → max simultaneous 2)
//   3. fn throw 시에도 슬롯 해제 (withSlot 은 reject, 다음 작업은 실행됨)
//   4. release 중복 호출 idempotent (슬롯이 2개 풀리지 않음)
//   5. stats() 형태 { limit, active, queued }
//   6. MAX_CONCURRENT_BUILDS 엄격 왕복 파싱 (docker.js deployImageRetention 미러)
//
// 타이머(setTimeout) 없음 — 수동 resolver(deferred) + microtask 정착만 사용.

const test = require('node:test');
const assert = require('node:assert');

const buildQueue = require('../services/buildQueue');
const { BuildQueue } = buildQueue;

// 수동 resolver — 결정론적 promise 안무용
function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

// microtask 체인이 모두 소진되도록 몇 tick 대기 (타이머 아님)
async function settle() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}

// ── 1. Singleton convention ──────────────────────────────────────────────────

test('module exports a ready singleton with the full API', () => {
    assert.strictEqual(typeof buildQueue.acquire, 'function');
    assert.strictEqual(typeof buildQueue.withSlot, 'function');
    assert.strictEqual(typeof buildQueue.stats, 'function');
    const s = buildQueue.stats();
    assert.strictEqual(s.limit >= 1, true);
    assert.strictEqual(s.active, 0);
    assert.strictEqual(s.queued, 0);
});

// ── 2. FIFO order ────────────────────────────────────────────────────────────

test('FIFO: limit 1, 3 tasks start and complete in submission order', async () => {
    const q = new BuildQueue(1);
    const gates = [deferred(), deferred(), deferred()];
    const started = [];
    const completed = [];

    const runs = [0, 1, 2].map(i =>
        q.withSlot(`task-${i}`, async () => {
            started.push(i);
            await gates[i].promise;
            completed.push(i);
        })
    );

    // 뒤 작업의 gate 를 먼저 열어도 (worst case) 시작 순서는 FIFO 여야 함
    gates[2].resolve();
    gates[1].resolve();
    await settle();
    assert.deepStrictEqual(started, [0], 'only the first task may hold the slot');
    assert.deepStrictEqual(q.stats(), { limit: 1, active: 1, queued: 2 });

    gates[0].resolve();
    await Promise.all(runs);
    assert.deepStrictEqual(started, [0, 1, 2]);
    assert.deepStrictEqual(completed, [0, 1, 2]);
    assert.deepStrictEqual(q.stats(), { limit: 1, active: 0, queued: 0 });
});

// ── 3. Concurrency cap ───────────────────────────────────────────────────────

test('cap: limit 2, 4 tasks → max simultaneous is exactly 2', async () => {
    const q = new BuildQueue(2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    let active = 0;
    let maxActive = 0;

    const runs = [0, 1, 2, 3].map(i =>
        q.withSlot(`task-${i}`, async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await gates[i].promise;
            active -= 1;
            return i;
        })
    );

    await settle();
    // stats() 형태/값 — 부하 상태에서
    assert.deepStrictEqual(q.stats(), { limit: 2, active: 2, queued: 2 });

    gates[0].resolve();
    await settle();
    // 슬롯 하나가 비면 즉시 다음 대기 작업이 차지 → active 는 다시 2
    assert.deepStrictEqual(q.stats(), { limit: 2, active: 2, queued: 1 });

    gates[1].resolve();
    gates[2].resolve();
    gates[3].resolve();
    const results = await Promise.all(runs);
    assert.deepStrictEqual(results, [0, 1, 2, 3]);
    assert.strictEqual(maxActive, 2, 'concurrency cap must actually be enforced');
    assert.deepStrictEqual(q.stats(), { limit: 2, active: 0, queued: 0 });
});

// ── 4. Release on throw ──────────────────────────────────────────────────────

test('withSlot: fn throw → rejects but slot frees and next task runs', async () => {
    const q = new BuildQueue(1);
    const boom = q.withSlot('boom', async () => {
        throw new Error('build exploded');
    });
    await assert.rejects(boom, /build exploded/);
    assert.deepStrictEqual(q.stats(), { limit: 1, active: 0, queued: 0 });

    let ran = false;
    await q.withSlot('next', async () => { ran = true; });
    assert.strictEqual(ran, true, 'queue must not deadlock after a failed task');
});

test('withSlot: throw while others are queued → queued task still starts', async () => {
    const q = new BuildQueue(1);
    const gate = deferred();
    const first = q.withSlot('will-fail', async () => {
        await gate.promise;
        throw new Error('late failure');
    });
    let secondStarted = false;
    const second = q.withSlot('waiter', async () => { secondStarted = true; });

    await settle();
    assert.strictEqual(secondStarted, false);
    gate.resolve();
    await assert.rejects(first, /late failure/);
    await second;
    assert.strictEqual(secondStarted, true);
    assert.deepStrictEqual(q.stats(), { limit: 1, active: 0, queued: 0 });
});

// ── 5. Idempotent release ────────────────────────────────────────────────────

test('double release is a no-op (active never goes negative)', async () => {
    const q = new BuildQueue(1);
    const release = await q.acquire('a');
    release();
    release();
    release();
    assert.deepStrictEqual(q.stats(), { limit: 1, active: 0, queued: 0 });
});

test('double release frees exactly one slot (queued tasks not over-admitted)', async () => {
    const q = new BuildQueue(1);
    const releaseA = await q.acquire('a');

    let bStarted = false;
    let cStarted = false;
    const pB = q.acquire('b').then(r => { bStarted = true; return r; });
    const pC = q.acquire('c').then(r => { cStarted = true; return r; });

    await settle();
    assert.strictEqual(bStarted, false);

    releaseA();
    releaseA(); // 중복 해제 — c 까지 들어오면 안 됨
    await settle();
    assert.strictEqual(bStarted, true);
    assert.strictEqual(cStarted, false, 'double release must not admit two waiters');
    assert.deepStrictEqual(q.stats(), { limit: 1, active: 1, queued: 1 });

    (await pB)();
    await settle();
    assert.strictEqual(cStarted, true);
    (await pC)();
    assert.deepStrictEqual(q.stats(), { limit: 1, active: 0, queued: 0 });
});

// ── 6. Env validation (strict round-trip parse, deployImageRetention 미러) ───

test('maxConcurrentBuilds parses value with fallback 2 on invalid input', () => {
    const q = new BuildQueue(1);
    assert.strictEqual(q.maxConcurrentBuilds(undefined), 2);
    assert.strictEqual(q.maxConcurrentBuilds('abc'), 2);
    assert.strictEqual(q.maxConcurrentBuilds(''), 2);
    assert.strictEqual(q.maxConcurrentBuilds('0'), 2);
    assert.strictEqual(q.maxConcurrentBuilds('-1'), 2);
    assert.strictEqual(q.maxConcurrentBuilds('3'), 3);
    assert.strictEqual(q.maxConcurrentBuilds(' 4 '), 4);
    // 왕복 검증: 부분 파싱되는 값은 신뢰하지 않음
    assert.strictEqual(q.maxConcurrentBuilds('2abc'), 2);
    assert.strictEqual(q.maxConcurrentBuilds('1.5'), 2);
});

test('constructor: limit from MAX_CONCURRENT_BUILDS env, invalid → 2', () => {
    const saved = process.env.MAX_CONCURRENT_BUILDS;
    try {
        process.env.MAX_CONCURRENT_BUILDS = '3';
        assert.strictEqual(new BuildQueue().stats().limit, 3);
        process.env.MAX_CONCURRENT_BUILDS = 'abc';
        assert.strictEqual(new BuildQueue().stats().limit, 2);
        delete process.env.MAX_CONCURRENT_BUILDS;
        assert.strictEqual(new BuildQueue().stats().limit, 2);
        // 명시적 limit 주입은 env 보다 우선 (테스트용 주입 지점)
        process.env.MAX_CONCURRENT_BUILDS = '9';
        assert.strictEqual(new BuildQueue(1).stats().limit, 1);
    } finally {
        if (saved === undefined) delete process.env.MAX_CONCURRENT_BUILDS;
        else process.env.MAX_CONCURRENT_BUILDS = saved;
    }
});
