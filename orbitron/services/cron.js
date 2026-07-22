'use strict';

// 예약 작업(cron) 실행기 (Task 3.3)
//
// scheduled_jobs 테이블의 활성 작업을 분 단위로 평가해 프로젝트 컨테이너
// 안에서 실행한다: execFile('docker', ['exec', <container_id>, 'sh', '-c',
// <command>]) — command 는 **argv 원소 하나**로만 전달되며 호스트 셸에
// 절대 보간되지 않는다 (셸 해석은 컨테이너 안의 sh 만 수행).
//
// ── tick 정렬 / drift 처리 ──────────────────────────────────────────────
// start() 는 다음 분 경계(:00)까지 setTimeout 으로 기다린 뒤 60s setInterval
// 을 건다. setInterval 은 이벤트 루프 부하로 뒤로 밀릴 수 있으므로(:00 에서
// 서서히 :07 로 drift) tick 은 "지금이 몇 번째 분인가"를 now() 로 직접
// 계산하고 lastEvaluatedMinute 커서로 평가를 추적한다:
//   - currentMinute <= lastEvaluatedMinute → 같은 분에 두 번 깨어남
//     (double-fire) → no-op. 한 분은 정확히 한 번만 평가된다.
//   - 커서와 현재 사이에 구멍이 생기면 (hung exec 로 tick 이 밀린 경우 등)
//     last+1..current 를 모두 평가해 놓친 분의 작업도 실행한다 — 단
//     **최대 5분까지만** backfill 하고, 그보다 오래된 분은 건너뛰며 로그를
//     남긴다 (서버가 오래 멈췄다 깨어났을 때 몇 시간치 작업이 한꺼번에
//     쏟아지는 것을 방지). 한 tick 에서 여러 분에 걸쳐 due 인 작업도
//     1회만 실행한다.
//
// ── 실행 규칙 ───────────────────────────────────────────────────────────
//   - 대상: enabled=true + 프로젝트 status='running' + container_id 존재.
//   - compose 프로젝트(container_id 'compose-*')는 실제 컨테이너 id 가
//     아니므로 실행하지 않고 last_status='skipped' 로 기록 + 로그.
//   - 타임아웃 60s (execFile timeout + SIGKILL — docker CLI 가 SIGTERM 을
//     무시하고 살아남는 것 방지). 출력(stdout+stderr)은 4KB 로 잘라
//     last_output 에 저장.
//   - 실패는 alerts.sendAlert 로 알림. monitor.js 의 30분 쿨다운은 **재사용
//     하지 않는다** — cron 실패는 실행할 때마다 알린다. 단 due 목록이
//     작업당 1개이므로 tick 당 작업당 알림은 최대 1회다.
//   - 동시 실행: tick 안에서 최대 2개 동시(간단한 워커 풀 세마포어).
//     같은 작업의 이전 실행이 아직 도는 중이면 스킵 (in-memory running set —
//     수동 트리거(runNow)와도 공유되는 겹침 가드).
//   - tick() 은 어떤 경우에도 throw 하지 않는다 (monitor/metrics 관례).
//
// 킬스위치: CRON_JOBS=off (server.js 에서 start 를 건너뜀).
// 테스트 주입 지점: constructor deps { db, execInContainer, now, alert } —
// monitor.js / metrics.js 의 싱글턴+클래스 export 관례.

const TICK_INTERVAL_MS = 60 * 1000;
const EXEC_TIMEOUT_MS = 60 * 1000;
const MAX_OUTPUT_CHARS = 4096;        // last_output 저장 상한 (4KB)
const MAX_BACKFILL_MINUTES = 5;       // 놓친 분 따라잡기 상한
const MAX_CONCURRENT_JOBS = 2;        // tick 당 동시 실행 상한

// 실행 대상: 활성 작업 × 실행 중 + 컨테이너 보유 프로젝트.
// compose-* 걸러내기는 JS 쪽에서 (skipped 기록을 남기기 위해 SELECT 에 포함).
const SELECT_ELIGIBLE_SQL =
    'SELECT j.id, j.project_id, j.name, j.schedule, j.command, ' +
    'p.container_id, p.subdomain, p.name AS project_name ' +
    'FROM scheduled_jobs j JOIN projects p ON p.id = j.project_id ' +
    "WHERE j.enabled = true AND p.status = 'running' AND p.container_id IS NOT NULL " +
    'ORDER BY j.id';

const UPDATE_RESULT_SQL =
    'UPDATE scheduled_jobs SET last_status = $1, last_output = $2, ' +
    'last_run_at = to_timestamp($3 / 1000.0), updated_at = NOW() WHERE id = $4';

// 기본 실행기 — docker exec, command 는 단일 argv 원소 (호스트 셸 미경유)
async function defaultExecInContainer(containerId, command) {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFileAsync = util.promisify(execFile);
    // killSignal SIGKILL: 타임아웃 시 SIGTERM 을 무시하는 프로세스도 확실히 종료
    const { stdout, stderr } = await execFileAsync(
        'docker', ['exec', containerId, 'sh', '-c', command],
        { timeout: EXEC_TIMEOUT_MS, maxBuffer: 1024 * 1024, killSignal: 'SIGKILL' }
    );
    return { stdout, stderr };
}

function truncateOutput(text) {
    const s = String(text || '');
    if (s.length <= MAX_OUTPUT_CHARS) return s;
    const marker = '\n…[output truncated to 4KB]';
    return s.slice(0, MAX_OUTPUT_CHARS - marker.length) + marker;
}

class CronRunner {
    constructor(deps = {}) {
        // lazy 기본값: 테스트에서 실 DB/docker/알림을 절대 로드하지 않도록
        this._deps = deps;
        this.execInContainer = deps.execInContainer || defaultExecInContainer;
        this.now = deps.now || Date.now;
        this.running = new Set();        // job id — tick/수동 실행 공용 겹침 가드
        this.lastEvaluatedMinute = null; // 마지막으로 평가를 마친 epoch-minute
        this.timer = null;
        this._alignTimer = null;
        this._ticking = false;           // hung exec 로 tick 이 겹치지 않도록
    }

    _db() {
        return this._deps.db || require('../db/db');
    }

    _alert(title, body) {
        const alert = this._deps.alert || require('./alerts').sendAlert;
        return alert(title, body);
    }

    start() {
        if (this.timer || this._alignTimer) return;
        // 분 경계 정렬: 다음 :00 까지 기다렸다가 첫 tick + 60s interval.
        // 이후의 drift 는 tick 내부의 lastEvaluatedMinute 커서가 흡수한다
        // (모듈 헤더 주석 참고).
        const delay = TICK_INTERVAL_MS - (this.now() % TICK_INTERVAL_MS);
        this._alignTimer = setTimeout(() => {
            this._alignTimer = null;
            this.tick(); // tick() 은 절대 reject 하지 않으므로 fire-and-forget 안전
            this.timer = setInterval(() => { this.tick(); }, TICK_INTERVAL_MS);
            if (this.timer.unref) this.timer.unref(); // 프로세스 종료를 막지 않도록
        }, delay);
        if (this._alignTimer.unref) this._alignTimer.unref();
    }

    stop() {
        if (this._alignTimer) {
            clearTimeout(this._alignTimer);
            this._alignTimer = null;
        }
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async tick() {
        if (this._ticking) return; // 이전 tick (hung exec 등) 진행 중 → 스킵
        this._ticking = true;
        try {
            const currentMinute = Math.floor(this.now() / TICK_INTERVAL_MS);
            // double-fire 가드: 같은 분에 두 번 깨어나면 두 번째는 no-op
            if (this.lastEvaluatedMinute !== null && currentMinute <= this.lastEvaluatedMinute) return;

            // 평가 창: last+1 .. current (첫 tick 은 현재 분만).
            let fromMinute = this.lastEvaluatedMinute === null
                ? currentMinute
                : this.lastEvaluatedMinute + 1;
            const span = currentMinute - fromMinute + 1;
            if (span > MAX_BACKFILL_MINUTES) {
                console.warn(`[cron] tick 지연으로 ${span}분 누락 — 최근 ${MAX_BACKFILL_MINUTES}분만 평가하고 ${span - MAX_BACKFILL_MINUTES}분은 건너뜁니다`);
                fromMinute = currentMinute - MAX_BACKFILL_MINUTES + 1;
            }
            this.lastEvaluatedMinute = currentMinute;

            const result = await this._db().query(SELECT_ELIGIBLE_SQL);
            const rows = (result && result.rows) || [];

            // due 판정 — 여러 분에 걸쳐 due 여도 작업당 1회만 (break)
            const cronRules = require('./cronRules');
            const due = [];
            for (const job of rows) {
                const parsed = cronRules.parseCronExpression(job.schedule);
                if (!parsed) {
                    console.warn(`[cron] ${job.name} (#${job.id}): 잘못된 schedule '${job.schedule}' — 건너뜀`);
                    continue;
                }
                for (let m = fromMinute; m <= currentMinute; m++) {
                    if (cronRules.cronMatches(parsed, new Date(m * TICK_INTERVAL_MS))) {
                        due.push(job);
                        break;
                    }
                }
            }
            if (due.length === 0) return;

            // 워커 풀 세마포어 — 동시 실행 최대 MAX_CONCURRENT_JOBS
            let next = 0;
            const workers = [];
            for (let w = 0; w < Math.min(MAX_CONCURRENT_JOBS, due.length); w++) {
                workers.push((async () => {
                    while (next < due.length) {
                        const job = due[next++];
                        try {
                            await this._runJob(job);
                        } catch (e) {
                            // _runJob 은 자체 격리하지만 이중 방어 — tick 은 절대 죽지 않는다
                            console.error(`[cron] ${job.name} 실행 오류: ${e && e.message ? e.message : e}`);
                        }
                    }
                })());
            }
            await Promise.all(workers);
        } catch (e) {
            console.error(`[cron] tick 실패: ${e && e.message ? e.message : e}`);
        } finally {
            this._ticking = false;
        }
    }

    // 작업 1개 실행 + 결과 기록. tick 과 수동 트리거(runNow) 공용.
    // 반환: { status: 'success'|'failed'|'skipped'|'running', output }
    async _runJob(job) {
        // 겹침 가드: 같은 작업의 이전 실행(이전 tick 또는 수동)이 아직 진행 중
        if (this.running.has(job.id)) {
            console.warn(`[cron] ${job.name} (#${job.id}): 이전 실행이 아직 진행 중 — 이번 회차 스킵`);
            return { status: 'running', output: '' };
        }

        // compose 프로젝트: container_id 'compose-<hash>' 는 실제 컨테이너가
        // 아니므로 docker exec 불가 — skipped 기록만 남긴다.
        if (typeof job.container_id === 'string' && job.container_id.startsWith('compose-')) {
            const note = 'compose 프로젝트는 cron 작업을 지원하지 않습니다 (container_id 가 실제 컨테이너가 아님). / compose-managed project — skipped.';
            console.warn(`[cron] ${job.name} (#${job.id}): compose 프로젝트 — skipped`);
            await this._record(job.id, 'skipped', note);
            return { status: 'skipped', output: note };
        }

        this.running.add(job.id);
        try {
            let status;
            let output;
            try {
                const res = await this.execInContainer(job.container_id, job.command);
                status = 'success';
                output = truncateOutput(((res && res.stdout) || '') + ((res && res.stderr) || ''));
            } catch (e) {
                status = 'failed';
                const captured = ((e && e.stdout) || '') + ((e && e.stderr) || '');
                const reason = e && e.killed
                    ? `[timeout] ${EXEC_TIMEOUT_MS / 1000}s 초과로 강제 종료 (SIGKILL)`
                    : `[error] ${e && e.message ? e.message : e}`;
                output = truncateOutput(`${reason}\n${captured}`.trim());
            }

            await this._record(job.id, status, output);

            if (status === 'failed') {
                // 쿨다운 없음(의도): cron 실패는 매 실행마다 알린다. due 목록이
                // 작업당 1개라 tick 당 작업당 알림도 최대 1회.
                await this._alert(`⏰ cron 작업 실패: ${job.name}`,
                    `프로젝트: ${job.subdomain || job.project_name} (#${job.project_id})\n` +
                    `schedule: ${job.schedule}\ncommand: ${String(job.command).slice(0, 200)}\n\n` +
                    `${String(output).slice(0, 1000)}`);
            }
            return { status, output };
        } finally {
            this.running.delete(job.id);
        }
    }

    // 수동 트리거 (routes/cron.js POST /:id/cron/:jobId/run) — 겹침 가드 공유,
    // 결과를 동기 반환 (타임아웃은 execInContainer 의 60s 가 그대로 적용).
    async runNow(job) {
        return this._runJob(job);
    }

    async _record(jobId, status, output) {
        try {
            await this._db().query(UPDATE_RESULT_SQL, [status, output, this.now(), jobId]);
        } catch (e) {
            console.error(`[cron] 작업 #${jobId} 결과 기록 실패: ${e && e.message ? e.message : e}`);
        }
    }
}

const cron = new CronRunner();
cron.CronRunner = CronRunner; // 테스트에서 독립 인스턴스 생성용 (monitor.js 관례)
cron.TICK_INTERVAL_MS = TICK_INTERVAL_MS;
cron.EXEC_TIMEOUT_MS = EXEC_TIMEOUT_MS;
cron.MAX_OUTPUT_CHARS = MAX_OUTPUT_CHARS;
cron.MAX_BACKFILL_MINUTES = MAX_BACKFILL_MINUTES;
cron.MAX_CONCURRENT_JOBS = MAX_CONCURRENT_JOBS;
module.exports = cron;
