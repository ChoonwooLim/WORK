-- Migration: personal_access_tokens (2026-07-22, Task 3.2 — Orbitron CLI)
--
-- Why: 대시보드 JWT 는 7일 만료라 CLI 에 저장해 쓰기엔 매주 재로그인이 필요.
-- CLI 는 로그인 직후 PAT 를 발급받아 ~/.orbitronrc 에 저장한다 (logout 시 폐기).
-- 토큰 원문은 저장하지 않고 SHA-256 해시만 저장 — 발급 응답에서 딱 한 번 노출.
-- 폐기(revoke)는 행 삭제 (DELETE /api/auth/tokens/:id).
--
-- Idempotent — safe to re-run. Run manually on the production DB at merge time
-- (Orbitron has no migration framework; db/schema.sql is the reference definition).

CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    -- SHA-256 hex digest of the full token (opat_<40 hex>) — 원문은 저장 안 함
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP
);
