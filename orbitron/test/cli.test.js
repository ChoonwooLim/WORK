'use strict';

// Tests for the Orbitron CLI (Task 3.2 — cli/lib 순수 모듈 직접 require).
//
// Pins:
//   1. 인자 파싱: 명령별 플래그/positional, 누락·이상값 → UsageError (exit 2)
//   2. 프로젝트 해석 우선순위: subdomain > name > git-remote (정규화 케이스 포함)
//   3. 테이블 포매터: 열 정렬 (ANSI 색 포함 시에도), NO_COLOR 존중
//   4. 폴링 상태기계: building→success / building→failed / timeout / 조회 실패 누적
//   5. 설정 파일: 읽기/쓰기/chmod 600 (tmpdir), 깨진 JSON 허용
//   6. 종료 코드 매핑: UsageError→2, AuthError→3, 그 외→1
//   7. API 클라이언트: 401→AuthError, 4xx/5xx→ApiError, 네트워크 오류→ApiError
//
// NEVER touches the network or a real server — fetch/sleep/now 전부 주입.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { parseCliArgs } = require('../cli/lib/args');
const { UsageError, AuthError, ApiError, exitCodeFor, EXIT } = require('../cli/lib/errors');
const { normalizeGitUrl, resolveProject } = require('../cli/lib/resolve');
const { formatTable, colorEnabled, colorize, colorizeStatus, visibleWidth } = require('../cli/lib/format');
const { pollDeployment } = require('../cli/lib/poll');
const { readConfig, writeConfig, clearConfig, normalizeServerUrl, isInsecureServerUrl } = require('../cli/lib/config');
const { ApiClient } = require('../cli/lib/api');
const { HANDLERS } = require('../cli/lib/commands');

// ── 1. Arg parsing ───────────────────────────────────────────────────────────

test('args: 빈 argv → help', () => {
    assert.deepStrictEqual(parseCliArgs([]), { command: 'help', topic: null });
});

test('args: --help / help <topic> / <cmd> --help', () => {
    assert.strictEqual(parseCliArgs(['--help']).command, 'help');
    assert.deepStrictEqual(parseCliArgs(['help', 'deploy']), { command: 'help', topic: 'deploy' });
    assert.deepStrictEqual(parseCliArgs(['deploy', '--help']), { command: 'help', topic: 'deploy' });
});

test('args: login [--server URL]', () => {
    assert.deepStrictEqual(parseCliArgs(['login']), { command: 'login', server: null });
    assert.deepStrictEqual(parseCliArgs(['login', '--server', 'http://localhost:4000']),
        { command: 'login', server: 'http://localhost:4000' });
});

test('args: deploy [--project name]', () => {
    assert.deepStrictEqual(parseCliArgs(['deploy']), { command: 'deploy', project: null });
    assert.deepStrictEqual(parseCliArgs(['deploy', '--project', 'myapp']), { command: 'deploy', project: 'myapp' });
});

test('args: logs <project> [--tail N] — 기본 200, 검증', () => {
    assert.deepStrictEqual(parseCliArgs(['logs', 'myapp']), { command: 'logs', project: 'myapp', tail: 200 });
    assert.deepStrictEqual(parseCliArgs(['logs', 'myapp', '--tail', '50']), { command: 'logs', project: 'myapp', tail: 50 });
    assert.throws(() => parseCliArgs(['logs']), UsageError);                       // project 누락
    assert.throws(() => parseCliArgs(['logs', 'myapp', '--tail', 'abc']), UsageError);
    assert.throws(() => parseCliArgs(['logs', 'myapp', '--tail', '0']), UsageError);
    assert.throws(() => parseCliArgs(['logs', 'myapp', '--tail', '-5']), UsageError);
});

test('args: rollback <project> 필수', () => {
    assert.deepStrictEqual(parseCliArgs(['rollback', 'myapp']), { command: 'rollback', project: 'myapp' });
    assert.throws(() => parseCliArgs(['rollback']), UsageError);
});

test('args: previews <project> / previews rm <project> <pr>', () => {
    assert.deepStrictEqual(parseCliArgs(['previews', 'myapp']),
        { command: 'previews', action: 'list', project: 'myapp' });
    assert.deepStrictEqual(parseCliArgs(['previews', 'rm', 'myapp', '7']),
        { command: 'previews', action: 'rm', project: 'myapp', pr: 7 });
    assert.throws(() => parseCliArgs(['previews']), UsageError);
    assert.throws(() => parseCliArgs(['previews', 'rm', 'myapp']), UsageError);       // pr 누락
    assert.throws(() => parseCliArgs(['previews', 'rm', 'myapp', 'x']), UsageError);  // pr 정수 아님
});

test('args: 알 수 없는 명령/플래그 → UsageError', () => {
    assert.throws(() => parseCliArgs(['destroy-everything']), UsageError);
    assert.throws(() => parseCliArgs(['status', '--bogus']), UsageError);
    assert.throws(() => parseCliArgs(['deploy', '--project']), UsageError);           // 값 누락
});

// ── 2. Project resolution ────────────────────────────────────────────────────

const PROJECTS = [
    { id: 1, name: 'My App', subdomain: 'myapp', github_url: 'https://github.com/User/my-app.git' },
    { id: 2, name: 'blog', subdomain: 'blog', github_url: 'git@github.com:user/blog.git' },
    // name 이 다른 프로젝트의 subdomain 과 겹치는 함정 케이스
    { id: 3, name: 'myapp', subdomain: 'myapp-staging', github_url: null },
];

test('resolve: subdomain 정확 일치가 name 보다 우선', () => {
    // 'myapp' 은 id 1 의 subdomain 이자 id 3 의 name — subdomain 승리
    assert.strictEqual(resolveProject(PROJECTS, 'myapp', null).id, 1);
    assert.strictEqual(resolveProject(PROJECTS, 'My App', null).id, 1);        // name 일치
    assert.strictEqual(resolveProject(PROJECTS, 'myapp-staging', null).id, 3);
    assert.strictEqual(resolveProject(PROJECTS, 'nope', null), null);
});

test('resolve: name 지정 시 git 폴백 안 함', () => {
    assert.strictEqual(resolveProject(PROJECTS, 'nope', 'git@github.com:user/blog.git'), null);
});

test('resolve: git remote 매칭 — scp ↔ https 정규화', () => {
    // scp 형식 remote ↔ https github_url
    assert.strictEqual(resolveProject(PROJECTS, null, 'git@github.com:user/my-app.git').id, 1);
    // https remote ↔ scp github_url (.git 없음, 대소문자 차이)
    assert.strictEqual(resolveProject(PROJECTS, null, 'https://github.com/User/Blog').id, 2);
    assert.strictEqual(resolveProject(PROJECTS, null, 'https://github.com/none/none'), null);
});

test('normalizeGitUrl: 형식별 동일 결과', () => {
    const expected = 'github.com/user/repo';
    assert.strictEqual(normalizeGitUrl('git@github.com:User/Repo.git'), expected);
    assert.strictEqual(normalizeGitUrl('https://github.com/user/repo.git'), expected);
    assert.strictEqual(normalizeGitUrl('https://github.com/user/repo/'), expected);
    assert.strictEqual(normalizeGitUrl('ssh://git@github.com/user/repo'), expected);
    assert.strictEqual(normalizeGitUrl('github.com/User/repo'), expected);
    assert.strictEqual(normalizeGitUrl(''), null);
    assert.strictEqual(normalizeGitUrl(null), null);
    assert.strictEqual(normalizeGitUrl('not a url at all'), null);
});

test('resolve: 같은 repo 를 쓰는 프로젝트가 여럿이면 git 매칭은 모호 → null', () => {
    const dup = [
        { id: 1, subdomain: 'a', name: 'a', github_url: 'https://github.com/u/r' },
        { id: 2, subdomain: 'b', name: 'b', github_url: 'git@github.com:u/r.git' },
    ];
    assert.strictEqual(resolveProject(dup, null, 'https://github.com/u/r'), null);
});

// ── 3. Table formatter ───────────────────────────────────────────────────────

test('formatTable: 열 정렬 — 각 행의 열 시작 위치 동일', () => {
    const out = formatTable(['NAME', 'STATUS'], [['a', 'running'], ['longer-name', 'ok']]);
    const lines = out.split('\n');
    assert.strictEqual(lines.length, 3);
    // 두 번째 열 시작 위치가 모든 행에서 같아야 한다
    const col2 = ['STATUS', 'running', 'ok'];
    const positions = lines.map((l, i) => l.indexOf(col2[i]));
    assert.strictEqual(new Set(positions).size, 1);
    // 빈/누락 값은 '-' 로
    assert.ok(formatTable(['A'], [[null]]).includes('-'));
});

test('formatTable: ANSI 색이 있어도 열 안 흐트러짐', () => {
    const colored = colorize('running', 'green', true);
    const out = formatTable(['NAME', 'STATUS', 'ZONE'], [['a', colored, 'x'], ['bb', 'stopped', 'y']], { color: true });
    const lines = out.split('\n');
    // 마지막 열('ZONE'/'x'/'y')의 가시 위치가 동일해야 함 — ANSI 제거 후 비교
    const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
    const pos = [strip(lines[0]).indexOf('ZONE'), strip(lines[1]).indexOf('x'), strip(lines[2]).indexOf('y')];
    assert.strictEqual(new Set(pos).size, 1);
    assert.strictEqual(visibleWidth(colored), 'running'.length);
});

test('visibleWidth: 한글/전각은 2칸 — 한국어 프로젝트명 테이블 안 흐트러짐', () => {
    assert.strictEqual(visibleWidth('세계왕립아카데미'), 16);   // 8 syllables × 2
    assert.strictEqual(visibleWidth('abc'), 3);
    assert.strictEqual(visibleWidth('한a글b'), 6);              // 2+1+2+1
    assert.strictEqual(visibleWidth(colorize('한글', 'green', true)), 4); // ANSI 제외 + 전각

    // 한국어 이름이 섞인 테이블에서도 두 번째 열 시작 위치(가시 폭 기준)가 동일해야 한다
    const out = formatTable(['NAME', 'STATUS'], [['세계왕립아카데미', 'running'], ['abc', 'stopped']]);
    const lines = out.split('\n');
    const colStart = (line, word) => visibleWidth(line.slice(0, line.indexOf(word)));
    const positions = [colStart(lines[0], 'STATUS'), colStart(lines[1], 'running'), colStart(lines[2], 'stopped')];
    assert.strictEqual(new Set(positions).size, 1, `열 시작 위치 불일치: ${positions}`);
});

test('colorEnabled: NO_COLOR 존중, TTY 아니면 끔', () => {
    assert.strictEqual(colorEnabled({ NO_COLOR: '1' }, true), false);
    assert.strictEqual(colorEnabled({ NO_COLOR: '' }, true), true);   // 빈 문자열은 무시 (no-color.org)
    assert.strictEqual(colorEnabled({}, true), true);
    assert.strictEqual(colorEnabled({}, false), false);
});

test('colorizeStatus: 색 켬/끔 출력', () => {
    assert.strictEqual(colorizeStatus('running', false), 'running');
    assert.ok(colorizeStatus('running', true).includes('\x1b[32m'));
    assert.ok(colorizeStatus('failed', true).includes('\x1b[31m'));
    assert.ok(colorizeStatus('building', true).includes('\x1b[33m'));
    assert.strictEqual(colorizeStatus(null, true), '-');
});

// ── 4. Poll state machine ────────────────────────────────────────────────────

// 픽스처: 호출마다 다음 응답을 순서대로 반환 (마지막 응답 반복)
function fetchSequence(responses) {
    let i = 0;
    return async () => {
        const r = responses[Math.min(i, responses.length - 1)];
        i += 1;
        if (r instanceof Error) throw r;
        return r;
    };
}

const noSleep = () => Promise.resolve();

test('poll: sinceId 기준 새 배포 감지 → building→success, 상태 변화 이벤트', async () => {
    const events = [];
    const result = await pollDeployment({
        getDeployments: fetchSequence([
            [{ id: 10, status: 'success' }],                             // 아직 새 행 없음
            [{ id: 11, status: 'building' }, { id: 10, status: 'success' }],
            [{ id: 11, status: 'building' }, { id: 10, status: 'success' }], // 변화 없음 → 이벤트 없음
            [{ id: 11, status: 'success' }, { id: 10, status: 'success' }],
        ]),
        sinceId: 10,
        sleep: noSleep,
        onEvent: (e) => events.push(e.deployment.status),
    });
    assert.strictEqual(result.outcome, 'success');
    assert.strictEqual(result.deployment.id, 11);
    assert.deepStrictEqual(events, ['building', 'success']);
});

test('poll: building→failed', async () => {
    const result = await pollDeployment({
        getDeployments: fetchSequence([
            [{ id: 5, status: 'building' }],
            [{ id: 5, status: 'failed' }],
        ]),
        deploymentId: 5,
        sleep: noSleep,
    });
    assert.strictEqual(result.outcome, 'failed');
});

test('poll: queued→building→success (deploymentId 추적, 롤백 경로)', async () => {
    const events = [];
    const result = await pollDeployment({
        getDeployments: fetchSequence([
            [{ id: 7, status: 'queued' }],
            [{ id: 7, status: 'building' }],
            [{ id: 7, status: 'success' }],
        ]),
        deploymentId: 7,
        sleep: noSleep,
        onEvent: (e) => events.push(e.deployment.status),
    });
    assert.strictEqual(result.outcome, 'success');
    assert.deepStrictEqual(events, ['queued', 'building', 'success']);
});

test('poll: timeout — 종결 상태가 안 나오면 timeoutMs 후 종료', async () => {
    let t = 0;
    const result = await pollDeployment({
        getDeployments: fetchSequence([[{ id: 3, status: 'building' }]]),
        deploymentId: 3,
        sleep: noSleep,
        now: () => { t += 4000; return t; },   // 매 확인마다 4초 경과
        timeoutMs: 20000,
    });
    assert.strictEqual(result.outcome, 'timeout');
    assert.strictEqual(result.deployment.id, 3);
});

test('poll: 조회 실패 연속 누적 → error (일시 오류는 통과)', async () => {
    // 일시 오류 1번 후 성공 → 정상 종결
    const ok = await pollDeployment({
        getDeployments: fetchSequence([new Error('ECONNRESET'), [{ id: 1, status: 'success' }]]),
        deploymentId: 1,
        sleep: noSleep,
    });
    assert.strictEqual(ok.outcome, 'success');

    // 계속 실패 → error 종결 (무한 루프 안 됨)
    const bad = await pollDeployment({
        getDeployments: async () => { throw new Error('ECONNREFUSED'); },
        deploymentId: 1,
        sleep: noSleep,
        timeoutMs: Number.MAX_SAFE_INTEGER,
    });
    assert.strictEqual(bad.outcome, 'error');
    assert.match(bad.error.message, /ECONNREFUSED/);
});

// ── 5. Config file ───────────────────────────────────────────────────────────

test('config: write → chmod 600, read 왕복, clear', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitronrc-'));
    const file = path.join(dir, '.orbitronrc');
    try {
        const cfg = { server: 'http://localhost:4000', token: 'opat_' + 'a'.repeat(40), tokenType: 'pat', patId: 3 };
        writeConfig(file, cfg);
        assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
        assert.deepStrictEqual(readConfig(file), cfg);

        // 이미 존재하는 파일(다른 권한) 덮어쓰기 → 다시 600
        fs.chmodSync(file, 0o644);
        writeConfig(file, cfg);
        assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);

        assert.strictEqual(clearConfig(file), true);
        assert.strictEqual(fs.existsSync(file), false);
        assert.strictEqual(clearConfig(file), false); // 이미 없음 — 멱등
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('config: 없는/깨진 파일 → {}', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitronrc-'));
    const file = path.join(dir, '.orbitronrc');
    try {
        assert.deepStrictEqual(readConfig(file), {});
        fs.writeFileSync(file, 'not json{{{');
        assert.deepStrictEqual(readConfig(file), {});
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('config: normalizeServerUrl — 스킴 보정/슬래시 제거', () => {
    assert.strictEqual(normalizeServerUrl('orbitron.twinverse.org'), 'https://orbitron.twinverse.org');
    assert.strictEqual(normalizeServerUrl('http://localhost:4000/'), 'http://localhost:4000');
    assert.strictEqual(normalizeServerUrl('https://x.example//'), 'https://x.example');
});

test('config: isInsecureServerUrl — 비-localhost http 만 경고 대상', () => {
    assert.strictEqual(isInsecureServerUrl('http://orbitron.example.com'), true);
    assert.strictEqual(isInsecureServerUrl('http://192.168.219.117:4000'), true);
    assert.strictEqual(isInsecureServerUrl('https://orbitron.example.com'), false);
    assert.strictEqual(isInsecureServerUrl('http://localhost:4000'), false);
    assert.strictEqual(isInsecureServerUrl('http://127.0.0.1:4000'), false);
    assert.strictEqual(isInsecureServerUrl('http://[::1]:4000'), false);
    assert.strictEqual(isInsecureServerUrl('http://app.localhost:4000'), false);
    assert.strictEqual(isInsecureServerUrl('not a url'), false);
});

// ── 5b. previews rm 확인 프롬프트 (파괴적 작업 — y/N) ────────────────────────

// HANDLERS.previews 를 주입 컨텍스트로 직접 실행 — 네트워크/서버 없음
function previewsRmContext({ answer, deletions, questions }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitronrm-'));
    const configFile = path.join(dir, '.orbitronrc');
    writeConfig(configFile, { server: 'http://fake', token: 'opat_' + 'a'.repeat(40) });
    const out = { buf: '', write(s) { this.buf += s; } };
    return {
        dir,
        out,
        ctx: {
            parsed: { command: 'previews', action: 'rm', project: 'myapp', pr: 7 },
            env: { NO_COLOR: '1' },
            stdout: out,
            stderr: out,
            configFile,
            isTTY: false,
            makeClient: () => ({
                projects: async () => [{ id: 1, name: 'My App', subdomain: 'myapp' }],
                deletePreview: async (id, pr) => { deletions.push([id, pr]); return { success: true }; },
            }),
            ask: async (q) => { questions.push(q); return answer; },
            getGitRemote: () => null,
            cwd: '/tmp',
        },
    };
}

test('previews rm: y 응답 → 삭제, 프롬프트에 프로젝트/PR 번호 포함', async () => {
    const deletions = []; const questions = [];
    const { dir, ctx } = previewsRmContext({ answer: 'y', deletions, questions });
    try {
        const code = await HANDLERS.previews(ctx);
        assert.strictEqual(code, EXIT.OK);
        assert.deepStrictEqual(deletions, [[1, 7]]);
        assert.strictEqual(questions.length, 1);
        assert.match(questions[0], /myapp/);
        assert.match(questions[0], /#7/);
        assert.match(questions[0], /\[y\/N\]/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('previews rm: 기본값(빈 입력)/n 응답 → 삭제 안 함, exit 0', async () => {
    for (const answer of ['', 'n', 'N', 'nope']) {
        const deletions = []; const questions = [];
        const { dir, ctx, out } = previewsRmContext({ answer, deletions, questions });
        try {
            const code = await HANDLERS.previews(ctx);
            assert.strictEqual(code, EXIT.OK);
            assert.deepStrictEqual(deletions, []);
            assert.match(out.buf, /취소|Cancelled/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
});

// ── 5c. deploy: 트리거 전 기준점 조회 실패 → 추적 생략 (가짜 성공 방지) ──────

// POST /:id/deploy 는 배포 행 insert 전에 응답하므로, 기준점(sinceId) 없이
// 폴링하면 기존 최신 'success' 행을 붙잡아 즉시 가짜 성공이 된다. 그래서
// 기준점 조회 실패 시: 1회 재시도 → 그래도 실패면 추적을 건너뛰고 exit 1.
function deployContext({ deployments, deployCalls, out, err }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitrondep-'));
    const configFile = path.join(dir, '.orbitronrc');
    writeConfig(configFile, { server: 'http://fake', token: 'opat_' + 'a'.repeat(40) });
    return {
        dir,
        ctx: {
            parsed: { command: 'deploy', project: 'myapp' },
            env: { NO_COLOR: '1' },
            stdout: out,
            stderr: err,
            configFile,
            isTTY: false,
            makeClient: () => ({
                projects: async () => [{ id: 1, name: 'My App', subdomain: 'myapp' }],
                deployments,
                deployProject: async (id) => { deployCalls.push(id); return { message: 'Deployment started' }; },
            }),
            sleep: () => Promise.resolve(),
            now: Date.now,
            getGitRemote: () => null,
            cwd: '/tmp',
        },
    };
}

test('deploy: 기준점 조회 2회 모두 실패 → 배포는 트리거, 추적 생략, exit 1', async () => {
    const deployCalls = [];
    let fetches = 0;
    const out = { buf: '', write(s) { this.buf += s; } };
    const err = { buf: '', write(s) { this.buf += s; } };
    const { dir, ctx } = deployContext({
        deployments: async () => { fetches += 1; throw new Error('ECONNRESET'); },
        deployCalls, out, err,
    });
    try {
        const code = await HANDLERS.deploy(ctx);
        assert.strictEqual(code, 1);
        assert.deepStrictEqual(deployCalls, [1]);          // 배포 자체는 트리거됨
        assert.strictEqual(fetches, 2);                    // 재시도 1회 포함 정확히 2회
        assert.match(err.buf, /상태 추적 불가/);
        assert.match(err.buf, /orbitron status/);
        assert.doesNotMatch(out.buf, /배포 성공|succeeded/); // 가짜 성공 없음
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('deploy: 1회 실패 후 재시도 성공 → 정상 추적, 옛 success 행은 무시', async () => {
    const deployCalls = [];
    let fetches = 0;
    const out = { buf: '', write(s) { this.buf += s; } };
    const err = { buf: '', write(s) { this.buf += s; } };
    const { dir, ctx } = deployContext({
        deployments: async () => {
            fetches += 1;
            if (fetches === 1) throw new Error('ECONNRESET');          // 기준점 1차 실패
            if (fetches === 2) return [{ id: 40, status: 'success' }]; // 재시도 성공 → sinceId=40
            if (fetches === 3) return [{ id: 40, status: 'success' }]; // 새 행 아직 없음 — 옛 행 무시
            return [{ id: 41, status: 'success' }, { id: 40, status: 'success' }];
        },
        deployCalls, out, err,
    });
    try {
        const code = await HANDLERS.deploy(ctx);
        assert.strictEqual(code, 0);
        assert.deepStrictEqual(deployCalls, [1]);
        assert.match(out.buf, /배포 성공|succeeded/);
        assert.strictEqual(err.buf, '');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// ── 6. Exit-code mapping ─────────────────────────────────────────────────────

test('exit codes: UsageError→2, AuthError→3, ApiError/일반→1', () => {
    assert.strictEqual(exitCodeFor(new UsageError('u')), 2);
    assert.strictEqual(exitCodeFor(new AuthError('a')), 3);
    assert.strictEqual(exitCodeFor(new ApiError('x', 500)), 1);
    assert.strictEqual(exitCodeFor(new Error('generic')), 1);
    assert.strictEqual(EXIT.OK, 0);
});

// ── 7. API client error mapping ──────────────────────────────────────────────

function fakeResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => (body === undefined ? '' : JSON.stringify(body)),
    };
}

test('api: 401 → AuthError, 4xx/5xx → ApiError(status/code), 네트워크 → ApiError', async () => {
    const client401 = new ApiClient({ server: 'http://x', token: 't', fetchImpl: async () => fakeResponse(401, { error: 'expired' }) });
    await assert.rejects(() => client401.projects(), AuthError);

    const client409 = new ApiClient({ server: 'http://x', token: 't', fetchImpl: async () => fakeResponse(409, { error: 'busy', code: 'DEPLOY_IN_PROGRESS' }) });
    await assert.rejects(() => client409.rollback(1), (e) => e instanceof ApiError && e.status === 409 && e.code === 'DEPLOY_IN_PROGRESS');

    const clientDown = new ApiClient({ server: 'http://x', fetchImpl: async () => { throw new Error('fetch failed'); } });
    await assert.rejects(() => clientDown.projects(), (e) => e instanceof ApiError && /fetch failed/.test(e.message));
});

test('api: Authorization 헤더는 토큰 있을 때만, 요청 형태 고정', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return fakeResponse(200, []); };

    await new ApiClient({ server: 'http://x/', token: 'tok', fetchImpl }).deployments(5);
    assert.strictEqual(calls[0].url, 'http://x/api/deployments/5');   // 끝 슬래시 정규화
    assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer tok');

    await new ApiClient({ server: 'http://x', fetchImpl }).login('e@x.com', 'pw');
    assert.strictEqual(calls[1].init.headers.Authorization, undefined);
    assert.deepStrictEqual(JSON.parse(calls[1].init.body), { email: 'e@x.com', password: 'pw' });
});
