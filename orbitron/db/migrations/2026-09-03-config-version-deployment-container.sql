-- Migration: projects.config_version + deployments.container_id (2026-09-03)
--
-- Why: (1) `PUT /api/projects/:id` replaces `env_vars` wholesale, so two writers
-- (dashboard, provisioner) silently clobber each other. `config_version` is an
-- opaque monotonic counter bumped by every PUT; a caller that sends
-- `expected_config_version` gets 409 CONFIG_VERSION_MISMATCH instead of overwriting.
-- (2) Rollout evidence must prove which container actually went live, not just
-- that a build reported success — `deployments.container_id` records the started
-- container on success.
--
-- Idempotent — safe to re-run. Run manually on the production DB at merge time
-- (Orbitron has no migration framework; db/schema.sql is the reference definition).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS config_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS container_id VARCHAR(100);
