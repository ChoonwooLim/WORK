'use strict';

// 프로젝트 해석 — 순수 함수 (test/cli.test.js).
// 우선순위: 정확한 subdomain > 정확한 name > git remote origin ↔ github_url 매칭.

// git URL 정규화: 프로토콜/자격/`.git`/대소문자/끝 슬래시 차이를 제거해
// 'host/owner/repo' 형태로 비교. 인식 못하면 null.
//   git@github.com:User/Repo.git      → github.com/user/repo
//   https://github.com/user/repo.git  → github.com/user/repo
//   ssh://git@github.com/user/repo    → github.com/user/repo
function normalizeGitUrl(url) {
    if (typeof url !== 'string') return null;
    let u = url.trim();
    if (!u) return null;
    u = u.replace(/\.git$/i, '').replace(/\/+$/, '');

    // scp 형식: user@host:path
    let m = u.match(/^[\w.-]+@([\w.-]+):(.+)$/);
    if (m) return `${m[1]}/${m[2]}`.toLowerCase();

    // 스킴 형식: https:// | http:// | ssh:// | git:// (+선택적 user@, :port)
    m = u.match(/^(?:https?|ssh|git):\/\/(?:[\w.-]+@)?([\w.-]+)(?::\d+)?\/(.+)$/i);
    if (m) return `${m[1]}/${m[2]}`.toLowerCase();

    // 스킴 없는 host/owner/repo
    m = u.match(/^([\w.-]+\.[\w-]+)\/(.+)$/);
    if (m) return `${m[1]}/${m[2]}`.toLowerCase();

    return null;
}

// projects 배열에서 프로젝트 해석.
//  name 지정 시: subdomain 정확 일치 > name 정확 일치, 없으면 null (git 폴백 없음).
//  name 미지정 시: gitRemoteUrl ↔ github_url 정규화 매칭. 정확히 1개일 때만 반환
//  (여러 프로젝트가 같은 repo 를 쓸 수 있으므로 모호하면 null — 호출부가 안내).
function resolveProject(projects, name, gitRemoteUrl) {
    if (!Array.isArray(projects)) return null;

    if (name) {
        return projects.find((p) => p.subdomain === name)
            || projects.find((p) => p.name === name)
            || null;
    }

    const target = normalizeGitUrl(gitRemoteUrl);
    if (!target) return null;
    const matches = projects.filter((p) => normalizeGitUrl(p.github_url) === target);
    return matches.length === 1 ? matches[0] : null;
}

module.exports = { normalizeGitUrl, resolveProject };
