'use strict';

// 능동 헬스 모니터링 + 제한된 자동 재시작 (Task 2.2, 프로브 경로 재작업 Task 4.2)
//
// 60초마다 실행 중인 웹 프로젝트를 nginx 경유(실제 서빙 경로)로 프로브한다:
//   GET http://127.0.0.1:80/  +  Host: <subdomain>.<TUNNEL_DOMAIN>
//
// 판정 테이블 (프로세스 수준 liveness — 앱 로직 오류엔 개입하지 않는다):
//   어떤 HTTP 응답 (500 포함)  → 살아있음 (nginx 가 앱의 500 을 중계했다는
//                                것 자체가 앱이 응답했다는 증거)
//   301 등 3xx                → 살아있음 (custom-domain 리다이렉트 프로젝트는
//                                터널 Host 에 nginx 가 직접 301 을 돌려준다 —
//                                redirect:'manual' 이므로 응답으로 관찰됨)
//   502 / 504                 → 죽음 (nginx 가 업스트림 컨테이너에 도달 못 함)
//   X-Orbitron-Default 헤더    → 죽음 (default.conf 의 catch-all 이 응답했다는
//                                마커 = 이 Host 를 받는 프로젝트 conf 가 없음.
//                                랜딩 페이지 200 을 살아있음으로 오판하지 않음)
//   숫자 status 없는 이상 응답 → 죽음 (fail-closed)
//   네트워크 오류/타임아웃     → 죽음 — 단, tick 첫머리의 sentinel 프로브
//                                (SENTINEL_HOST 상수 주석 참고)가 nginx 자체
//                                다운을 먼저 감지하면 per-project 판정을 아예
//                                하지 않는다 (공유 운명 오판 방지 서킷 브레이커)
//
// host-mapped 포트(127.0.0.1:<project.port>)를 직접 찌르면 안 되는 이유:
// PORT env 를 무시하고 내부 포트(예: 8000)에 하드코딩된 앱은 host 포트로는
// 도달 불가지만, nginx 는 리슨 포트 자동 감지(nginx.js)로 컨테이너 내부
// 포트에 정상 프록시한다. 직접 프로브는 이런 멀쩡한 앱을 죽은 것으로 오판해
// 재시작 + unhealthy 처리했다 (실장애: suit/twinland/joojooland, 2026-07).
// nginx 경유 프로브는 포트 매핑과 무관하게 모든 프로젝트에 동작하고,
// nginx conf 유실(외부에서 실제로 죽은 상태)도 함께 잡는다.
//
// 프로젝트별 상태 머신 (in-memory, 연속 실패 카운터):
//   fail 1..2               → 관찰만
//   fail 3  (일반 컨테이너)  → docker restart 1회 (outage 당 딱 1회)
//   fail 3  (compose-*)     → 재시작 금지, status='unhealthy' + 알림
//   fail 6  (일반 컨테이너)  → status='unhealthy' + 마지막 오류 포함 알림
//   fail 7+                 → unhealthy 유지, 쿨다운(30분) 지나면 재알림
//   success                 → 카운터 리셋; 우리가 unhealthy 로 내렸었다면
//                             status='running' 복원 + 복구 알림(outage 당 1회,
//                             쿨다운 면제)
//
// 안전 규칙:
//   - 배포 중(deployer.isDeploying)인 프로젝트는 건드리지 않는다.
//   - DB 쓰기는 running↔unhealthy 전이뿐이며 WHERE status IN
//     ('running','unhealthy') 재가드로 building/stopped 를 절대 덮지 않는다.
//   - compose-manual-* (수동 등록 스택) 포함 모든 compose-* 는 자동 재시작 금지.
//   - tick() 은 어떤 경우에도 throw 하지 않는다 (서버 프로세스 보호).
//
// 테스트 주입 지점: constructor deps { db, checkHttp, restartContainer,
// alert, isDeploying, now } — buildQueue.js 의 싱글턴+클래스 export 관례를 따름.
// 프로덕션 기본값은 lazy require (테스트 환경엔 node_modules 가 없을 수 있음).

const http = require('http');

const TICK_INTERVAL_MS = 60 * 1000;
const PROBE_TIMEOUT_MS = 5000;
// nginx 경유 프로브 대상 — Host 헤더로 프로젝트를 구분한다 (위 헤더 주석 참고).
const PROBE_URL = 'http://127.0.0.1:80/';
// nginx.js 와 동일한 소스 (server_name <subdomain>.<TUNNEL_DOMAIN> 생성 규칙)
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'twinverse.org';
// nginx 가 업스트림에 도달하지 못했다는 뜻의 상태 코드 — 이것만 "죽음"이다.
const UPSTREAM_DEAD_STATUSES = new Set([502, 504]);
// ── nginx 다운 서킷 브레이커 ────────────────────────────────────────────
// nginx 경유 프로브는 nginx 를 공유 운명으로 만든다: nginx 가 죽으면 전
// 프로젝트가 네트워크 오류 → 건강한 컨테이너 대량 재시작 + 알림 폭풍.
// 매 tick 첫머리에 어떤 프로젝트와도 매칭될 수 없는 Host(.invalid TLD)로
// sentinel 프로브 1회를 보낸다:
//   응답 + orbitronDefault=true  → nginx 정상 + default.conf 마커 배포 확인
//                                  → 정상 흐름 진행
//   응답 + 마커 없음/false        → nginx 는 살아있으나 마커 미배포 —
//                                  정상 진행(inert-safe) + 프로세스당 1회 warn
//   네트워크 오류                 → nginx 자체 다운: per-project 카운터/프로브/
//                                  재시작 일절 없이 '🚨 nginx down' 알림만
//                                  (쿨다운 30분, 복구 시 리셋 → outage 당 1회)
const SENTINEL_HOST = 'orbitron-monitor-sentinel.invalid';
const RESTART_THRESHOLD = 3;   // 3번째 연속 실패에 1회 재시작 (compose 는 unhealthy)
const UNHEALTHY_THRESHOLD = 6; // 6번째 연속 실패에 unhealthy 확정
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

// 감시 대상: 실행 중(또는 우리가 unhealthy 로 내린) 웹 프로젝트.
// - DB 프로젝트(type db_postgres/db_redis)는 HTTP 가 없으므로 제외.
// - pixel_streaming 은 type 컬럼이 아니라 env_vars.PROJECT_TYPE 에 저장되므로
//   (routes/projects.js 참고) SQL 로 거를 수 없어 JS 쪽에서 제외한다.
// - building/stopped/failed 등은 SELECT 단계에서 이미 제외.
// - port 는 nginx 경유 프로브 이후 프로브 자체엔 쓰이지 않지만, 알림 본문
//   (_where)의 식별 정보 + "포트 있는 웹 프로젝트만 감시" 필터로 계속 쓴다
//   (워커 등 nginx conf 가 없는 프로젝트를 대상에서 걸러내는 역할).
const SELECT_TARGETS_SQL =
    "SELECT id, name, subdomain, port, container_id, status, env_vars FROM projects " +
    "WHERE status IN ('running', 'unhealthy') " +
    "AND (type IS NULL OR type NOT IN ('db_postgres', 'db_redis')) " +
    "AND port IS NOT NULL";

// 기본 프로브 — node:http 직접 사용. 응답이 오면 { status } resolve,
// 네트워크 오류/타임아웃이면 reject.
//
// ⚠️ fetch 를 쓰면 안 되는 이유: WHATWG fetch(undici)는 Host 를 forbidden
// header 로 취급해 "조용히 제거"한다. Host 없이 127.0.0.1:80 을 치면 모든
// 프로브가 nginx 의 첫 매칭 server 블록(default server)으로 붕괴 — 프로젝트
// 구분이 사라져 함대 전체를 죽은 것으로 오판하고 대량 재시작을 일으킨다.
// node:http 는 headers 의 Host 를 그대로 전송하고, 리다이렉트도 따라가지
// 않으므로(redirect:'manual' 과 동일 의미) 301 이 응답으로 관찰된다.
// 반환 형태: { status, orbitronDefault } — orbitronDefault 는 default.conf
// catch-all 의 X-Orbitron-Default 마커 헤더 존재 여부 (conf 유실 감지).
function defaultCheckHttp(url, { headers } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: 'GET', headers }, (res) => {
            const status = res.statusCode;
            const orbitronDefault = res.headers['x-orbitron-default'] !== undefined;
            res.resume(); // 본문은 쓰지 않음 — 소켓 회수를 위해 즉시 소진
            // SSE 등 끝나지 않는 본문이 풀 소켓을 무한정 물고 있지 않도록:
            // resolve 이후에도 스트림은 흐른다 — 타임아웃 시 강제 회수.
            res.setTimeout(PROBE_TIMEOUT_MS, () => res.destroy());
            res.on('error', () => { /* destroy 로 인한 aborted 등 — 이미 resolve 됨 */ });
            resolve({ status, orbitronDefault });
        });
        req.setTimeout(PROBE_TIMEOUT_MS, () => {
            // destroy(err) → 'error' 이벤트로 전파 → 아래 reject
            req.destroy(new Error(`probe timeout after ${PROBE_TIMEOUT_MS}ms`));
        });
        req.on('error', reject);
        req.end();
    });
}

// 기본 재시작 — docker.js 에는 범용 restart 헬퍼가 없고 배포 경로는 컨테이너를
// 재생성한다. 여기서는 상태 보존형 최소 개입인 `docker restart` 를 쓴다.
async function defaultRestartContainer(project) {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFileAsync = util.promisify(execFile);
    await execFileAsync('docker', ['restart', project.container_id], { timeout: 60000 });
}

class Monitor {
    constructor(deps = {}) {
        // lazy 기본값: 테스트에서 실 DB/deployer/알림을 절대 로드하지 않도록
        this._deps = deps;
        this.checkHttp = deps.checkHttp || defaultCheckHttp;
        this.restartContainer = deps.restartContainer || defaultRestartContainer;
        this.now = deps.now || Date.now;
        this.states = new Map(); // projectId → { failures, restartAttempted, markedUnhealthy, lastAlertAt, lastError }
        this.timer = null;
        this._ticking = false;          // 겹침 tick 가드 (metrics.js 관례 — hung 프로브 축적 방지)
        this.lastNginxAlertAt = null;   // nginx-down 알림 쿨다운 (sentinel 서킷 브레이커)
        this._sentinelMarkerWarned = false; // 마커 미배포 경고는 프로세스당 1회
    }

    _db() {
        return this._deps.db || require('../db/db');
    }

    _alert(title, body) {
        const alert = this._deps.alert || require('./alerts').sendAlert;
        return alert(title, body);
    }

    _isDeploying(projectId) {
        if (this._deps.isDeploying) return this._deps.isDeploying(projectId);
        return require('./deployer').isDeploying(projectId);
    }

    start() {
        if (this.timer) return;
        // tick() 은 절대 reject 하지 않으므로 fire-and-forget 안전
        this.timer = setInterval(() => { this.tick(); }, TICK_INTERVAL_MS);
        if (this.timer.unref) this.timer.unref(); // 모니터가 프로세스 종료를 막지 않도록
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    // pixel_streaming 프로젝트는 HTTP 프로브 대상이 아님 — env_vars 는 DB 에
    // 통짜 암호화 문자열(jsonb)로 저장되므로 필요할 때만 복호화해서 확인.
    _isPixelStreaming(project) {
        let env = project.env_vars;
        if (env && typeof env === 'string') {
            try {
                const { decrypt } = require('../db/crypto');
                env = JSON.parse(decrypt(env) || '{}');
            } catch { env = {}; }
        }
        return Boolean(env) && env.PROJECT_TYPE === 'pixel_streaming';
    }

    async tick() {
        if (this._ticking) return; // 이전 tick (hung 프로브 등) 진행 중 → 스킵
        this._ticking = true;
        try {
            // ── nginx 다운 서킷 브레이커: sentinel 프로브 1회 ──
            let sentinel;
            try {
                sentinel = await this.checkHttp(PROBE_URL, { headers: { Host: SENTINEL_HOST } });
            } catch (e) {
                // nginx 자체가 다운 — 개별 프로젝트를 프로브하면 전 함대가
                // "죽음"으로 오판돼 대량 재시작이 일어난다. 카운터 미접촉 + 알림만.
                const nowMs = this.now();
                if (this.lastNginxAlertAt === null || nowMs - this.lastNginxAlertAt >= ALERT_COOLDOWN_MS) {
                    this.lastNginxAlertAt = nowMs;
                    await this._alert('🚨 nginx down — 헬스 프로브 전면 보류',
                        `sentinel 프로브(${PROBE_URL}, Host: ${SENTINEL_HOST})가 네트워크 오류로 실패했습니다.\n` +
                        `nginx 자체 다운으로 판단 — 개별 프로젝트 프로브/재시작/unhealthy 마킹을 모두 보류합니다.\n` +
                        `마지막 오류: ${e && e.message ? e.message : e}`);
                }
                return;
            }
            // nginx 정상 → nginx-down 쿨다운 리셋 (다음 outage 는 즉시 알림)
            this.lastNginxAlertAt = null;
            if (!sentinel || !sentinel.orbitronDefault) {
                // 마커 미배포(옛 default.conf) — conf-missing 감지만 비활성인
                // 상태로 정상 진행. 시끄럽지 않게 프로세스당 1회만 경고.
                if (!this._sentinelMarkerWarned) {
                    this._sentinelMarkerWarned = true;
                    console.warn('[monitor] sentinel 응답에 X-Orbitron-Default 헤더가 없음 — default.conf 마커가 아직 배포되지 않아 conf-missing 감지가 비활성 상태입니다');
                }
            }

            const result = await this._db().query(SELECT_TARGETS_SQL);
            const rows = (result && result.rows) || [];
            const seen = new Set();
            for (const project of rows) {
                if (this._isPixelStreaming(project)) continue;
                seen.add(project.id);
                try {
                    await this._checkProject(project);
                } catch (e) {
                    // 개별 프로젝트 점검 실패(DB write 오류 등)가 tick 전체를 죽이면 안 됨
                    console.error(`[monitor] ${project.name} 점검 오류: ${e && e.message ? e.message : e}`);
                }
            }
            // SELECT 에서 사라진 프로젝트(중지/삭제/배포로 building 전환)의
            // 상태는 정리 — 다음에 다시 나타나면 새 outage 로 취급한다.
            for (const id of [...this.states.keys()]) {
                if (!seen.has(id)) this.states.delete(id);
            }
        } catch (e) {
            console.error(`[monitor] tick 실패: ${e && e.message ? e.message : e}`);
        } finally {
            this._ticking = false;
        }
    }

    async _checkProject(project) {
        // 배포/롤백 진행 중엔 컨테이너가 교체되는 중 — 프로브도 재시작도 금지
        if (this._isDeploying(project.id)) return;

        let alive = false;
        let lastError = null;
        try {
            const res = await this.checkHttp(PROBE_URL, {
                headers: { Host: `${project.subdomain}.${TUNNEL_DOMAIN}` },
            });
            // 판정: (a) 502/504 = nginx 가 업스트림 도달 실패, (b) X-Orbitron-
            // Default 마커 = default server 응답(프로젝트 conf 유실 — 랜딩 200
            // 도 외부에선 죽은 상태), (c) 숫자 status 없는 이상 응답(fail-closed)
            // 이면 죽음. 500 등 앱 자체 오류는 "앱이 응답했다"는 증거 — 살아있음.
            // 301 도 살아있음 (custom-domain 리다이렉트는 nginx 직접 응답).
            const status = res && typeof res.status === 'number' ? res.status : null;
            const hitDefaultServer = Boolean(res && res.orbitronDefault);
            alive = !hitDefaultServer && status !== null && !UPSTREAM_DEAD_STATUSES.has(status);
            if (!alive) {
                lastError = hitDefaultServer
                    ? 'nginx conf missing — default server answered'
                    : (status === null
                        ? 'probe returned no numeric status'
                        : `nginx upstream unreachable (HTTP ${status})`);
            }
        } catch (e) {
            lastError = e && e.message ? e.message : String(e);
        }

        const state = this.states.get(project.id) || {
            failures: 0, restartAttempted: false, markedUnhealthy: false,
            lastAlertAt: null, lastError: null,
        };

        if (alive) {
            // markedUnhealthy 는 in-memory 라 서버 재시작 시 소실 — DB 에
            // 'unhealthy' 로 남아있는 행(row status)도 복원 대상으로 본다.
            if (state.markedUnhealthy || project.status === 'unhealthy') {
                await this._setStatus(project.id, 'running');
                // 복구 알림: 쿨다운 면제, state 삭제 + status 복원으로 outage 당 1회 보장
                await this._alert(`✅ ${project.name} 복구됨`,
                    `${this._where(project)}\n헬스체크 정상 응답 — status 를 'running' 으로 복원했습니다.`);
            }
            this.states.delete(project.id);
            return;
        }

        state.failures += 1;
        if (lastError) state.lastError = lastError;
        this.states.set(project.id, state);

        const isCompose = typeof project.container_id === 'string'
            && project.container_id.startsWith('compose-');

        if (isCompose) {
            // compose 스택(수동 등록 compose-manual-* 포함)은 절대 자동 재시작 금지
            if (state.failures >= RESTART_THRESHOLD) {
                if (!state.markedUnhealthy) await this._setStatus(project.id, 'unhealthy');
                state.markedUnhealthy = true;
                await this._maybeAlert(project, state,
                    `🚨 ${project.name} 응답 없음 (compose)`,
                    `${this._where(project)}\n연속 ${state.failures}회 헬스체크 실패 — compose 스택은 자동 재시작하지 않습니다. 수동 확인이 필요합니다.\n마지막 오류: ${state.lastError || 'HTTP 응답 없음'}`);
            }
            return;
        }

        if (state.failures === RESTART_THRESHOLD && !state.restartAttempted) {
            state.restartAttempted = true; // outage 당 재시작은 단 1회
            console.log(`[monitor] ${project.name}: 연속 ${state.failures}회 실패 → docker restart 시도 (${project.container_id})`);
            try {
                await this.restartContainer(project);
            } catch (e) {
                console.error(`[monitor] ${project.name} 재시작 실패: ${e && e.message ? e.message : e}`);
            }
            return;
        }

        if (state.failures >= UNHEALTHY_THRESHOLD) {
            if (!state.markedUnhealthy) await this._setStatus(project.id, 'unhealthy');
            state.markedUnhealthy = true;
            await this._maybeAlert(project, state,
                `🚨 ${project.name} 응답 없음`,
                `${this._where(project)}\n연속 ${state.failures}회 헬스체크 실패 (자동 재시작 1회 시도 후에도 실패) — status='unhealthy'.\n마지막 오류: ${state.lastError || 'HTTP 응답 없음'}`);
        }
    }

    // 알림 본문 공통 헤더 — 어떤 프로젝트/어디를 프로브했는지 한 줄로 식별
    _where(project) {
        return `프로젝트: ${project.subdomain || project.name} (port ${project.port})`;
    }

    // running↔unhealthy 전이만 허용 — building/stopped 등은 재가드로 절대 덮지 않음
    async _setStatus(projectId, status) {
        await this._db().query(
            "UPDATE projects SET status = $1 WHERE id = $2 AND status IN ('running', 'unhealthy')",
            [status, projectId]
        );
    }

    // 장애 알림은 프로젝트당 30분 쿨다운 (알림 폭풍 방지)
    async _maybeAlert(project, state, title, body) {
        const nowMs = this.now();
        if (state.lastAlertAt !== null && nowMs - state.lastAlertAt < ALERT_COOLDOWN_MS) return;
        state.lastAlertAt = nowMs;
        await this._alert(title, body);
    }
}

const monitor = new Monitor();
monitor.Monitor = Monitor; // 테스트에서 독립 인스턴스 생성용 (buildQueue.js 관례)
monitor.TICK_INTERVAL_MS = TICK_INTERVAL_MS;
monitor.PROBE_URL = PROBE_URL;
monitor.TUNNEL_DOMAIN = TUNNEL_DOMAIN;
monitor.SENTINEL_HOST = SENTINEL_HOST;
monitor.ALERT_COOLDOWN_MS = ALERT_COOLDOWN_MS;
monitor.RESTART_THRESHOLD = RESTART_THRESHOLD;
monitor.UNHEALTHY_THRESHOLD = UNHEALTHY_THRESHOLD;
module.exports = monitor;
