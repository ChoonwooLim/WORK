'use strict';

// 배포 진행 폴링 상태기계 — 의존성 전부 주입 가능 (test/cli.test.js).
//
// getDeployments() 를 intervalMs 간격으로 호출해 대상 배포 행을 추적:
//   - deploymentId 지정 시 (롤백): 해당 id 행을 추적
//   - sinceId 지정 시 (배포): id > sinceId 인 가장 최신 행이 나타나면 그걸 고정
// status 변화마다 onEvent({type:'status', deployment}) 호출.
// 종료: 'success' | 'failed' → {outcome, deployment}
//        timeoutMs 경과      → {outcome:'timeout', deployment}
//        연속 조회 실패 누적  → {outcome:'error', error}

const TERMINAL_STATUSES = new Set(['success', 'failed']);
const MAX_CONSECUTIVE_ERRORS = 10;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollDeployment({
    getDeployments,
    deploymentId = null,
    sinceId = null,
    intervalMs = 3000,
    timeoutMs = 15 * 60 * 1000,
    sleep = defaultSleep,
    now = Date.now,
    onEvent = () => {},
}) {
    const startedAt = now();
    let targetId = deploymentId;
    let lastStatus = null;
    let lastDeployment = null;
    let consecutiveErrors = 0;

    for (;;) {
        let rows = null;
        try {
            rows = await getDeployments();
            consecutiveErrors = 0;
        } catch (e) {
            consecutiveErrors += 1;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                return { outcome: 'error', error: e, deployment: lastDeployment };
            }
        }

        if (Array.isArray(rows)) {
            let target = null;
            if (targetId != null) {
                target = rows.find((r) => r.id === targetId) || null;
            } else if (sinceId != null) {
                const fresh = rows.filter((r) => typeof r.id === 'number' && r.id > sinceId);
                if (fresh.length > 0) {
                    target = fresh.reduce((a, b) => (a.id > b.id ? a : b));
                    targetId = target.id; // 이후엔 이 행만 추적
                }
            }

            if (target) {
                lastDeployment = target;
                if (target.status !== lastStatus) {
                    lastStatus = target.status;
                    onEvent({ type: 'status', deployment: target });
                }
                if (TERMINAL_STATUSES.has(target.status)) {
                    return { outcome: target.status, deployment: target };
                }
            }
        }

        if (now() - startedAt >= timeoutMs) {
            return { outcome: 'timeout', deployment: lastDeployment };
        }
        await sleep(intervalMs);
    }
}

module.exports = { pollDeployment, TERMINAL_STATUSES };
