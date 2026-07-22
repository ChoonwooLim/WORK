'use strict';

// Tests for Personal Access Token rules (Task 3.2 — Orbitron CLI).
//
// Pins:
//   1. 토큰 형식: opat_<40 hex> — 생성물이 항상 isPatToken 을 통과
//   2. isPatToken 분기 안전성: JWT('eyJ...')/이상값이 절대 PAT 경로로 새지 않음
//   3. hashPatToken: 결정적 SHA-256 hex (64자) — DB 저장 형식 고정
//   4. sanitizePatName: 비문자열/공백 → 'cli', 100자 절단, 제어문자 제거
//
// NEVER invokes DB/Express — 순수 함수만 검증. 라우트/미들웨어 오케스트레이션은
// DB 없이 검증 불가 → 미커버.

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { generatePatToken, isPatToken, hashPatToken, sanitizePatName, PAT_PREFIX, NAME_MAX_LENGTH } = require('../services/patRules');

// ── 1. Token format ──────────────────────────────────────────────────────────

test('generatePatToken: opat_<40 hex> 형식, 매번 고유', () => {
    const a = generatePatToken();
    const b = generatePatToken();
    assert.match(a, /^opat_[0-9a-f]{40}$/);
    assert.match(b, /^opat_[0-9a-f]{40}$/);
    assert.notStrictEqual(a, b);
    assert.ok(a.startsWith(PAT_PREFIX));
});

test('generatePatToken 결과는 항상 isPatToken 통과', () => {
    for (let i = 0; i < 20; i++) {
        assert.strictEqual(isPatToken(generatePatToken()), true);
    }
});

// ── 2. isPatToken branch safety ──────────────────────────────────────────────

test('isPatToken: JWT/이상값은 전부 거부 (미들웨어 분기 안전성)', () => {
    assert.strictEqual(isPatToken('eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.sig'), false);
    assert.strictEqual(isPatToken('opat_short'), false);
    assert.strictEqual(isPatToken('opat_' + 'g'.repeat(40)), false); // hex 아님
    assert.strictEqual(isPatToken('opat_' + 'a'.repeat(41)), false); // 길이 초과
    assert.strictEqual(isPatToken('OPAT_' + 'a'.repeat(40)), false); // 대문자 접두사
    assert.strictEqual(isPatToken(''), false);
    assert.strictEqual(isPatToken(null), false);
    assert.strictEqual(isPatToken(undefined), false);
    assert.strictEqual(isPatToken(12345), false);
});

// ── 3. Hashing ───────────────────────────────────────────────────────────────

test('hashPatToken: 결정적 SHA-256 hex 64자 — DB CHAR(64) 형식과 일치', () => {
    const token = 'opat_' + 'ab'.repeat(20);
    const h = hashPatToken(token);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.strictEqual(h, hashPatToken(token)); // deterministic
    assert.strictEqual(h, crypto.createHash('sha256').update(token).digest('hex'));
    assert.notStrictEqual(h, hashPatToken('opat_' + 'cd'.repeat(20)));
});

// ── 4. Name sanitization ─────────────────────────────────────────────────────

test('sanitizePatName: 비문자열/공백 → cli, 절단, 제어문자 제거', () => {
    assert.strictEqual(sanitizePatName(undefined), 'cli');
    assert.strictEqual(sanitizePatName(null), 'cli');
    assert.strictEqual(sanitizePatName(42), 'cli');
    assert.strictEqual(sanitizePatName('   '), 'cli');
    assert.strictEqual(sanitizePatName('my-laptop'), 'my-laptop');
    assert.strictEqual(sanitizePatName('a\x00b\nc'), 'abc');
    assert.strictEqual(sanitizePatName('x'.repeat(300)).length, NAME_MAX_LENGTH);
});
