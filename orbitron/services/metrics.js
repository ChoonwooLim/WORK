'use strict';

// 컨테이너 리소스 메트릭 수집 + 시간별 집계 (Task 2.3)
//
// 60초마다 `docker stats --no-stream` 을 한 번 실행해 컨테이너별
// CPU%/메모리(MiB)를 서브도메인별 in-memory 링 버퍼(1440슬롯 = 24h)에 적재한다.
//
// HARD RULE (과거 158MB 로그 사건): raw per-minute 샘플은 절대 DB 에 넣지
// 않는다. DB 에는 UTC 시간 경계마다 계산한 1시간 집계(avg/max/samples)만
// INSERT 하고, 같은 배치에서 30일 초과분을 DELETE 해 테이블 크기를 유계로
// 유지한다.
//
// 컨테이너 → 서브도메인 해석:
//   1) 'orbitron-' 접두사가 없으면 무시
//   2) 나머지가 알려진 서브도메인과 정확히 일치하면 그것 (DB 컨테이너
//      orbitron-twinverse-db → 서브도메인 'twinverse-db' 가 이 경로)
//   3) 아니면 마지막 '-<segment>' (blue-green deployhash) 를 떼어본 뒤,
//      "그 나머지가 알려진 서브도메인일 때만" 채택 — twinverse vs
//      twinverseai 같은 접두 함정을 피하고 미지 컨테이너는 스킵
//   서브도메인 Set 은 매 tick DB 에서 로드 (집계에 필요한 project id SELECT
//   와 동일 쿼리). SELECT 에서 사라진 서브도메인의 버퍼는 prune 한다.
//
// 안전 규칙 (monitor.js 관례):
//   - tick() 은 어떤 경우에도 throw 하지 않는다.
//   - hung docker 호출이 쌓이지 않도록 겹침 tick 가드 (_ticking).
//   - 집계 실패는 격리 — lastHourStart 커서를 전진시키지 않아 다음 tick 에
//     같은 시간대부터 재시도한다 (INSERT 는 ON CONFLICT DO NOTHING 이라
//     부분 성공 후 재시도해도 안전). 버퍼는 24h 를 보존하므로 무손실.
//   - 서버 재시작 시 링 버퍼와 커서는 소실 — 재시작 직전의 미집계 시간대
//     (최대 1시간)는 DB 에 남지 않는다 (알려진 데이터 손실 창).
//
// 테스트 주입 지점: constructor deps { db, collectStats, now } —
// buildQueue.js / monitor.js 의 싱글턴+클래스 export 관례를 따름.

const TICK_INTERVAL_MS = 60 * 1000;
const RING_SLOTS = 1440;           // 24h × 60 샘플/시간
const HOUR_MS = 60 * 60 * 1000;
const STATS_TIMEOUT_MS = 30 * 1000;

// 집계에 필요한 project id + 컨테이너 해석용 서브도메인을 한 번에 로드
const SELECT_PROJECTS_SQL =
    'SELECT id, subdomain FROM projects WHERE subdomain IS NOT NULL';

// ts_hour 타임존 불변식 (naive TIMESTAMP 컬럼):
//   쓰기: to_timestamp(ms) 는 timestamptz — `AT TIME ZONE 'UTC'` 로 세션
//         타임존과 무관하게 "UTC 벽시계" naive 값을 저장한다.
//   읽기: EXTRACT(EPOCH FROM naive) 는 값을 UTC 로 간주해 epoch 를 돌려주므로
//         DB 세션 tz / Node tz / pg 타입 파서 어디에도 의존하지 않고 원래
//         epoch ms 가 정확히 왕복한다. (db/db.js 의 1114 파서가 naive 를
//         UTC 로 파싱하는 것과도 일치 — 다른 경로로 읽어도 같은 시각.)
// 재시작/재시도 시 같은 (project_id, ts_hour) 는 ON CONFLICT DO NOTHING 으로 멱등
const INSERT_AGGREGATE_SQL =
    'INSERT INTO metrics (project_id, ts_hour, cpu_avg, cpu_max, mem_avg, mem_max, samples) ' +
    "VALUES ($1, to_timestamp($2 / 1000.0) AT TIME ZONE 'UTC', $3, $4, $5, $6, $7) " +
    'ON CONFLICT (project_id, ts_hour) DO NOTHING';

// 집계와 같은 배치에서 실행 — 테이블은 프로젝트 수 × 24 × 30 행으로 유계.
// ts_hour 가 UTC 벽시계이므로 비교 기준(NOW())도 UTC naive 로 맞춘다.
const RETENTION_DELETE_SQL =
    "DELETE FROM metrics WHERE ts_hour < (NOW() AT TIME ZONE 'UTC') - INTERVAL '30 days'";

// 7d 라우트용 — epoch ms 로 추출해 어떤 tz/파서 의존도 없이 숫자만 반환
const SELECT_AGGREGATES_SQL =
    'SELECT EXTRACT(EPOCH FROM ts_hour) * 1000 AS ts_ms, ' +
    'cpu_avg, cpu_max, mem_avg, mem_max, samples FROM metrics ' +
    "WHERE project_id = $1 AND ts_hour >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days' " +
    'ORDER BY ts_hour ASC';

// docker stats MemUsage 좌변 단위 → MiB 환산 계수
const MEM_UNIT_TO_MIB = {
    B: 1 / (1024 * 1024),
    KiB: 1 / 1024,
    MiB: 1,
    GiB: 1024,
    TiB: 1024 * 1024,
};

// 기본 수집기 — `docker stats` 1회 실행 (30s 타임아웃, lazy require)
async function defaultCollectStats() {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFileAsync = util.promisify(execFile);
    const { stdout } = await execFileAsync('docker',
        ['stats', '--no-stream', '--format', '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'],
        // killSignal SIGKILL: SIGTERM 을 무시하는 docker CLI 가 타임아웃 후에도
        // 살아남아 수집기를 조용히 잠그는 것을 방지
        { timeout: STATS_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, killSignal: 'SIGKILL' });
    return stdout;
}

// 'name\t0.16%\t179.9MiB / 62.75GiB' → { name, cpuPct, memMiB } | null(malformed)
function parseStatsLine(rawLine) {
    if (!rawLine) return null;
    const parts = rawLine.split('\t');
    if (parts.length < 3) return null;
    const name = parts[0].trim();
    if (!name) return null;

    const cpuStr = parts[1].trim();
    if (!/^[0-9.]+%$/.test(cpuStr)) return null;
    const cpuPct = parseFloat(cpuStr.slice(0, -1));
    if (!Number.isFinite(cpuPct)) return null;

    const memLeft = parts[2].split('/')[0].trim(); // '179.9MiB / 62.75GiB' 의 좌변
    const m = memLeft.match(/^([0-9.]+)\s*([A-Za-z]+)$/);
    if (!m) return null;
    const factor = MEM_UNIT_TO_MIB[m[2]];
    if (factor === undefined) return null;
    const memMiB = parseFloat(m[1]) * factor;
    if (!Number.isFinite(memMiB)) return null;

    return { name, cpuPct, memMiB };
}

function parseStatsOutput(stdout) {
    const samples = [];
    for (const rawLine of String(stdout || '').split('\n')) {
        const sample = parseStatsLine(rawLine.trim());
        if (sample) samples.push(sample);
    }
    return samples;
}

// known 은 .has(subdomain) 을 지원하는 Set/Map — 반환: 서브도메인 | null
function resolveSubdomain(containerName, known) {
    if (!containerName || !containerName.startsWith('orbitron-')) return null;
    const rest = containerName.slice('orbitron-'.length);
    if (known.has(rest)) return rest; // 정확 일치 우선 (…-db 서브도메인 포함)
    const idx = rest.lastIndexOf('-');
    if (idx > 0) {
        const base = rest.slice(0, idx); // 트레일링 deployhash 후보 제거
        if (known.has(base)) return base;
    }
    return null;
}

const RANGES = {
    '1h': HOUR_MS,
    '24h': 24 * HOUR_MS,
    '7d': 7 * 24 * HOUR_MS,
};

// 라우트용 range 파싱 — 미지정은 24h 기본, 미허용 값은 null (→ 400)
function parseRange(raw) {
    if (raw === undefined || raw === null || raw === '') {
        return { key: '24h', ms: RANGES['24h'] };
    }
    const key = String(raw).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(RANGES, key)) return null;
    return { key, ms: RANGES[key] };
}

function hourStartMs(ms) {
    return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

class MetricsCollector {
    constructor(deps = {}) {
        // lazy 기본값: 테스트에서 실 DB/docker 를 절대 로드하지 않도록
        this._deps = deps;
        this.collectStats = deps.collectStats || defaultCollectStats;
        this.now = deps.now || Date.now;
        this.buffers = new Map();  // subdomain → [{ ts, cpuPct, memMiB }] (max RING_SLOTS)
        this.lastHourStart = null; // 마지막으로 "집계 완료된" 시간대의 다음 경계 (ms)
        this.timer = null;
        this._ticking = false;     // hung docker 호출 겹침 방지 가드
    }

    _db() {
        return this._deps.db || require('../db/db');
    }

    start() {
        if (this.timer) return;
        // tick() 은 절대 reject 하지 않으므로 fire-and-forget 안전
        this.timer = setInterval(() => { this.tick(); }, TICK_INTERVAL_MS);
        if (this.timer.unref) this.timer.unref(); // 프로세스 종료를 막지 않도록
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async tick() {
        if (this._ticking) return; // 이전 tick (hung docker stats 등) 진행 중 → 스킵
        this._ticking = true;
        try {
            const nowMs = this.now();
            const result = await this._db().query(SELECT_PROJECTS_SQL);
            const rows = (result && result.rows) || [];
            const idBySubdomain = new Map(rows.map((r) => [r.subdomain, r.id]));

            // 1) 수집 — docker stats 실패는 이번 tick 의 샘플만 포기
            let samples = [];
            try {
                samples = parseStatsOutput(await this.collectStats());
            } catch (e) {
                console.error(`[metrics] docker stats 실패: ${e && e.message ? e.message : e}`);
            }
            for (const sample of samples) {
                const subdomain = resolveSubdomain(sample.name, idBySubdomain);
                if (!subdomain) continue;
                let buf = this.buffers.get(subdomain);
                if (!buf) { buf = []; this.buffers.set(subdomain, buf); }
                buf.push({ ts: nowMs, cpuPct: sample.cpuPct, memMiB: sample.memMiB });
                if (buf.length > RING_SLOTS) buf.shift(); // 가장 오래된 슬롯 축출
            }

            // 2) 프룬 — DB 에서 사라진 서브도메인의 버퍼 정리 (fleet churn 에도 유계)
            for (const subdomain of [...this.buffers.keys()]) {
                if (!idBySubdomain.has(subdomain)) this.buffers.delete(subdomain);
            }

            // 3) 시간 경계 집계 — 실패해도 커서를 전진시키지 않고 다음 tick 재시도
            const currentHourStart = hourStartMs(nowMs);
            if (this.lastHourStart === null) {
                // 첫 tick: 진행 중인 시간대부터 추적 시작 (재시작 이전 데이터는 소실)
                this.lastHourStart = currentHourStart;
            } else if (currentHourStart > this.lastHourStart) {
                try {
                    await this._flushThrough(currentHourStart, idBySubdomain);
                } catch (e) {
                    console.error(`[metrics] 시간별 집계 실패 (다음 tick 재시도): ${e && e.message ? e.message : e}`);
                }
            }
        } catch (e) {
            console.error(`[metrics] tick 실패: ${e && e.message ? e.message : e}`);
        } finally {
            this._ticking = false;
        }
    }

    // lastHourStart..currentHourStart 사이의 완료된 시간대를 순서대로 집계.
    // 시간대 하나가 성공할 때마다 커서 전진 — 중간 실패 시 그 시간대부터 재시도.
    async _flushThrough(currentHourStart, idBySubdomain) {
        while (this.lastHourStart < currentHourStart) {
            const hourStart = this.lastHourStart;
            await this._aggregateHour(hourStart, idBySubdomain);
            this.lastHourStart = hourStart + HOUR_MS;
        }
    }

    async _aggregateHour(hourStart, idBySubdomain) {
        const db = this._db();
        const hourEnd = hourStart + HOUR_MS;
        for (const [subdomain, buf] of this.buffers) {
            const projectId = idBySubdomain.get(subdomain);
            if (projectId === undefined || projectId === null) continue;
            const slice = buf.filter((p) => p.ts >= hourStart && p.ts < hourEnd);
            if (slice.length === 0) continue; // 빈 시간대는 행 자체를 만들지 않음
            let cpuSum = 0, cpuMax = -Infinity, memSum = 0, memMax = -Infinity;
            for (const p of slice) {
                cpuSum += p.cpuPct;
                memSum += p.memMiB;
                if (p.cpuPct > cpuMax) cpuMax = p.cpuPct;
                if (p.memMiB > memMax) memMax = p.memMiB;
            }
            await db.query(INSERT_AGGREGATE_SQL, [
                projectId, hourStart,
                cpuSum / slice.length, cpuMax,
                memSum / slice.length, memMax,
                slice.length,
            ]);
        }
        // 같은 배치에서 30일 초과분 정리 — metrics 테이블 크기 유계 보장
        await db.query(RETENTION_DELETE_SQL);
    }

    // 1h/24h 라우트용 — 링 버퍼에서 now-rangeMs 이후 포인트 (복사본)
    getSeries(subdomain, rangeMs) {
        const buf = this.buffers.get(subdomain);
        if (!buf) return [];
        const cutoff = this.now() - rangeMs;
        return buf.filter((p) => p.ts >= cutoff);
    }

    // 7d 라우트용 — DB 시간별 집계를 epoch ms 숫자로 반환 (tz 의존성 없음).
    // EXTRACT(EPOCH ...) 는 numeric 이라 pg 가 문자열로 주므로 Number() 변환.
    async getAggregates(projectId) {
        const result = await this._db().query(SELECT_AGGREGATES_SQL, [projectId]);
        const rows = (result && result.rows) || [];
        return rows.map((r) => ({
            ts: Number(r.ts_ms),
            cpu_avg: r.cpu_avg, cpu_max: r.cpu_max,
            mem_avg: r.mem_avg, mem_max: r.mem_max,
            samples: r.samples,
        }));
    }

    // 7d 라우트용 — 아직 DB 로 집계되지 않은 꼬리 (마지막 집계 경계 이후)
    getUnaggregatedTail(subdomain) {
        const buf = this.buffers.get(subdomain);
        if (!buf) return [];
        const since = this.lastHourStart !== null ? this.lastHourStart : hourStartMs(this.now());
        return buf.filter((p) => p.ts >= since);
    }
}

const metrics = new MetricsCollector();
metrics.MetricsCollector = MetricsCollector; // 테스트에서 독립 인스턴스 생성용
metrics.parseStatsLine = parseStatsLine;
metrics.parseStatsOutput = parseStatsOutput;
metrics.resolveSubdomain = resolveSubdomain;
metrics.parseRange = parseRange;
metrics.hourStartMs = hourStartMs;
metrics.TICK_INTERVAL_MS = TICK_INTERVAL_MS;
metrics.RING_SLOTS = RING_SLOTS;
metrics.HOUR_MS = HOUR_MS;
module.exports = metrics;
