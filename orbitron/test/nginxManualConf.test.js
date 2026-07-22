// Tests for the manual nginx conf protection flag (# orbitron:manual).
//
// Contract: a conf file is "manually managed" if the string `# orbitron:manual`
// appears anywhere in the FIRST 512 BYTES of the file. Orbitron must never
// overwrite (addProject) or delete (removeProject) such a file.
//
// All file fixtures live in a mkdtemp dir — NEVER in infrastructure/nginx/conf.d/.
// NGINX_CONF_DIR must be set BEFORE requiring the service.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitron-nginx-test-'));
process.env.NGINX_CONF_DIR = tmpDir;

const nginxService = require('../services/nginx');
const { isManuallyManaged, ManualConfProtectedError } = nginxService;

// Safety stub: tests must never touch the real dev-nginx container.
// Track calls so we can assert reload is NOT triggered for protected confs.
let reloadCalls = 0;
nginxService.reload = async () => { reloadCalls += 1; };

const MARKER_LINE = '# orbitron:manual — 이 파일은 수동 관리됨. Orbitron이 덮어쓰기/삭제하지 않는다.\n';

function writeConf(subdomain, content) {
    const p = path.join(tmpDir, `${subdomain}.conf`);
    fs.writeFileSync(p, content);
    return p;
}

test('isManuallyManaged: marker at line 1 (within first 512 bytes) → true', () => {
    const p = writeConf('manual-top', MARKER_LINE + 'server { listen 80; }\n');
    assert.strictEqual(isManuallyManaged(p), true);
});

test('isManuallyManaged: marker ending just inside the 512-byte window → true', () => {
    const marker = '# orbitron:manual';
    const pad = '#'.repeat(512 - marker.length - 1) + '\n'; // marker occupies bytes 495..511
    const p = writeConf('manual-edge', pad.slice(0, 512 - marker.length) + marker + '\nserver {}\n');
    assert.strictEqual(isManuallyManaged(p), true);
});

test('isManuallyManaged: marker only after byte 512 → false', () => {
    const pad = ('# filler comment line\n').repeat(40); // > 512 bytes of padding
    assert.ok(Buffer.byteLength(pad) > 512, 'test fixture must pad past 512 bytes');
    const p = writeConf('manual-late', pad + '# orbitron:manual\nserver {}\n');
    assert.strictEqual(isManuallyManaged(p), false);
});

test('isManuallyManaged: nonexistent path → false', () => {
    assert.strictEqual(isManuallyManaged(path.join(tmpDir, 'does-not-exist.conf')), false);
});

test('ManualConfProtectedError has code MANUAL_CONF_PROTECTED', () => {
    const err = new ManualConfProtectedError('somesub');
    assert.ok(err instanceof Error);
    assert.strictEqual(err.code, 'MANUAL_CONF_PROTECTED');
    assert.match(err.message, /somesub/);
    assert.match(err.message, /# orbitron:manual/);
    assert.match(err.message, /수동 관리/);
});

test('addProject: protected conf → throws ManualConfProtectedError, file byte-identical', async () => {
    const sub = 'protectedapp';
    const original = MARKER_LINE + '# hand-written TLS passthrough\nserver { listen 80; return 200; }\n';
    const confPath = writeConf(sub, original);
    const before = fs.readFileSync(confPath);
    const reloadsBefore = reloadCalls;

    // The guard must run BEFORE generateConfig — a project object with just
    // `subdomain` must be enough to reach (and trip) the guard.
    await assert.rejects(
        () => nginxService.addProject({ subdomain: sub }),
        (err) => {
            assert.ok(err instanceof ManualConfProtectedError, `expected ManualConfProtectedError, got: ${err && err.constructor.name}: ${err && err.message}`);
            assert.strictEqual(err.code, 'MANUAL_CONF_PROTECTED');
            return true;
        }
    );

    const after = fs.readFileSync(confPath);
    assert.ok(before.equals(after), 'protected conf file must remain byte-identical');
    assert.strictEqual(reloadCalls, reloadsBefore, 'nginx reload must not run for a protected conf');
});

test('addProject: unsafe subdomain still rejected under NGINX_CONF_DIR override', async () => {
    await assert.rejects(
        () => nginxService.addProject({ subdomain: '../evil' }),
        /Unsafe subdomain/
    );
    assert.ok(!fs.existsSync(path.resolve(tmpDir, '..', 'evil.conf')), 'no file may be written outside the conf dir');
});

test('removeProject: protected conf → returns without deleting, no throw', async () => {
    const sub = 'protecteddel';
    const original = MARKER_LINE + 'server { listen 80; }\n';
    const confPath = writeConf(sub, original);
    const before = fs.readFileSync(confPath);
    const reloadsBefore = reloadCalls;

    await nginxService.removeProject(sub); // must NOT throw

    assert.ok(fs.existsSync(confPath), 'protected conf must survive removeProject');
    assert.ok(before.equals(fs.readFileSync(confPath)), 'protected conf must remain byte-identical');
    assert.strictEqual(reloadCalls, reloadsBefore, 'nginx reload must not run for a protected conf');
});

test('removeProject: unmarked conf is still deleted (no behavior change)', async () => {
    const sub = 'ordinaryapp';
    const confPath = writeConf(sub, '# Auto-generated by Orbitron\nserver { listen 80; }\n');

    await nginxService.removeProject(sub);

    assert.ok(!fs.existsSync(confPath), 'unmarked conf must be deleted as before');
});
