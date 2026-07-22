'use strict';

// ── 원클릭 롤백 순수 규칙 모듈 (Task 2.1) ─────────────────────────────────────
// deployer.rollbackTo() 와 routes/deployments.js 가 공유하는 검증/포맷 로직.
// 의존성 제로(내장 모듈조차 불필요) — node_modules 없는 pre-commit 환경에서도
// test/rollback.test.js 로 검증 가능해야 한다.

// 배포 이미지 태그 형태: orbitron-<sub>:d<deploymentId> (docker.formatDeployTag 산출물)
// DB 값이 오염됐을 때 docker CLI 로 그대로 넘어가지 않도록 형식을 재검증한다.
const DEPLOY_TAG_RE = /^orbitron-[a-z0-9-]+:d[1-9]\d*$/;

// 롤백 가능 여부 판정 — 순수 함수.
// 반환: { ok: true } 또는 { ok: false, code, error }
//   code: NOT_FOUND | WRONG_PROJECT | NOT_SUCCESS | NO_IMAGE_TAG | INVALID_TAG
// (이미지 실존 여부는 docker 를 호출해야 하므로 여기가 아닌 deployer.rollbackTo 에서 확인)
function assessRollbackEligibility(project, deployment) {
    if (!deployment) {
        return {
            ok: false, code: 'NOT_FOUND',
            error: '배포 기록을 찾을 수 없습니다. / Deployment not found.',
        };
    }
    if (project && deployment.project_id !== undefined && deployment.project_id !== null
        && String(deployment.project_id) !== String(project.id)) {
        return {
            ok: false, code: 'WRONG_PROJECT',
            error: '해당 프로젝트의 배포가 아닙니다. / Deployment does not belong to this project.',
        };
    }
    if (deployment.status !== 'success') {
        return {
            ok: false, code: 'NOT_SUCCESS',
            error: `성공한 배포만 롤백 대상이 될 수 있습니다 (현재 상태: ${deployment.status}). / Only successful deployments can be rolled back to (status: ${deployment.status}).`,
        };
    }
    if (!deployment.image_tag) {
        return {
            ok: false, code: 'NO_IMAGE_TAG',
            error: '이 배포에는 저장된 이미지 태그가 없어 롤백할 수 없습니다 (compose/db/vps 배포이거나 이미지 태깅 도입 이전 배포). / This deployment has no per-deploy image tag (compose/db/vps deploy, or predates image tagging) and cannot be rolled back to.',
        };
    }
    if (!DEPLOY_TAG_RE.test(deployment.image_tag)) {
        return {
            ok: false, code: 'INVALID_TAG',
            error: `이미지 태그 형식이 올바르지 않습니다: "${deployment.image_tag}" / Malformed image tag: "${deployment.image_tag}".`,
        };
    }
    return { ok: true };
}

// 롤백 배포 행의 commit_message 포맷: ⏪ rollback to d<id> (<원본 메시지 truncated>)
function formatRollbackCommitMessage(deployment, maxLen = 80) {
    const base = `⏪ rollback to d${deployment.id}`;
    const orig = (deployment.commit_message || '').trim();
    if (!orig) return base;
    const truncated = orig.length > maxLen ? orig.slice(0, maxLen - 1) + '…' : orig;
    return `${base} (${truncated})`;
}

// prune keep-list 조립 — 순수 함수.
// rows: 최신 성공 배포 행들(신규순), currentTag: 방금 배포/롤백에 쓰인 태그.
// 중복 제거 + currentTag 는 항상 포함 (롤백 직후 프로덕션이 가리키는 옛 태그 보호).
function buildKeepTagList(rows, currentTag) {
    const tags = [];
    for (const r of rows || []) {
        if (r && r.image_tag && !tags.includes(r.image_tag)) tags.push(r.image_tag);
    }
    if (currentTag && !tags.includes(currentTag)) tags.push(currentTag);
    return tags;
}

module.exports = { assessRollbackEligibility, formatRollbackCommitMessage, buildKeepTagList };
