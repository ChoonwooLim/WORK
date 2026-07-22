'use strict';

// Tests for services/docker.js — BuildKit + cache-mount support (Task 1.1)
// and per-deploy image tagging (Task 1.2).
//
// Pins:
//   1. docker build 인자에 --progress=plain 포함 + DOCKER_BUILDKIT=1 env 강제
//   2. 자동 생성 Dockerfile 템플릿의 npm/pip 설치 단계에 RUN --mount=type=cache
//      (npm → /root/.npm, pip → /root/.cache/pip)
//   3. 사용자 정의 Dockerfile (orbitron.yaml build.dockerfile / "# CUSTOM") 은
//      절대 자동 생성으로 대체되지 않음 (2026-04-26 규칙)
//   4. 배포별 이미지 태그: orbitron-<sub>:d<deploymentId> 이중 태깅 + 보존 라벨,
//      retention 선택은 숫자 정렬 (d9 < d10), DEPLOY_IMAGE_RETENTION env 파싱
//
// NEVER invokes docker — 순수 문자열/파일시스템 fixture 만 사용.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const docker = require('../services/docker');

// js-yaml 은 런타임 의존성 — node_modules 없는 환경(pre-commit zero-dep 게이트)에서는
// yaml 경로 테스트만 건너뛴다.
let hasJsYaml = true;
try { require.resolve('js-yaml'); } catch { hasJsYaml = false; }

// fixture 디렉토리 추적 → 종료 시 일괄 정리 (nginxManualConf.test.js 패턴)
const tmpDirs = [];

test.after(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function makeTmpProject(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitron-dockerbuild-test-'));
    tmpDirs.push(dir);
    for (const [rel, content] of Object.entries(files)) {
        const abs = path.join(dir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    return dir;
}

const NPM_MOUNT = '--mount=type=cache,target=/root/.npm';
const PIP_MOUNT = '--mount=type=cache,target=/root/.cache/pip';

// ── 1. Build args / env assembly ─────────────────────────────────────────────

test('assembleBuildArgs includes --progress=plain and image tag', () => {
    const args = docker.assembleBuildArgs({ subdomain: 'myapp' }, 'orbitron-myapp', '/deploy/myapp');
    assert.deepStrictEqual(args, ['build', '--progress=plain', '-t', 'orbitron-myapp', '/deploy/myapp']);
});

test('assembleBuildArgs honors DOCKER_NO_CACHE=true', () => {
    const project = { subdomain: 'myapp', env_vars: { DOCKER_NO_CACHE: 'true' } };
    const args = docker.assembleBuildArgs(project, 'orbitron-myapp', '/deploy/myapp');
    assert.ok(args.includes('--no-cache'));
    assert.ok(args.includes('--progress=plain'));
    // 순서: build 가 첫 인자, 빌드 컨텍스트가 마지막 인자
    assert.strictEqual(args[0], 'build');
    assert.strictEqual(args[args.length - 1], '/deploy/myapp');
});

test('buildKitEnv forces DOCKER_BUILDKIT=1 and inherits process.env', () => {
    const env = docker.buildKitEnv();
    assert.strictEqual(env.DOCKER_BUILDKIT, '1');
    assert.strictEqual(env.PATH, process.env.PATH);
});

// ── 1b. Per-deploy image tags (Task 1.2) ─────────────────────────────────────

test('assembleBuildArgs with deploy tag adds second -t and retention label (exact array)', () => {
    const args = docker.assembleBuildArgs(
        { subdomain: 'myapp' }, 'orbitron-myapp', '/deploy/myapp', 'orbitron-myapp:d42'
    );
    assert.deepStrictEqual(args, [
        'build', '--progress=plain',
        '-t', 'orbitron-myapp',
        '-t', 'orbitron-myapp:d42',
        '--label', 'orbitron.deploy-image=true',
        '/deploy/myapp',
    ]);
});

test('assembleBuildArgs with deploy tag honors DOCKER_NO_CACHE (exact array)', () => {
    const project = { subdomain: 'myapp', env_vars: { DOCKER_NO_CACHE: 'true' } };
    const args = docker.assembleBuildArgs(project, 'orbitron-myapp', '/deploy/myapp', 'orbitron-myapp:d7');
    assert.deepStrictEqual(args, [
        'build', '--progress=plain', '--no-cache',
        '-t', 'orbitron-myapp',
        '-t', 'orbitron-myapp:d7',
        '--label', 'orbitron.deploy-image=true',
        '/deploy/myapp',
    ]);
});

test('formatDeployTag formats orbitron-<sub>:d<id>', () => {
    assert.strictEqual(docker.formatDeployTag('orbitron-myapp', 42), 'orbitron-myapp:d42');
    // 문자열 숫자 id 도 허용 (DB 드라이버가 문자열로 돌려줄 수 있음)
    assert.strictEqual(docker.formatDeployTag('orbitron-myapp', '7'), 'orbitron-myapp:d7');
});

test('formatDeployTag rejects invalid deployment ids', () => {
    assert.strictEqual(docker.formatDeployTag('orbitron-myapp', undefined), null);
    assert.strictEqual(docker.formatDeployTag('orbitron-myapp', null), null);
    assert.strictEqual(docker.formatDeployTag('orbitron-myapp', 0), null);
    assert.strictEqual(docker.formatDeployTag('orbitron-myapp', -3), null);
    assert.strictEqual(docker.formatDeployTag('orbitron-myapp', 'abc'), null);
});

test('deployImageRetention parses value with fallback 3 on invalid input', () => {
    assert.strictEqual(docker.deployImageRetention(undefined), 3);
    assert.strictEqual(docker.deployImageRetention('5'), 5);
    assert.strictEqual(docker.deployImageRetention('1'), 1);
    assert.strictEqual(docker.deployImageRetention('abc'), 3);
    assert.strictEqual(docker.deployImageRetention(''), 3);
    assert.strictEqual(docker.deployImageRetention('0'), 3);
    assert.strictEqual(docker.deployImageRetention('-2'), 3);
});

test('deployImageRetention defaults from DEPLOY_IMAGE_RETENTION env', () => {
    const saved = process.env.DEPLOY_IMAGE_RETENTION;
    try {
        process.env.DEPLOY_IMAGE_RETENTION = '7';
        assert.strictEqual(docker.deployImageRetention(), 7);
        delete process.env.DEPLOY_IMAGE_RETENTION;
        assert.strictEqual(docker.deployImageRetention(), 3);
    } finally {
        if (saved === undefined) delete process.env.DEPLOY_IMAGE_RETENTION;
        else process.env.DEPLOY_IMAGE_RETENTION = saved;
    }
});

test('selectDeployTagsToRemove keeps N newest by NUMERIC id (d9 vs d10 vs d11)', () => {
    const tags = ['orbitron-x:d9', 'orbitron-x:d10', 'orbitron-x:latest', 'orbitron-x:d11', 'orbitron-x:d2'];
    // keep 3 → d11, d10, d9 생존; d2 제거 (사전순 정렬이면 d9 가 최신으로 오판됨)
    assert.deepStrictEqual(docker.selectDeployTagsToRemove(tags, 3), ['orbitron-x:d2']);
    // keep 1 → d11 만 생존, 나머지는 최신순으로 제거 목록에
    assert.deepStrictEqual(
        docker.selectDeployTagsToRemove(tags, 1),
        ['orbitron-x:d10', 'orbitron-x:d9', 'orbitron-x:d2']
    );
});

test('selectDeployTagsToRemove ignores non-deploy tags and short lists', () => {
    // latest / <none> / 숫자 아닌 태그는 절대 제거 대상이 아님
    assert.deepStrictEqual(
        docker.selectDeployTagsToRemove(['orbitron-x:latest', 'orbitron-x:<none>', 'orbitron-x:dev'], 3),
        []
    );
    // 보존 개수 이하이면 아무것도 제거하지 않음
    assert.deepStrictEqual(docker.selectDeployTagsToRemove(['orbitron-x:d1', 'orbitron-x:d2'], 3), []);
    assert.deepStrictEqual(docker.selectDeployTagsToRemove([], 3), []);
});

// ── 2. Cache mounts in auto-generated templates ──────────────────────────────

test('node template: npm install step gets /root/.npm cache mount', () => {
    const dir = makeTmpProject({ 'package.json': JSON.stringify({ name: 'x' }) });
    const df = docker.generateDockerfile({ subdomain: 'x', port: 3000 }, dir);
    assert.ok(df.includes(`RUN ${NPM_MOUNT} npm install\n`), `expected npm cache mount in:\n${df}`);
    assert.ok(df.includes('FROM node:20-alpine'));
});

test('node template: custom build_command keeps its exact command behind the mount', () => {
    const dir = makeTmpProject({ 'package.json': JSON.stringify({ name: 'x' }) });
    const df = docker.generateDockerfile({ subdomain: 'x', port: 3000, build_command: 'npm ci' }, dir);
    assert.ok(df.includes(`RUN ${NPM_MOUNT} npm ci\n`));
});

test('nextjs template: npm install step gets /root/.npm cache mount', () => {
    const dir = makeTmpProject({
        'package.json': JSON.stringify({ name: 'x', dependencies: { next: '14.0.0' } }),
    });
    const df = docker.generateDockerfile({ subdomain: 'x', port: 3000 }, dir);
    assert.ok(df.includes(`RUN ${NPM_MOUNT} npm install --legacy-peer-deps --ignore-scripts`));
});

test('fullstack python template: npm ci + pip install both get cache mounts', () => {
    const dir = makeTmpProject({
        'frontend/package.json': JSON.stringify({
            name: 'fe',
            scripts: { build: 'vite build' },
            dependencies: { react: '18.0.0', vite: '5.0.0' },
        }),
        'backend/requirements.txt': 'fastapi\nuvicorn\n',
        'backend/main.py': 'from fastapi import FastAPI\napp = FastAPI()\n',
    });
    const df = docker.generateDockerfile({ subdomain: 'x', port: 8000, name: 'x' }, dir);
    assert.ok(df.includes(`RUN ${NPM_MOUNT} npm ci\n`), `expected npm cache mount in:\n${df}`);
    assert.ok(df.includes(`RUN ${PIP_MOUNT} pip install -r requirements.txt`), `expected pip cache mount in:\n${df}`);
    // pip 캐시 마운트와 --no-cache-dir 는 상호모순 — 마운트 도입 후 제거됐어야 함
    assert.ok(!df.includes('--no-cache-dir'), 'stale --no-cache-dir defeats the pip cache mount');
});

test('fullstack python template: extra frontend app stages also get npm cache mount', () => {
    const dir = makeTmpProject({
        'frontend/package.json': JSON.stringify({
            name: 'fe',
            scripts: { build: 'vite build' },
            dependencies: { react: '18.0.0', vite: '5.0.0' },
        }),
        'backend/requirements.txt': 'flask\n',
        'backend/main.py': 'from flask import Flask\napp = Flask(__name__)\n',
        'zadmin/package.json': JSON.stringify({
            name: 'admin',
            scripts: { build: 'vite build' },
            dependencies: { react: '18.0.0', vite: '5.0.0' },
        }),
    });
    const df = docker.generateDockerfile({ subdomain: 'x', port: 8000, name: 'x' }, dir);
    const mountedNpmCi = df.split('\n').filter(l => l.startsWith(`RUN ${NPM_MOUNT} npm ci`));
    assert.strictEqual(mountedNpmCi.length, 2, `expected 2 mounted "npm ci" stages in:\n${df}`);
    // 마운트 없는 설치 단계가 남아있으면 안 됨
    assert.ok(!/^RUN npm ci$/m.test(df));
});

test('fullstack node template: frontend npm ci and backend npm install get cache mounts', () => {
    const dir = makeTmpProject({
        'frontend/package.json': JSON.stringify({
            name: 'fe',
            scripts: { build: 'vite build' },
            dependencies: { react: '18.0.0', vite: '5.0.0' },
        }),
        'backend/package.json': JSON.stringify({ name: 'be', dependencies: { express: '4.0.0' } }),
    });
    const df = docker.generateDockerfile({ subdomain: 'x', port: 3000, name: 'x' }, dir);
    assert.ok(df.includes(`RUN ${NPM_MOUNT} npm ci\n`));
    assert.ok(df.includes(`RUN ${NPM_MOUNT} npm install --production\n`));
});

test('static template has no cache mounts (unchanged)', () => {
    const dir = makeTmpProject({ 'index.html': '<html></html>' });
    const df = docker.generateDockerfile({ subdomain: 'x', port: 3000 }, dir);
    assert.ok(!df.includes('--mount='));
    assert.ok(df.startsWith('FROM nginx:alpine'));
});

// ── 3. User-specified Dockerfile bypass (자동 생성 금지 규칙) ─────────────────

test('legacy "# CUSTOM" Dockerfile marker bypasses template generation', () => {
    const dir = makeTmpProject({ 'Dockerfile': '# CUSTOM\nFROM scratch\n' });
    const { useCustom } = docker.resolveCustomDockerfile(dir);
    assert.strictEqual(useCustom, true);
});

test('no marker and no orbitron.yaml → auto-generation path', () => {
    const dir = makeTmpProject({ 'Dockerfile': 'FROM scratch\n' });
    const { useCustom } = docker.resolveCustomDockerfile(dir);
    assert.strictEqual(useCustom, false);
});

test('orbitron.yaml build.dockerfile bypasses template generation', { skip: !hasJsYaml && 'js-yaml unavailable (zero-dep env)' }, () => {
    const dir = makeTmpProject({
        'orbitron.yaml': 'build:\n  dockerfile: Dockerfile.prod\n',
        'Dockerfile.prod': 'FROM scratch\nCMD ["true"]\n',
    });
    const { useCustom } = docker.resolveCustomDockerfile(dir);
    assert.strictEqual(useCustom, true);
    // 명시된 파일이 빌드 위치(Dockerfile)로 복사되고 내용은 그대로여야 함
    assert.strictEqual(fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf-8'), 'FROM scratch\nCMD ["true"]\n');
});

test('orbitron.yaml build.dockerfile pointing at missing file falls back to auto-detect', { skip: !hasJsYaml && 'js-yaml unavailable (zero-dep env)' }, () => {
    const dir = makeTmpProject({ 'orbitron.yaml': 'build:\n  dockerfile: nope.Dockerfile\n' });
    const { useCustom } = docker.resolveCustomDockerfile(dir);
    assert.strictEqual(useCustom, false);
});
