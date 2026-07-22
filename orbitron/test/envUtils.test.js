'use strict';

// Characterization tests for services/envUtils.js — the managed-DB URL
// normalizer that fixes the recurring-502 bug where a DATABASE_URL pointed
// at the host-mapped port (orbitron-<name>-db:<host-port>) instead of the
// Docker-internal port 5432 (context: commit 3362f6b).
//
// These tests pin the shipped production behavior. Do not "fix" surprising
// expectations here without changing the module deliberately.

const test = require('node:test');
const assert = require('node:assert');

const { managedDatabaseUrl, shouldReplaceManagedDatabaseUrl } = require('../services/envUtils');

// Canonical internal target the deployer computes for a managed Postgres DB.
const TARGET = 'postgresql://appuser:secret@orbitron-myapp-db:5432/mydb';

test('rewrites host-mapped managed-DB port to internal 5432 (recurring-502 fix)', () => {
    const current = 'postgresql://appuser:secret@orbitron-myapp-db:3719/mydb';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), true);
    assert.strictEqual(managedDatabaseUrl(current, TARGET), TARGET);
});

test('keeps URL untouched when host and port already match the target', () => {
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(TARGET, TARGET), false);
    assert.strictEqual(managedDatabaseUrl(TARGET, TARGET), TARGET);
});

test('preserves SQLAlchemy +psycopg driver through the rewrite', () => {
    const current = 'postgresql+psycopg://appuser:secret@orbitron-myapp-db:3719/mydb';
    assert.strictEqual(
        managedDatabaseUrl(current, TARGET),
        'postgresql+psycopg://appuser:secret@orbitron-myapp-db:5432/mydb'
    );
});

test('does not preserve driver when base protocols differ', () => {
    // mysql vs postgresql: base schemes differ, so the target protocol wins.
    const current = 'mysql://appuser:secret@localhost:3306/mydb';
    assert.strictEqual(managedDatabaseUrl(current, TARGET), TARGET);
});

test('empty or missing current URL is replaced with the target as-is', () => {
    assert.strictEqual(shouldReplaceManagedDatabaseUrl('', TARGET), true);
    assert.strictEqual(managedDatabaseUrl('', TARGET), TARGET);
    assert.strictEqual(managedDatabaseUrl(null, TARGET), TARGET);
    assert.strictEqual(managedDatabaseUrl(undefined, TARGET), TARGET);
});

test('localhost hostnames are always replaced', () => {
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0']) {
        const current = `postgresql://u:p@${host}:5432/mydb`;
        assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), true, host);
        assert.strictEqual(managedDatabaseUrl(current, TARGET), TARGET, host);
    }
});

test('IPv6 loopback [::1] is NOT recognized as localhost (pinned quirk)', () => {
    // isLocalHost() lists '::1', but WHATWG URL reports the hostname as
    // '[::1]' (with brackets), so the entry never matches through the
    // exported functions. Host differs from target, host does not start
    // with 'orbitron-', and it is not a docker-bridge IP → URL is kept.
    const current = 'postgresql://u:p@[::1]:5433/mydb';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), false);
    assert.strictEqual(managedDatabaseUrl(current, TARGET), current);
});

test('orbitron-* hostname different from target is still rewritten on port mismatch', () => {
    const current = 'postgresql://u:p@orbitron-oldname-db:3719/mydb';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), true);
    assert.strictEqual(managedDatabaseUrl(current, TARGET), TARGET);
});

test('orbitron-* hostname with matching port is kept', () => {
    const current = 'postgresql://u:p@orbitron-othername-db:5432/mydb';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), false);
    assert.strictEqual(managedDatabaseUrl(current, TARGET), current);
});

test('docker bridge IPs (172.16-31.x.x) are rewritten on port mismatch', () => {
    for (const host of ['172.16.0.2', '172.17.0.5', '172.31.255.254']) {
        const current = `postgresql://u:p@${host}:3719/mydb`;
        assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), true, host);
        assert.strictEqual(managedDatabaseUrl(current, TARGET), TARGET, host);
    }
});

test('docker bridge IP with matching port is kept', () => {
    const current = 'postgresql://u:p@172.17.0.5:5432/mydb';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), false);
    assert.strictEqual(managedDatabaseUrl(current, TARGET), current);
});

test('non-bridge private IPs are kept even on port mismatch', () => {
    for (const host of ['172.15.0.1', '172.32.0.1', '192.168.219.117', '10.0.0.7']) {
        const current = `postgresql://u:p@${host}:3719/mydb`;
        assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), false, host);
        assert.strictEqual(managedDatabaseUrl(current, TARGET), current, host);
    }
});

test('external hosts (e.g. cloud-hosted DBs) are never rewritten', () => {
    const current = 'postgresql://u:p@dpg-abc123.oregon-postgres.render.com:5432/mydb';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), false);
    assert.strictEqual(managedDatabaseUrl(current, TARGET), current);
});

test('postgres URLs default to port 5432 when omitted', () => {
    // Current omits the port, target says :5432 explicitly → treated as equal.
    const current = 'postgresql://u:p@orbitron-myapp-db/mydb';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, TARGET), false);
    assert.strictEqual(managedDatabaseUrl(current, TARGET), current);
});

test('redis URLs default to port 6379 when omitted', () => {
    // Current omits the port, target says :6379 explicitly → treated as equal.
    const target = 'redis://orbitron-myapp-redis:6379/0';
    const current = 'redis://orbitron-myapp-redis/0';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, target), false);
    assert.strictEqual(managedDatabaseUrl(current, target), current);
});

test('redis URL with host-mapped port is rewritten to the internal port', () => {
    const target = 'redis://orbitron-myapp-redis:6379/0';
    const current = 'redis://orbitron-myapp-redis:16379/0';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, target), true);
    assert.strictEqual(managedDatabaseUrl(current, target), target);
});

test('unparseable current URL does not throw; decision falls back to substring check', () => {
    // parseUrl() swallows the error; the fallback is currentUrl.includes('localhost').
    const target = TARGET;
    assert.strictEqual(shouldReplaceManagedDatabaseUrl('not a url at all', target), false);
    assert.strictEqual(managedDatabaseUrl('not a url at all', target), 'not a url at all');
    assert.strictEqual(shouldReplaceManagedDatabaseUrl('garbage localhost garbage', target), true);
    assert.strictEqual(managedDatabaseUrl('garbage localhost garbage', target), target);
});

test('unparseable target URL: localhost current is replaced with the raw target (pinned quirk)', () => {
    // When the target cannot be parsed, the decision still falls back to the
    // localhost substring check, and preserveProtocol returns the raw target
    // string unchanged — even though it is not a valid URL.
    const current = 'postgresql://u:p@localhost:5432/mydb';
    const badTarget = '::::not-a-url::::';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, badTarget), true);
    assert.strictEqual(managedDatabaseUrl(current, badTarget), badTarget);
});

test('unparseable target URL: non-localhost current is kept', () => {
    const current = 'postgresql://u:p@orbitron-myapp-db:3719/mydb';
    const badTarget = '::::not-a-url::::';
    assert.strictEqual(shouldReplaceManagedDatabaseUrl(current, badTarget), false);
    assert.strictEqual(managedDatabaseUrl(current, badTarget), current);
});
