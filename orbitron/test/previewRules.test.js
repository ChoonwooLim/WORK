'use strict';

// Tests for PR preview deployments (Task 3.1) — pure rules only.
//
// Pins:
//   1. 프리뷰 서브도메인 생성: pr-<n>-<sub>, 63자 DNS label 제한, 초과 시
//      truncate + sha1 4-hex 접미사 (긴 이름끼리 결정적으로 구분)
//   2. fork PR 감지: head.repo vs base.repo full_name (missing head → fork 취급)
//   3. 액션 라우팅 테이블: opened/synchronize/reopened → deploy, closed → destroy
//   4. max-3 활성 프리뷰 게이트 (기존 PR 재배포는 한도 무관 허용)
//   5. TTL 스윕 선정: updated_at 기준 7일 초과만, 무효 타임스탬프 제외
//   6. GitHub 토큰 탐색 순서: project env → github_url 삽입 자격증명 → server env
//   7. previewBasePort 대역 (5100~5899, 일반 프로젝트 3000 대역과 분리)
//
// NOT unit-covered (docker/DB/network 부수효과 — 순수 함수로 검증 불가):
//   deployer.deployPreview / destroyPreview / sweepExpiredPreviews 오케스트레이션,
//   webhooks 라우트 (Express), nginx conf 쓰기, GitHub 코멘트 HTTP 호출.

const test = require('node:test');
const assert = require('node:assert');

const rules = require('../services/previewRules');

// ── 1. Preview subdomain generation ─────────────────────────────────────────

test('subdomain: simple case → pr-<n>-<sub>', () => {
    assert.strictEqual(rules.buildPreviewSubdomain('myapp', 5), 'pr-5-myapp');
});

test('subdomain: string PR number accepted', () => {
    assert.strictEqual(rules.buildPreviewSubdomain('myapp', '12'), 'pr-12-myapp');
});

test('subdomain: exactly 63 chars is kept as-is (no truncation)', () => {
    // prefix 'pr-7-' = 5 chars → sub of 58 chars gives exactly 63
    const sub = 'a'.repeat(58);
    const out = rules.buildPreviewSubdomain(sub, 7);
    assert.strictEqual(out, `pr-7-${sub}`);
    assert.strictEqual(out.length, 63);
});

test('subdomain: over 63 chars → truncated to 63 with 4-hex hash suffix', () => {
    const sub = 'a'.repeat(59); // 5 + 59 = 64 > 63
    const out = rules.buildPreviewSubdomain(sub, 7);
    assert.strictEqual(out.length, 63);
    assert.ok(out.startsWith('pr-7-'));
    assert.match(out, /-[0-9a-f]{4}$/);
});

test('subdomain: two distinct long subdomains with same truncated head stay unique', () => {
    const a = 'longproject-' + 'a'.repeat(60) + '-alpha';
    const b = 'longproject-' + 'a'.repeat(60) + '-bravo';
    const outA = rules.buildPreviewSubdomain(a, 3);
    const outB = rules.buildPreviewSubdomain(b, 3);
    assert.notStrictEqual(outA, outB); // hash suffix differs
    assert.ok(outA.length <= 63 && outB.length <= 63);
});

test('subdomain: truncation strips trailing hyphens before hash suffix', () => {
    // Craft a sub whose cut point lands right after a hyphen run
    const sub = 'abc-' + 'x'.repeat(70);
    const out = rules.buildPreviewSubdomain(sub, 1);
    assert.ok(!out.includes('--') || /^[a-z0-9-]+$/.test(out));
    assert.doesNotMatch(out, /-{2,}[0-9a-f]{4}$/);
    assert.ok(out.length <= 63);
});

test('subdomain: deterministic — same input, same output', () => {
    const sub = 'z'.repeat(80);
    assert.strictEqual(rules.buildPreviewSubdomain(sub, 9), rules.buildPreviewSubdomain(sub, 9));
});

test('subdomain: invalid PR number throws', () => {
    assert.throws(() => rules.buildPreviewSubdomain('myapp', 0));
    assert.throws(() => rules.buildPreviewSubdomain('myapp', -1));
    assert.throws(() => rules.buildPreviewSubdomain('myapp', 'abc'));
    assert.throws(() => rules.buildPreviewSubdomain('myapp', '5; rm -rf /'));
});

test('subdomain: unsafe project subdomain throws (shell/path metachars)', () => {
    assert.throws(() => rules.buildPreviewSubdomain('my app', 1));
    assert.throws(() => rules.buildPreviewSubdomain('../etc', 1));
    assert.throws(() => rules.buildPreviewSubdomain('', 1));
    assert.throws(() => rules.buildPreviewSubdomain('-leading', 1));
});

// ── 2. Fork PR detection ────────────────────────────────────────────────────

function prPayload(headRepo, baseRepo) {
    return {
        action: 'opened',
        pull_request: {
            number: 5,
            head: { ref: 'feature-x', sha: 'abc123', repo: headRepo ? { full_name: headRepo } : null },
            base: { ref: 'main', repo: baseRepo ? { full_name: baseRepo } : null },
        },
        repository: { full_name: baseRepo },
    };
}

test('fork: same-repo PR is not a fork', () => {
    assert.strictEqual(rules.isForkPr(prPayload('me/app', 'me/app')), false);
});

test('fork: different head repo is a fork', () => {
    assert.strictEqual(rules.isForkPr(prPayload('attacker/app', 'me/app')), true);
});

test('fork: case-insensitive full_name comparison', () => {
    assert.strictEqual(rules.isForkPr(prPayload('Me/App', 'me/app')), false);
});

test('fork: missing head repo (deleted fork) → treated as fork (safe default)', () => {
    assert.strictEqual(rules.isForkPr(prPayload(null, 'me/app')), true);
    assert.strictEqual(rules.isForkPr({}), true);
    assert.strictEqual(rules.isForkPr(null), true);
});

// ── 3. Action routing table ─────────────────────────────────────────────────

test('action routing: full table', () => {
    assert.strictEqual(rules.routePrAction('opened'), 'deploy');
    assert.strictEqual(rules.routePrAction('synchronize'), 'deploy');
    assert.strictEqual(rules.routePrAction('reopened'), 'deploy');
    assert.strictEqual(rules.routePrAction('closed'), 'destroy');
    assert.strictEqual(rules.routePrAction('labeled'), 'ignore');
    assert.strictEqual(rules.routePrAction('edited'), 'ignore');
    assert.strictEqual(rules.routePrAction('review_requested'), 'ignore');
    assert.strictEqual(rules.routePrAction(undefined), 'ignore');
    assert.strictEqual(rules.routePrAction(''), 'ignore');
});

// ── 4. Max-3 active previews gate ───────────────────────────────────────────

test('max gate: under limit allows new preview', () => {
    assert.strictEqual(rules.canCreatePreview([], 1), true);
    assert.strictEqual(rules.canCreatePreview([{ pr_number: 1 }, { pr_number: 2 }], 3), true);
});

test('max gate: at limit blocks a NEW preview', () => {
    const rows = [{ pr_number: 1 }, { pr_number: 2 }, { pr_number: 3 }];
    assert.strictEqual(rules.canCreatePreview(rows, 4), false);
});

test('max gate: redeploy of an existing PR is allowed even at limit', () => {
    const rows = [{ pr_number: 1 }, { pr_number: 2 }, { pr_number: 3 }];
    assert.strictEqual(rules.canCreatePreview(rows, 2), true);
});

test('max gate: pg string pr_number vs number compare', () => {
    const rows = [{ pr_number: '7' }];
    assert.strictEqual(rules.canCreatePreview(rows, 7), true);
});

test('max gate: custom max respected', () => {
    assert.strictEqual(rules.canCreatePreview([{ pr_number: 1 }], 2, 1), false);
});

// ── 5. TTL sweep selection ──────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

test('ttl: rows older than 7 days (updated_at) are selected', () => {
    const now = Date.now();
    const rows = [
        { id: 1, updated_at: new Date(now - 8 * DAY).toISOString() },
        { id: 2, updated_at: new Date(now - 1 * DAY).toISOString() },
        { id: 3, updated_at: new Date(now - 30 * DAY).toISOString() },
    ];
    const expired = rules.selectExpiredPreviews(rows, now);
    assert.deepStrictEqual(expired.map(r => r.id), [1, 3]);
});

test('ttl: exactly 7 days is NOT expired (strictly older only)', () => {
    const now = Date.now();
    const rows = [{ id: 1, updated_at: new Date(now - 7 * DAY).toISOString() }];
    assert.deepStrictEqual(rules.selectExpiredPreviews(rows, now), []);
});

test('ttl: falls back to created_at when updated_at missing', () => {
    const now = Date.now();
    const rows = [{ id: 1, created_at: new Date(now - 10 * DAY).toISOString() }];
    assert.strictEqual(rules.selectExpiredPreviews(rows, now).length, 1);
});

test('ttl: unparseable/missing timestamps are never selected (no accidental destroy)', () => {
    const now = Date.now();
    const rows = [
        { id: 1, updated_at: 'not-a-date' },
        { id: 2 },
    ];
    assert.deepStrictEqual(rules.selectExpiredPreviews(rows, now), []);
});

test('ttl: custom ttlMs respected', () => {
    const now = Date.now();
    const rows = [{ id: 1, updated_at: new Date(now - 2 * DAY).toISOString() }];
    assert.strictEqual(rules.selectExpiredPreviews(rows, now, 1 * DAY).length, 1);
});

// ── 6. GitHub token discovery ───────────────────────────────────────────────

test('token: project env_vars.GITHUB_TOKEN wins', () => {
    const p = { env_vars: { GITHUB_TOKEN: 'tok-a' }, github_url: 'https://x:tok-b@github.com/me/app.git' };
    assert.deepStrictEqual(rules.discoverGithubToken(p, { GITHUB_TOKEN: 'tok-c' }), { token: 'tok-a', source: 'project_env' });
});

test('token: embedded url credentials (user:token form)', () => {
    const p = { env_vars: {}, github_url: 'https://x-access-token:ghp_abc@github.com/me/app.git' };
    assert.deepStrictEqual(rules.discoverGithubToken(p, {}), { token: 'ghp_abc', source: 'github_url' });
});

test('token: embedded url credentials (token-only form)', () => {
    const p = { github_url: 'https://ghp_xyz@github.com/me/app' };
    assert.deepStrictEqual(rules.discoverGithubToken(p, {}), { token: 'ghp_xyz', source: 'github_url' });
});

test('token: server env fallback', () => {
    const p = { github_url: 'https://github.com/me/app' };
    assert.deepStrictEqual(rules.discoverGithubToken(p, { GITHUB_TOKEN: 'srv' }), { token: 'srv', source: 'server_env' });
});

test('token: none discoverable → null (comment skipped, deploy unaffected)', () => {
    assert.strictEqual(rules.discoverGithubToken({ github_url: 'https://github.com/me/app' }, {}), null);
    assert.strictEqual(rules.discoverGithubToken(null, {}), null);
});

test('extractTokenFromGitUrl: plain url has no token', () => {
    assert.strictEqual(rules.extractTokenFromGitUrl('https://github.com/me/app.git'), null);
    assert.strictEqual(rules.extractTokenFromGitUrl(null), null);
});

// ── parseOwnerRepo ──────────────────────────────────────────────────────────

test('parseOwnerRepo: common forms', () => {
    assert.strictEqual(rules.parseOwnerRepo('https://github.com/me/app'), 'me/app');
    assert.strictEqual(rules.parseOwnerRepo('https://github.com/me/app.git'), 'me/app');
    assert.strictEqual(rules.parseOwnerRepo('https://github.com/me/app/'), 'me/app');
    assert.strictEqual(rules.parseOwnerRepo('https://tok@github.com/me/app.git'), 'me/app');
    assert.strictEqual(rules.parseOwnerRepo('git@github.com:me/app.git'), 'me/app');
});

test('parseOwnerRepo: non-github → null', () => {
    assert.strictEqual(rules.parseOwnerRepo('https://gitlab.com/me/app'), null);
    assert.strictEqual(rules.parseOwnerRepo(''), null);
});

// ── 7. Preview port base ────────────────────────────────────────────────────

test('previewBasePort: within 5100-5899 range, deterministic, distinct from 3000-range', () => {
    for (const pr of [1, 42, 799, 800, 801, 99999]) {
        const port = rules.previewBasePort(pr);
        assert.ok(port >= 5100 && port < 5900, `port ${port} out of range for pr ${pr}`);
        assert.strictEqual(port, rules.previewBasePort(pr));
    }
});

// ── isPreviewSubdomain guard ────────────────────────────────────────────────

// ── Reserved preview namespace (routes/projects.js 생성/수정 400 가드) ──────

test('isReservedPreviewNamespace: pr-<n>- prefixed names are reserved', () => {
    assert.strictEqual(rules.isReservedPreviewNamespace('pr-7-foo'), true);
    assert.strictEqual(rules.isReservedPreviewNamespace('pr-123-my-app'), true);
    assert.strictEqual(rules.isReservedPreviewNamespace('pr-1-'), true); // 프리픽스만으로도 예약
});

test('isReservedPreviewNamespace: legitimate names are NOT reserved', () => {
    assert.strictEqual(rules.isReservedPreviewNamespace('myapp'), false);
    assert.strictEqual(rules.isReservedPreviewNamespace('pr-foo'), false);      // 숫자 없음
    assert.strictEqual(rules.isReservedPreviewNamespace('prod-1-app'), false);
    assert.strictEqual(rules.isReservedPreviewNamespace('pr7-foo'), false);     // 하이픈 형식 불일치
    assert.strictEqual(rules.isReservedPreviewNamespace('xpr-7-foo'), false);   // 선두 앵커
    assert.strictEqual(rules.isReservedPreviewNamespace(''), false);
    assert.strictEqual(rules.isReservedPreviewNamespace(null), false);
});

test('isReservedPreviewNamespace: every generated preview subdomain is inside the namespace', () => {
    assert.strictEqual(rules.isReservedPreviewNamespace(rules.buildPreviewSubdomain('myapp', 5)), true);
    assert.strictEqual(rules.isReservedPreviewNamespace(rules.buildPreviewSubdomain('x'.repeat(80), 12)), true);
});

// ── Branch / commit hash safety (shell interpolation guards) ────────────────

test('isSafeBranchName: normal branches pass', () => {
    assert.strictEqual(rules.isSafeBranchName('main'), true);
    assert.strictEqual(rules.isSafeBranchName('feature/my-fix_2'), true);
    assert.strictEqual(rules.isSafeBranchName('release-1.2.3'), true);
});

test('isSafeBranchName: shell metachars / option injection / traversal rejected', () => {
    assert.strictEqual(rules.isSafeBranchName('foo; rm -rf /'), false);
    assert.strictEqual(rules.isSafeBranchName('foo$(whoami)'), false);
    assert.strictEqual(rules.isSafeBranchName('foo`id`'), false);
    assert.strictEqual(rules.isSafeBranchName('foo bar'), false);
    assert.strictEqual(rules.isSafeBranchName('-option'), false);
    assert.strictEqual(rules.isSafeBranchName('a..b'), false);
    assert.strictEqual(rules.isSafeBranchName(''), false);
    assert.strictEqual(rules.isSafeBranchName(null), false);
    assert.strictEqual(rules.isSafeBranchName('x'.repeat(201)), false);
});

test('isSafeCommitHash: hex 7-40 only', () => {
    assert.strictEqual(rules.isSafeCommitHash('abc1234'), true);
    assert.strictEqual(rules.isSafeCommitHash('a'.repeat(40)), true);
    assert.strictEqual(rules.isSafeCommitHash('abc123'), false);       // too short
    assert.strictEqual(rules.isSafeCommitHash('g'.repeat(40)), false); // non-hex
    assert.strictEqual(rules.isSafeCommitHash('abc1234; id'), false);
    assert.strictEqual(rules.isSafeCommitHash(null), false);
});

test('isPreviewSubdomain: accepts generated names, rejects parent/garbage', () => {
    assert.strictEqual(rules.isPreviewSubdomain('pr-5-myapp'), true);
    assert.strictEqual(rules.isPreviewSubdomain(rules.buildPreviewSubdomain('x'.repeat(80), 12)), true);
    assert.strictEqual(rules.isPreviewSubdomain('myapp'), false);
    assert.strictEqual(rules.isPreviewSubdomain('pr--myapp'), false);
    assert.strictEqual(rules.isPreviewSubdomain('pr-5-'), false);
    assert.strictEqual(rules.isPreviewSubdomain(''), false);
    assert.strictEqual(rules.isPreviewSubdomain(null), false);
});
