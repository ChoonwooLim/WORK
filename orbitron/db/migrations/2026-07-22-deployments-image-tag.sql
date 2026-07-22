-- Migration: deployments.image_tag (2026-07-22, Task 1.2 — per-deploy image tagging)
--
-- Why: each build now gets a second Docker tag `orbitron-<subdomain>:d<deployment_id>`
-- alongside the overwritten `orbitron-<subdomain>` (latest). The tag of a successful
-- build is recorded here so one-click rollback (Task 2.1) can restart a previous image.
--
-- Idempotent — safe to re-run. Run manually on the production DB at merge time
-- (Orbitron has no migration framework; db/schema.sql is the reference definition).

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS image_tag VARCHAR(200);
