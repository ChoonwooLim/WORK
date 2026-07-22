'use strict';

// Tests for services/metrics.js — 리소스 메트릭 수집 + 시간별 집계 (Task 2.3)
//
// Pins:
//   1. docker stats 라인 파서 — MiB/GiB/KiB/B 단위, '%' 제거, malformed 스킵
//   2. 컨테이너 → 서브도메인 해석: 정확 일치 우선, deployhash 는 "나머지가
//      아는 서브도메인일 때만" 제거 (twinverse vs twinverseai 함정 포함)
//   3. 링 버퍼 상한 1440 (1441번째 샘플이 가장 오래된 것 축출) — 메모리 유계
//   4. DB 에서 사라진 서브도메인의 버퍼 prune (monitor seen-set 관례)
//   5. 시간(UTC hour) 경계 감지 + 집계 수학 (avg/max/samples) + INSERT 파라미터
//      고정 + ON CONFLICT DO NOTHING + 30일 retention DELETE 동일 배치
//   6. 집계 실패 격리 — tick 은 throw 하지 않고 다음 tick 에 재시도 (버퍼 보존)
//   7. 다중 시간 경계 밀림(catch-up) 시 시간별로 각각 집계
//   8. docker stats 실패 격리 + 겹침 tick 가드 (hung docker 호출이 쌓이지 않음)
//   9. getSeries 범위 슬라이싱 / getUnaggregatedTail
//  10. parseRange — 기본 24h, 1h/24h/7d 허용, 그 외 null
//
// 라우트 자체(express 핸들러/ownership SQL)는 여기서 다루지 않는다 — 순수
// 헬퍼(parseRange, getSeries, getUnaggregatedTail)만 커버. 실제 네트워크/DB/
// docker 없음 — 전부 주입된 fake + 수동 시계.

const test = require('node:test');
const assert = require('node:assert');

const metricsSingleton = require('../services/metrics');
const {
    MetricsCollector, parseStatsLine, parseStatsOutput,
    resolveSubdomain, parseRange, hourStartMs,
} = metricsSingleton;

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
// 1_800_000_000_000 은 정확히 UTC 시간 경계 (3_600_000 * 500_000)
const BASE = 1_800_000_000_000;

function line(name, cpu, mem) {
    return `${name}\t${cpu}\t${mem}`;
}

// fake 종합 하네스 — 쿼리 기록 + 스크립트 가능한 stats + 수동 시계
function harness({ rows = [{ id: 1, subdomain: 'sodamfn' }] } = {}) {
    const h = {
        rows,
        selects: [],   // SELECT sql
        writes: [],    // { sql, params } (INSERT/DELETE)
        nowMs: BASE + MIN,
        statsOutput: '',
        statsError: null,
        statsCalls: 0,
        failInserts: false,
    };
    h.collector = new MetricsCollector({
        db: {
            query: async (sql, params) => {
                if (/^\s*SELECT/i.test(sql)) {
                    h.selects.push(sql);
                    return { rows: h.rows };
                }
                if (h.failInserts && /^\s*INSERT/i.test(sql)) throw new Error('db down');
                h.writes.push({ sql, params });
                return { rows: [] };
            },
        },
        collectStats: async () => {
            h.statsCalls += 1;
            if (h.statsError) throw h.statsError;
            if (h.statsPromise) return h.statsPromise;
            return h.statsOutput;
        },
        now: () => h.nowMs,
    });
    return h;
}

// ── 1. stats 라인 파서 ──────────────────────────────────────────────

test('parseStatsLine: MiB 기본 케이스', () => {
    const s = parseStatsLine('orbitron-sodamfn-mrkohf1c\t0.16%\t179.9MiB / 62.75GiB');
    assert.deepStrictEqual(s, { name: 'orbitron-sodamfn-mrkohf1c', cpuPct: 0.16, memMiB: 179.9 });
});

test('parseStatsLine: GiB → MiB 환산', () => {
    const s = parseStatsLine(line('orbitron-x', '1.50%', '1.5GiB / 62.75GiB'));
    assert.strictEqual(s.memMiB, 1536);
    assert.strictEqual(s.cpuPct, 1.5);
});

test('parseStatsLine: KiB → MiB 환산', () => {
    const s = parseStatsLine(line('orbitron-x', '0.00%', '512KiB / 1GiB'));
    assert.strictEqual(s.memMiB, 0.5);
    assert.strictEqual(s.cpuPct, 0);
});

test('parseStatsLine: B 단위도 허용', () => {
    const s = parseStatsLine(line('orbitron-x', '0.01%', '1048576B / 1GiB'));
    assert.strictEqual(s.memMiB, 1);
});

test('parseStatsLine: malformed → null', () => {
    assert.strictEqual(parseStatsLine(''), null);
    assert.strictEqual(parseStatsLine('no-tabs-here'), null);
    assert.strictEqual(parseStatsLine(line('orbitron-x', '--', '10MiB / 1GiB')), null);       // CPU 파싱 불가
    assert.strictEqual(parseStatsLine(line('orbitron-x', '0.1%', 'garbage')), null);          // Mem 파싱 불가
    assert.strictEqual(parseStatsLine(line('orbitron-x', '0.1%', '10XB / 1GiB')), null);      // 미지의 단위
    assert.strictEqual(parseStatsLine('orbitron-x\t0.1%'), null);                             // 필드 부족
});

test('parseStatsOutput: 여러 줄 + malformed 스킵 + 트레일링 개행', () => {
    const out = parseStatsOutput(
        line('orbitron-a-h1', '1.00%', '10MiB / 1GiB') + '\n' +
        'garbage line\n' +
        line('orbitron-b', '2.00%', '20MiB / 1GiB') + '\n'
    );
    assert.deepStrictEqual(out.map((s) => s.name), ['orbitron-a-h1', 'orbitron-b']);
});

// ── 2. 컨테이너 → 서브도메인 해석 ──────────────────────────────────

test('resolveSubdomain: 정확 일치 (DB 컨테이너 = -db 로 끝나는 서브도메인)', () => {
    const known = new Set(['twinverse', 'twinverse-db']);
    // 정확 일치가 deployhash 제거보다 우선 — 'db' 를 hash 로 오인하지 않음
    assert.strictEqual(resolveSubdomain('orbitron-twinverse-db', known), 'twinverse-db');
    assert.strictEqual(resolveSubdomain('orbitron-twinverse', known), 'twinverse');
});

test('resolveSubdomain: deployhash 는 나머지가 아는 서브도메인일 때만 제거', () => {
    const known = new Set(['sodamfn', 'sodam-jobs']);
    assert.strictEqual(resolveSubdomain('orbitron-sodamfn-mrkohf1c', known), 'sodamfn');
    // 하이픈 포함 서브도메인 + deployhash
    assert.strictEqual(resolveSubdomain('orbitron-sodam-jobs-mrkohf1c', known), 'sodam-jobs');
    // 나머지가 미지 → null (마구잡이 제거 금지)
    assert.strictEqual(resolveSubdomain('orbitron-unknown-mrkohf1c', known), null);
});

test('resolveSubdomain: twinverse vs twinverseai 접두 함정', () => {
    const known = new Set(['twinverse', 'twinverseai']);
    assert.strictEqual(resolveSubdomain('orbitron-twinverse-mrk0aaaa', known), 'twinverse');
    assert.strictEqual(resolveSubdomain('orbitron-twinverseai-mrk0aaaa', known), 'twinverseai');
    assert.strictEqual(resolveSubdomain('orbitron-twinverseai', known), 'twinverseai');
});

test('resolveSubdomain: orbitron- 접두사 없는 컨테이너는 무시', () => {
    const known = new Set(['postgres']);
    assert.strictEqual(resolveSubdomain('postgres', known), null);
    assert.strictEqual(resolveSubdomain('some-other-container', known), null);
});

// ── 3. tick — 수집/버퍼/프룬 ────────────────────────────────────────

test('tick: 샘플을 서브도메인별 버퍼에 적재 (웹 + db 동시), 미지 컨테이너 스킵', async () => {
    const h = harness({
        rows: [{ id: 1, subdomain: 'sodamfn' }, { id: 2, subdomain: 'twinverse-db' }],
    });
    h.statsOutput =
        line('orbitron-sodamfn-mrkohf1c', '0.16%', '179.9MiB / 62.75GiB') + '\n' +
        line('orbitron-twinverse-db', '1.00%', '1.0GiB / 62.75GiB') + '\n' +
        line('orbitron-ghost-abc', '9.99%', '10MiB / 1GiB') + '\n';
    await h.collector.tick();

    assert.deepStrictEqual([...h.collector.buffers.keys()].sort(), ['sodamfn', 'twinverse-db']);
    assert.deepStrictEqual(h.collector.buffers.get('sodamfn'),
        [{ ts: BASE + MIN, cpuPct: 0.16, memMiB: 179.9 }]);
    assert.deepStrictEqual(h.collector.buffers.get('twinverse-db'),
        [{ ts: BASE + MIN, cpuPct: 1, memMiB: 1024 }]);
    // 서브도메인 SELECT 는 tick 당 1회
    assert.strictEqual(h.selects.length, 1);
    assert.match(h.selects[0], /SELECT id, subdomain FROM projects/);
});

test('링 버퍼: 1441번째 샘플이 가장 오래된 슬롯을 축출 (상한 1440)', async () => {
    const h = harness();
    const prefill = [];
    for (let i = 0; i < 1440; i++) prefill.push({ ts: BASE - (1440 - i) * MIN, cpuPct: i, memMiB: i });
    h.collector.buffers.set('sodamfn', prefill.slice());
    h.statsOutput = line('orbitron-sodamfn-mrkohf1c', '7.00%', '70MiB / 1GiB');
    await h.collector.tick();

    const buf = h.collector.buffers.get('sodamfn');
    assert.strictEqual(buf.length, 1440);
    assert.strictEqual(buf[0].cpuPct, 1);                 // 0번(가장 오래된) 축출
    assert.strictEqual(buf[buf.length - 1].cpuPct, 7);    // 새 샘플이 꼬리
});

test('프룬: DB 에서 사라진 서브도메인의 버퍼는 다음 tick 에 삭제', async () => {
    const h = harness({ rows: [{ id: 1, subdomain: 'sodamfn' }] });
    h.collector.buffers.set('deleted-project', [{ ts: BASE, cpuPct: 1, memMiB: 1 }]);
    h.statsOutput = '';
    await h.collector.tick();
    assert.strictEqual(h.collector.buffers.has('deleted-project'), false);
});

// ── 4. 실패 격리 + 겹침 가드 ────────────────────────────────────────

test('docker stats 실패: tick 은 throw 하지 않고 샘플만 없음', async () => {
    const h = harness();
    h.statsError = new Error('docker hung / timeout');
    await assert.doesNotReject(h.collector.tick());
    assert.strictEqual(h.collector.buffers.size, 0);
    assert.strictEqual(h.selects.length, 1); // SELECT 까지는 진행됨
});

test('DB SELECT 실패: tick 은 throw 하지 않음', async () => {
    const c = new MetricsCollector({
        db: { query: async () => { throw new Error('pg down'); } },
        collectStats: async () => '',
        now: () => BASE + MIN,
    });
    await assert.doesNotReject(c.tick());
});

test('겹침 tick 가드: 이전 tick 이 hung 이면 다음 tick 은 즉시 no-op', async () => {
    const h = harness();
    let release;
    h.statsPromise = new Promise((resolve) => { release = resolve; });
    const first = h.collector.tick();   // collectStats 에서 대기 중
    await h.collector.tick();           // 겹침 — 즉시 반환해야 함
    assert.strictEqual(h.statsCalls, 1);
    assert.strictEqual(h.selects.length, 1);
    release('');
    await first;
    // 가드 해제 후 정상 동작
    h.statsPromise = null;
    await h.collector.tick();
    assert.strictEqual(h.statsCalls, 2);
});

// ── 5. 시간 경계 집계 ──────────────────────────────────────────────

// 스크립트: H0 안에서 3 tick (cpu 10/20/30, mem 100/300/200) → H1 진입 tick
async function runScriptedHour(h) {
    const samples = [[10, 100], [20, 300], [30, 200]];
    for (let i = 0; i < samples.length; i++) {
        h.nowMs = BASE + (i + 1) * MIN;
        h.statsOutput = line('orbitron-sodamfn-mrkohf1c', `${samples[i][0]}.00%`, `${samples[i][1]}MiB / 62GiB`);
        await h.collector.tick();
    }
    // 시간 경계 통과
    h.nowMs = BASE + HOUR + MIN;
    h.statsOutput = line('orbitron-sodamfn-mrkohf1c', '5.00%', '50MiB / 62GiB');
    await h.collector.tick();
}

test('시간 경계: avg/max/samples 계산 + INSERT 파라미터 + retention DELETE 고정', async () => {
    const h = harness();
    await runScriptedHour(h);

    assert.strictEqual(h.writes.length, 2); // INSERT 1 + DELETE 1
    const [ins, del] = h.writes;
    assert.match(ins.sql, /INSERT INTO metrics \(project_id, ts_hour, cpu_avg, cpu_max, mem_avg, mem_max, samples\)/);
    assert.match(ins.sql, /ON CONFLICT \(project_id, ts_hour\) DO NOTHING/);
    // tz 불변식: 쓰기는 세션 tz 와 무관하게 UTC 벽시계 naive 로 저장
    assert.match(ins.sql, /to_timestamp\(\$2 \/ 1000\.0\) AT TIME ZONE 'UTC'/);
    //                              [projectId, hourStartMs, cpuAvg, cpuMax, memAvg, memMax, samples]
    assert.deepStrictEqual(ins.params, [1, BASE, 20, 30, 200, 300, 3]);
    assert.match(del.sql, /DELETE FROM metrics WHERE ts_hour < \(NOW\(\) AT TIME ZONE 'UTC'\) - INTERVAL '30 days'/);
    assert.strictEqual(del.params, undefined);

    // 집계 후 커서 전진 — 같은 시간대는 재집계하지 않음
    assert.strictEqual(h.collector.lastHourStart, BASE + HOUR);
    h.nowMs = BASE + HOUR + 2 * MIN;
    await h.collector.tick();
    assert.strictEqual(h.writes.length, 2);
});

test('샘플 없는 서브도메인/시간대는 INSERT 생략 (raw 도, 빈 행도 DB 에 없음)', async () => {
    const h = harness({ rows: [{ id: 1, subdomain: 'sodamfn' }, { id: 2, subdomain: 'idle' }] });
    await runScriptedHour(h); // 'idle' 은 stats 에 등장하지 않음
    const inserts = h.writes.filter((w) => /INSERT/.test(w.sql));
    assert.strictEqual(inserts.length, 1);
    assert.strictEqual(inserts[0].params[0], 1);
});

test('집계 실패 격리: throw 없이 다음 tick 재시도, 버퍼 보존', async () => {
    const h = harness();
    h.failInserts = true;
    await runScriptedHour(h);
    assert.strictEqual(h.writes.length, 0);                    // DELETE 도 미실행 (INSERT 에서 중단)
    assert.strictEqual(h.collector.lastHourStart, BASE);       // 커서 미전진 → 재시도 예약
    assert.strictEqual(h.collector.buffers.get('sodamfn').length, 4); // 버퍼 무손실

    // 복구 후 다음 tick 에 H0 데이터로 재시도 성공
    h.failInserts = false;
    h.nowMs = BASE + HOUR + 2 * MIN;
    h.statsOutput = '';
    await h.collector.tick();
    const ins = h.writes.find((w) => /INSERT/.test(w.sql));
    assert.deepStrictEqual(ins.params, [1, BASE, 20, 30, 200, 300, 3]);
    assert.strictEqual(h.collector.lastHourStart, BASE + HOUR);
});

test('다중 시간 경계 catch-up: 밀린 시간대를 각각 집계', async () => {
    const h = harness();
    h.failInserts = true;
    await runScriptedHour(h); // H0 집계 실패, H1 에 cpu 5 / mem 50 샘플 1개
    // H2 로 점프 후 복구
    h.failInserts = false;
    h.nowMs = BASE + 2 * HOUR + MIN;
    h.statsOutput = '';
    await h.collector.tick();

    const inserts = h.writes.filter((w) => /INSERT/.test(w.sql));
    assert.strictEqual(inserts.length, 2);
    assert.deepStrictEqual(inserts[0].params, [1, BASE, 20, 30, 200, 300, 3]);        // H0
    assert.deepStrictEqual(inserts[1].params, [1, BASE + HOUR, 5, 5, 50, 50, 1]);     // H1
    assert.strictEqual(h.collector.lastHourStart, BASE + 2 * HOUR);
});

// ── 6. getSeries / getUnaggregatedTail / parseRange ────────────────

test('getSeries: rangeMs 기준 슬라이싱', () => {
    let nowMs = BASE + 3 * HOUR;
    const c = new MetricsCollector({ db: {}, collectStats: async () => '', now: () => nowMs });
    const buf = [
        { ts: BASE, cpuPct: 1, memMiB: 10 },
        { ts: BASE + 2 * HOUR + 30 * MIN, cpuPct: 2, memMiB: 20 },
        { ts: BASE + 3 * HOUR - MIN, cpuPct: 3, memMiB: 30 },
    ];
    c.buffers.set('sodamfn', buf);
    assert.deepStrictEqual(c.getSeries('sodamfn', HOUR).map((p) => p.cpuPct), [2, 3]);
    assert.deepStrictEqual(c.getSeries('sodamfn', 24 * HOUR).map((p) => p.cpuPct), [1, 2, 3]);
    assert.deepStrictEqual(c.getSeries('unknown', HOUR), []);
});

test('getUnaggregatedTail: 마지막 집계 경계 이후의 포인트만', async () => {
    const h = harness();
    await runScriptedHour(h); // 집계 완료, H1 에 샘플 1개 (cpu 5)
    assert.deepStrictEqual(h.collector.getUnaggregatedTail('sodamfn').map((p) => p.cpuPct), [5]);
    assert.deepStrictEqual(h.collector.getUnaggregatedTail('unknown'), []);
});

test('getAggregates: EXTRACT(EPOCH) SQL 고정 + 숫자 epoch ms 반환 (tz/파서 무의존)', async () => {
    const captured = [];
    const c = new MetricsCollector({
        db: {
            query: async (sql, params) => {
                captured.push({ sql, params });
                // EXTRACT(EPOCH ...) 는 numeric → pg 가 문자열로 반환하는 것을 재현
                return { rows: [{ ts_ms: String(BASE), cpu_avg: 20, cpu_max: 30, mem_avg: 200, mem_max: 300, samples: 3 }] };
            },
        },
        collectStats: async () => '',
        now: () => BASE,
    });
    const rows = await c.getAggregates(7);
    assert.strictEqual(captured.length, 1);
    // 읽기는 naive ts_hour 를 UTC 로 간주하는 epoch 추출 — Date 파싱/세션 tz 미개입
    assert.match(captured[0].sql, /EXTRACT\(EPOCH FROM ts_hour\) \* 1000 AS ts_ms/);
    assert.match(captured[0].sql, /INTERVAL '7 days'/);
    assert.deepStrictEqual(captured[0].params, [7]);
    assert.deepStrictEqual(rows, [{ ts: BASE, cpu_avg: 20, cpu_max: 30, mem_avg: 200, mem_max: 300, samples: 3 }]);
    assert.strictEqual(typeof rows[0].ts, 'number');
});

test('parseRange: 기본 24h, 1h/24h/7d 허용, 그 외 null', () => {
    assert.deepStrictEqual(parseRange(undefined), { key: '24h', ms: 24 * HOUR });
    assert.deepStrictEqual(parseRange(''), { key: '24h', ms: 24 * HOUR });
    assert.deepStrictEqual(parseRange('1h'), { key: '1h', ms: HOUR });
    assert.deepStrictEqual(parseRange('24h'), { key: '24h', ms: 24 * HOUR });
    assert.deepStrictEqual(parseRange('7d'), { key: '7d', ms: 7 * 24 * HOUR });
    assert.strictEqual(parseRange('30d'), null);
    assert.strictEqual(parseRange('abc'), null);
});

test('hourStartMs: UTC 시간 경계 내림', () => {
    assert.strictEqual(hourStartMs(BASE), BASE);
    assert.strictEqual(hourStartMs(BASE + MIN), BASE);
    assert.strictEqual(hourStartMs(BASE + HOUR - 1), BASE);
    assert.strictEqual(hourStartMs(BASE + HOUR), BASE + HOUR);
});

// ── 7. start/stop 라이프사이클 ─────────────────────────────────────

test('start 는 idempotent, stop 은 타이머 해제', () => {
    const c = new MetricsCollector({ db: {}, collectStats: async () => '', now: Date.now });
    c.start();
    const t = c.timer;
    assert.ok(t);
    c.start();
    assert.strictEqual(c.timer, t); // 두 번째 start 는 no-op
    c.stop();
    assert.strictEqual(c.timer, null);
    c.stop(); // idempotent
});

test('싱글턴 export 관례 (buildQueue/monitor 와 동일)', () => {
    assert.ok(metricsSingleton instanceof MetricsCollector);
    assert.strictEqual(typeof metricsSingleton.start, 'function');
    assert.strictEqual(metricsSingleton.TICK_INTERVAL_MS, 60 * 1000);
    assert.strictEqual(metricsSingleton.RING_SLOTS, 1440);
});
