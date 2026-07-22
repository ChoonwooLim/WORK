'use strict';

// 명령 구현. 모든 부수효과 의존성은 ctx 로 주입 가능:
//   ctx = { parsed, env, stdout, stderr, configFile, makeClient, ask, askHidden,
//           getGitRemote, sleep, now, hostname, isTTY }
// 반환값: 종료 코드 (0/1/2/3).

const os = require('node:os');
const { execFileSync } = require('node:child_process');

const { ApiClient } = require('./api');
const { UsageError, AuthError, ApiError, EXIT } = require('./errors');
const { readConfig, writeConfig, clearConfig, normalizeServerUrl, DEFAULT_SERVER } = require('./config');
const { formatTable, colorEnabled, colorizeStatus, colorize } = require('./format');
const { resolveProject } = require('./resolve');
const { pollDeployment } = require('./poll');
const { helpText } = require('./help');
const prompt = require('./prompt');

// ── helpers ──────────────────────────────────────────────────────────────────

function defaultGetGitRemote(cwd) {
    try {
        return execFileSync('git', ['remote', 'get-url', 'origin'], {
            cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
        }).trim() || null;
    } catch (e) {
        return null;
    }
}

function buildContext(parsed, overrides = {}) {
    const env = overrides.env || process.env;
    const { configPath } = require('./config');
    return {
        parsed,
        env,
        stdout: process.stdout,
        stderr: process.stderr,
        configFile: configPath(env),
        makeClient: (opts) => new ApiClient(opts),
        ask: prompt.ask,
        askHidden: prompt.askHidden,
        getGitRemote: defaultGetGitRemote,
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        now: Date.now,
        hostname: () => os.hostname(),
        isTTY: Boolean(process.stdout.isTTY),
        cwd: process.cwd(),
        ...overrides,
    };
}

function requireAuth(ctx) {
    const config = readConfig(ctx.configFile);
    if (!config.server || !config.token) {
        throw new AuthError('로그인이 필요합니다. `orbitron login` 을 실행하세요. / Not logged in — run `orbitron login`.');
    }
    return { config, client: ctx.makeClient({ server: config.server, token: config.token }) };
}

// 이름(또는 git remote)으로 프로젝트를 찾는다. 못 찾으면 UsageError.
async function findProject(ctx, client, name) {
    const projects = await client.projects();
    let gitRemote = null;
    if (!name) {
        gitRemote = ctx.getGitRemote(ctx.cwd);
        if (!gitRemote) {
            throw new UsageError('프로젝트를 지정하세요 (--project 또는 git 저장소 안에서 실행). / Specify a project (--project) or run inside a git repo.');
        }
    }
    const project = resolveProject(projects, name || null, gitRemote);
    if (!project) {
        const hint = name
            ? `'${name}' 과 일치하는 프로젝트가 없습니다 (subdomain/name 정확 일치). / No project matches '${name}'.`
            : `git remote origin (${gitRemote}) 과 일치하는 프로젝트를 찾지 못했습니다 (또는 여러 개와 일치). / No unique project matches the git remote.`;
        throw new UsageError(hint + ' `orbitron status` 로 목록을 확인하세요.');
    }
    return project;
}

// 배포/롤백 공통 폴링 + 결과 출력
async function watchDeployment(ctx, client, project, { deploymentId = null, sinceId = null }) {
    const color = colorEnabled(ctx.env, ctx.isTTY);
    const result = await pollDeployment({
        getDeployments: () => client.deployments(project.id),
        deploymentId,
        sinceId,
        sleep: ctx.sleep,
        now: ctx.now,
        onEvent: ({ deployment }) => {
            ctx.stdout.write(`  [${new Date().toISOString().slice(11, 19)}] ${colorizeStatus(deployment.status, color)}\n`);
        },
    });

    if (result.outcome === 'success') {
        const url = project.custom_domain || project.tunnel_url || null;
        ctx.stdout.write(`${colorize('✔', 'green', color)} 배포 성공 / Deploy succeeded${url ? ` — ${url}` : ''}\n`);
        return EXIT.OK;
    }
    if (result.outcome === 'failed') {
        ctx.stderr.write(`배포 실패 / Deploy failed. 로그: orbitron logs ${project.subdomain || project.name}\n`);
        return EXIT.API;
    }
    if (result.outcome === 'timeout') {
        ctx.stderr.write('15분 안에 배포가 끝나지 않았습니다 (서버에서는 계속 진행 중일 수 있음). / Timed out after 15 min; the deploy may still be running.\n');
        return EXIT.API;
    }
    ctx.stderr.write(`배포 상태 조회 실패 / Failed to poll deployment status: ${result.error ? result.error.message : 'unknown'}\n`);
    return EXIT.API;
}

// ── commands ─────────────────────────────────────────────────────────────────

async function cmdLogin(ctx) {
    const existing = readConfig(ctx.configFile);
    const server = normalizeServerUrl(ctx.parsed.server || existing.server || DEFAULT_SERVER);

    ctx.stdout.write(`서버 / Server: ${server}\n`);
    const email = await ctx.ask('Email: ');
    if (!email) throw new UsageError('이메일을 입력하세요. / Email is required.');
    const password = await ctx.askHidden('Password: ');
    if (!password) throw new UsageError('비밀번호를 입력하세요. / Password is required.');

    const anon = ctx.makeClient({ server });
    const loginRes = await anon.login(email, password);

    // PAT 발급 시도 — 실패(구버전 서버 등) 시 JWT(7일) 저장으로 폴백
    let config;
    try {
        const authed = ctx.makeClient({ server, token: loginRes.token });
        const pat = await authed.createToken(`cli-${ctx.hostname()}`);
        config = { server, token: pat.token, tokenType: 'pat', patId: pat.id, username: loginRes.user && loginRes.user.username };
        writeConfig(ctx.configFile, config);
        ctx.stdout.write('로그인 성공 — 장기 토큰(PAT) 저장됨. / Logged in — long-lived token stored.\n');
    } catch (e) {
        config = { server, token: loginRes.token, tokenType: 'jwt', username: loginRes.user && loginRes.user.username };
        writeConfig(ctx.configFile, config);
        ctx.stdout.write('로그인 성공 — JWT 저장됨 (7일 후 재로그인 필요). / Logged in — JWT stored (expires in 7 days).\n');
    }
    return EXIT.OK;
}

async function cmdLogout(ctx) {
    const config = readConfig(ctx.configFile);
    if (config.tokenType === 'pat' && config.patId && config.server && config.token) {
        try {
            await ctx.makeClient({ server: config.server, token: config.token }).deleteToken(config.patId);
            ctx.stdout.write('서버의 PAT 를 폐기했습니다. / Revoked the PAT on the server.\n');
        } catch (e) {
            ctx.stderr.write('서버 PAT 폐기 실패 (이미 만료/삭제됐을 수 있음) — 로컬 토큰만 삭제합니다.\n');
        }
    }
    clearConfig(ctx.configFile);
    ctx.stdout.write('로그아웃 완료. / Logged out.\n');
    return EXIT.OK;
}

async function cmdStatus(ctx) {
    const { client } = requireAuth(ctx);
    const projects = await client.projects();
    if (!projects || projects.length === 0) {
        ctx.stdout.write('프로젝트가 없습니다. / No projects.\n');
        return EXIT.OK;
    }
    const color = colorEnabled(ctx.env, ctx.isTTY);
    const rows = projects.map((p) => [p.name, p.subdomain, colorizeStatus(p.status, color), p.type || p.source_type]);
    ctx.stdout.write(formatTable(['NAME', 'SUBDOMAIN', 'STATUS', 'TYPE'], rows, { color }) + '\n');
    return EXIT.OK;
}

async function cmdDeploy(ctx) {
    const { client } = requireAuth(ctx);
    const project = await findProject(ctx, client, ctx.parsed.project);

    // 트리거 전 최신 배포 id 기록 — 새로 생길 행을 추적하기 위해
    let sinceId = 0;
    try {
        const rows = await client.deployments(project.id);
        sinceId = rows.reduce((max, r) => (typeof r.id === 'number' && r.id > max ? r.id : max), 0);
    } catch (e) { /* 조회 실패해도 배포는 진행 */ }

    await client.deployProject(project.id);
    ctx.stdout.write(`배포 시작 / Deploy started: ${project.name} (${project.subdomain})\n`);
    return watchDeployment(ctx, client, project, { sinceId });
}

async function cmdLogs(ctx) {
    const { client } = requireAuth(ctx);
    const project = await findProject(ctx, client, ctx.parsed.project);
    const res = await client.containerLogs(project.id, ctx.parsed.tail);
    ctx.stdout.write((res && res.logs ? res.logs : '') + '\n');
    return EXIT.OK;
}

async function cmdRollback(ctx) {
    const { client } = requireAuth(ctx);
    const project = await findProject(ctx, client, ctx.parsed.project);
    const rows = await client.deployments(project.id);
    const candidates = rows.filter((r) => r.status === 'success' && r.image_tag);
    if (candidates.length === 0) {
        ctx.stderr.write('롤백 가능한 성공 배포가 없습니다 (image_tag 보유 배포 없음). / No successful deployments with an image tag.\n');
        return EXIT.API;
    }

    ctx.stdout.write(`롤백 대상 선택 / Pick a deployment to roll back to — ${project.name}:\n`);
    candidates.forEach((d, i) => {
        const when = d.finished_at ? new Date(d.finished_at).toISOString().replace('T', ' ').slice(0, 16) : '-';
        const msg = (d.commit_message || '').split('\n')[0].slice(0, 60);
        ctx.stdout.write(`  [${i + 1}] ${d.image_tag}  ${when}  ${msg}\n`);
    });

    const answer = await ctx.ask(`번호 선택 / Select [1-${candidates.length}]: `);
    const idx = /^\d+$/.test(answer) ? parseInt(answer, 10) : NaN;
    if (!(idx >= 1 && idx <= candidates.length)) {
        throw new UsageError('잘못된 선택입니다. / Invalid selection.');
    }
    const target = candidates[idx - 1];

    const confirm = await ctx.ask(`${target.image_tag} 으로 롤백할까요? / Roll back? [y/N]: `);
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        ctx.stdout.write('취소했습니다. / Cancelled.\n');
        return EXIT.OK;
    }

    const res = await client.rollback(target.id); // 202 → { deployment_id }
    ctx.stdout.write(`롤백 시작 / Rollback started (deployment #${res.deployment_id})\n`);
    return watchDeployment(ctx, client, project, { deploymentId: res.deployment_id });
}

async function cmdPreviews(ctx) {
    const { client } = requireAuth(ctx);
    const project = await findProject(ctx, client, ctx.parsed.project);

    if (ctx.parsed.action === 'rm') {
        await client.deletePreview(project.id, ctx.parsed.pr);
        ctx.stdout.write(`프리뷰 삭제 완료 / Preview removed: PR #${ctx.parsed.pr}\n`);
        return EXIT.OK;
    }

    const previews = await client.previews(project.id);
    if (!previews || previews.length === 0) {
        ctx.stdout.write('활성 프리뷰가 없습니다. / No active previews.\n');
        return EXIT.OK;
    }
    const color = colorEnabled(ctx.env, ctx.isTTY);
    const rows = previews.map((p) => [`#${p.pr_number}`, p.branch, colorizeStatus(p.status, color), p.url || p.subdomain]);
    ctx.stdout.write(formatTable(['PR', 'BRANCH', 'STATUS', 'URL'], rows, { color }) + '\n');
    return EXIT.OK;
}

async function cmdHelp(ctx) {
    ctx.stdout.write(helpText(ctx.parsed.topic) + '\n');
    return EXIT.OK;
}

async function cmdVersion(ctx) {
    // eslint-disable-next-line global-require
    ctx.stdout.write(`orbitron-cli ${require('../package.json').version}\n`);
    return EXIT.OK;
}

const HANDLERS = {
    login: cmdLogin,
    logout: cmdLogout,
    status: cmdStatus,
    deploy: cmdDeploy,
    logs: cmdLogs,
    rollback: cmdRollback,
    previews: cmdPreviews,
    help: cmdHelp,
    version: cmdVersion,
};

module.exports = { HANDLERS, buildContext, watchDeployment, findProject, requireAuth };
