'use strict';

// Personal Access Token rules (Task 3.2 — Orbitron CLI).
//
// 순수 헬퍼만 모아둔 모듈 — DB/Express 없이 테스트 가능 (test/patRules.test.js).
// 토큰 형식: opat_<40 hex> (20 random bytes). JWT 는 항상 'eyJ' 로 시작하므로
// 접두사 'opat_' 와 충돌하지 않는다 — middleware/auth.js 가 이 형식일 때만
// DB 조회 분기를 타고, 그 외에는 기존 JWT 경로를 그대로 사용한다.
// DB 에는 토큰 원문이 아니라 SHA-256 hex 해시만 저장한다.

const crypto = require('crypto');

const PAT_PREFIX = 'opat_';
const PAT_REGEX = /^opat_[0-9a-f]{40}$/;
const NAME_MAX_LENGTH = 100;

// 새 PAT 원문 생성 — 발급 응답에서 딱 한 번 노출되고 이후엔 해시만 남는다.
function generatePatToken() {
    return PAT_PREFIX + crypto.randomBytes(20).toString('hex');
}

// 토큰이 PAT 형식인지 (미들웨어 분기 조건 — false 면 JWT 경로)
function isPatToken(token) {
    return typeof token === 'string' && PAT_REGEX.test(token);
}

// DB 저장/조회용 SHA-256 hex 해시
function hashPatToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// 토큰 이름 정리: 문자열 아님/공백 → 'cli', 100자 초과 → 절단, 제어문자 제거
function sanitizePatName(name) {
    if (typeof name !== 'string') return 'cli';
    // eslint-disable-next-line no-control-regex
    const cleaned = name.replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (!cleaned) return 'cli';
    return cleaned.slice(0, NAME_MAX_LENGTH);
}

module.exports = { PAT_PREFIX, generatePatToken, isPatToken, hashPatToken, sanitizePatName, NAME_MAX_LENGTH };
