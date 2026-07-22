-- Migration: scheduled_jobs table (2026-07-22, Task 3.3 — per-project cron jobs)
--
-- Why: CronRunner (services/cron.js) evaluates enabled jobs every minute and
-- runs `docker exec <container_id> sh -c <command>` inside the project's
-- container (60s timeout, output truncated to 4KB into last_output).
-- Managed via routes/cron.js CRUD (max 10 jobs per project, name unique per
-- project via the UNIQUE constraint below).
--
-- Idempotent — safe to re-run. Run manually on the production DB at merge time
-- (Orbitron has no migration framework; db/schema.sql is the reference definition).

CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    schedule VARCHAR(100) NOT NULL,
    command TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    last_status VARCHAR(20),
    last_output TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, name)
);
