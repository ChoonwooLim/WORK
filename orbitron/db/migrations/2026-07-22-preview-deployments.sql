-- Migration: PR preview deployments (2026-07-22, Task 3.1)
--
-- Why: GitHub pull_request webhooks (opened/synchronize/reopened) can spin up a
-- throwaway preview environment per PR at pr-<n>-<subdomain>, torn down on PR
-- close or by a 7-day TTL sweep. Previews get their OWN table — the projects
-- table is never mutated by the preview flow.
--
-- v1 caveats (documented in services/previewRules.js):
--   - previews share the parent project's database (writes hit the real DB)
--   - same-repo PRs only (fork PRs are skipped for security)
--   - opt-in per project via projects.preview_deploys (default false)
--
-- Idempotent — safe to re-run. Run manually on the production DB at merge time
-- (Orbitron has no migration framework; db/schema.sql is the reference definition).

CREATE TABLE IF NOT EXISTS preview_deployments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pr_number INTEGER NOT NULL,
    branch VARCHAR(200),
    subdomain VARCHAR(150) UNIQUE NOT NULL,
    container_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'building',
    last_commit VARCHAR(40),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, pr_number)
);

-- Opt-in flag: preview deploys are off unless the project owner enables them
ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_deploys BOOLEAN DEFAULT false;
