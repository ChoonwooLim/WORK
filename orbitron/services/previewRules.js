'use strict';

// ── Task 3.1: PR 프리뷰 배포 — 순수 판정 로직 ────────────────────────────────
// deployer.deployPreview / routes/webhooks.js 가 사용하는 결정 규칙을 부수효과
// 없이 모아둔 모듈 (rollbackRules.js 와 같은 패턴 — test/previewRules.test.js 가 핀).
//
// v1 경계 (의도된 제한):
//   - same-repo 브랜치 PR 만 배포 (fork PR 은 호스트에서 프로젝트 env 와 함께
//     임의 코드가 실행되므로 보안상 스킵)
//   - 프리뷰는 부모 프로젝트의 DB 를 그대로 공유 (쓰기가 실 DB 에 반영됨)
//   - 프로젝트당 활성 프리뷰 최대 3개, TTL 7일 (updated_at 기준)

const crypto = require('crypto');

const MAX_DNS_LABEL = 63;              // RFC 1035 label 최대 길이
const MAX_ACTIVE_PREVIEWS = 3;         // 프로젝트당 동시 활성 프리뷰 수
const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 (updated_at 기준)

// 프리뷰 호스트 포트 대역: 일반 프로젝트 생성 시 배정되는 3000~3999 와 분리.
// 실제 바인딩은 docker.startContainer 의 lsof 충돌 자동 해소(+1 증분)가 최종
// 결정하므로 여기서는 "출발점"만 결정한다.
const PREVIEW_PORT_BASE = 5100;
const PREVIEW_PORT_RANGE = 800;        // 5100 ~ 5899

// pr-<n>-<projectSubdomain> — DNS label 63자 제한을 지키는 프리뷰 서브도메인.
// 63자를 넘으면 프로젝트 부분을 잘라내고, 잘린 이름끼리 충돌하지 않도록
// 원본 서브도메인의 sha1 4-hex 접미사를 붙인다 (결정적 — 같은 입력 → 같은 출력.
// 남은 이론상 충돌은 preview_deployments.subdomain UNIQUE 제약이 최종 방어).
function buildPreviewSubdomain(projectSubdomain, prNumber) {
    const n = parseInt(prNumber, 10);
    if (!Number.isInteger(n) || n < 1 || String(n) !== String(prNumber).trim()) {
        throw new Error(`Invalid PR number: ${JSON.stringify(prNumber)}`);
    }
    const sub = String(projectSubdomain || '').toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub)) {
        throw new Error(`Invalid project subdomain: ${JSON.stringify(projectSubdomain)}`);
    }
    const prefix = `pr-${n}-`;
    const full = prefix + sub;
    if (full.length <= MAX_DNS_LABEL) return full;

    const hash = crypto.createHash('sha1').update(sub).digest('hex').slice(0, 4);
    // prefix + truncated + '-' + hash4 == 63
    const keep = MAX_DNS_LABEL - prefix.length - 1 - hash.length;
    const truncated = sub.slice(0, keep).replace(/-+$/, '');
    return `${prefix}${truncated}-${hash}`;
}

// fork PR 판정: head.repo 와 base.repo 의 full_name 이 다르면 fork.
// head repo 정보가 없으면(삭제된 fork 등) 안전 기본값으로 fork 취급 → 스킵.
function isForkPr(payload) {
    const head = payload?.pull_request?.head?.repo?.full_name;
    const base = payload?.pull_request?.base?.repo?.full_name;
    if (!head || !base) return true;
    return head.toLowerCase() !== base.toLowerCase();
}

// pull_request 액션 → 처리 방식 라우팅 테이블
//   opened / synchronize / reopened → 'deploy'
//   closed (머지 여부 무관)         → 'destroy'
//   그 외 (labeled, edited, ...)    → 'ignore'
function routePrAction(action) {
    if (action === 'opened' || action === 'synchronize' || action === 'reopened') return 'deploy';
    if (action === 'closed') return 'destroy';
    return 'ignore';
}

// 프로젝트당 최대 활성 프리뷰 게이트.
// 이미 이 PR 의 프리뷰 행이 있으면(= synchronize 재배포) 한도와 무관하게 허용.
function canCreatePreview(existingPreviews, prNumber, max = MAX_ACTIVE_PREVIEWS) {
    const prs = new Set((existingPreviews || []).map(r => Number(r.pr_number)));
    if (prs.has(Number(prNumber))) return true;
    return prs.size < max;
}

// TTL 스윕 대상 선정: updated_at(없으면 created_at)이 ttlMs 보다 오래된 행.
// 타임스탬프를 해석할 수 없는 행은 잘못 파괴하지 않도록 제외한다.
function selectExpiredPreviews(rows, now = Date.now(), ttlMs = PREVIEW_TTL_MS) {
    return (rows || []).filter(r => {
        const raw = r.updated_at || r.created_at;
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return Number.isFinite(t) && (now - t) > ttlMs;
    });
}

// github_url 에 삽입된 자격증명 추출:
//   https://TOKEN@github.com/owner/repo(.git)
//   https://user:TOKEN@github.com/owner/repo(.git)  (x-access-token:TOKEN 포함)
// private repo clone 이 성공한다는 것 = URL 에 토큰이 있다는 뜻이므로
// PR 코멘트도 같은 토큰을 재사용할 수 있다.
function extractTokenFromGitUrl(url) {
    if (typeof url !== 'string') return null;
    const m = url.match(/^https?:\/\/(?:[^:@/]+:)?([^:@/]+)@github\.com\//i);
    return m ? m[1] : null;
}

// PR 코멘트용 GitHub 토큰 탐색 (우선순위 순):
//   1. 프로젝트 env_vars.GITHUB_TOKEN  (aiAutoRepair.createGitHubPR 와 동일 소스)
//   2. github_url 에 삽입된 자격증명    (private clone 인증 경로 재사용)
//   3. 서버 프로세스 env GITHUB_TOKEN
// 없으면 null — 호출부는 코멘트를 스킵할 뿐 배포를 실패시키지 않는다.
function discoverGithubToken(project, env = process.env) {
    const fromProject = project?.env_vars?.GITHUB_TOKEN;
    if (fromProject) return { token: String(fromProject), source: 'project_env' };
    const embedded = extractTokenFromGitUrl(project?.github_url);
    if (embedded) return { token: embedded, source: 'github_url' };
    if (env && env.GITHUB_TOKEN) return { token: String(env.GITHUB_TOKEN), source: 'server_env' };
    return null;
}

// github_url → "owner/repo" (코멘트 API 경로용). 실패 시 null.
function parseOwnerRepo(url) {
    if (typeof url !== 'string') return null;
    const m = url.match(/github\.com[/:]([^/\s]+)\/([^/\s?#]+?)(?:\.git)?\/?(?:[?#].*)?$/i);
    if (!m) return null;
    return `${m[1]}/${m[2]}`;
}

// 프리뷰 호스트 포트 출발점 (PR 번호로 결정적 분산; 충돌은 startContainer 가 해소)
function previewBasePort(prNumber) {
    const n = Math.abs(parseInt(prNumber, 10) || 0);
    return PREVIEW_PORT_BASE + (n % PREVIEW_PORT_RANGE);
}

// 프리뷰 서브도메인 형식 검증 — teardown 이 rm -rf 하기 전의 안전 가드
function isPreviewSubdomain(subdomain) {
    return typeof subdomain === 'string' && /^pr-\d+-[a-z0-9][a-z0-9-]*$/.test(subdomain);
}

// PR head 브랜치명 안전 검증. cloneOrPull 이 셸 문자열 보간으로 git 을 실행하므로
// webhook payload 에서 온 브랜치명은 반드시 이 화이트리스트를 통과해야 한다
// (공백/따옴표/세미콜론/$/백틱 등 셸 메타문자 전면 차단, 선행 '-' 옵션 주입 차단).
function isSafeBranchName(branch) {
    if (typeof branch !== 'string' || branch.length === 0 || branch.length > 200) return false;
    if (branch.includes('..')) return false;
    return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch);
}

// 커밋 해시 안전 검증 (git reset --hard 대상으로 셸 보간됨)
function isSafeCommitHash(hash) {
    return typeof hash === 'string' && /^[0-9a-f]{7,40}$/i.test(hash);
}

module.exports = {
    MAX_DNS_LABEL,
    MAX_ACTIVE_PREVIEWS,
    PREVIEW_TTL_MS,
    PREVIEW_PORT_BASE,
    PREVIEW_PORT_RANGE,
    buildPreviewSubdomain,
    isForkPr,
    routePrAction,
    canCreatePreview,
    selectExpiredPreviews,
    extractTokenFromGitUrl,
    discoverGithubToken,
    parseOwnerRepo,
    previewBasePort,
    isPreviewSubdomain,
    isSafeBranchName,
    isSafeCommitHash,
};
