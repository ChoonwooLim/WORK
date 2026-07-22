-- Migration: metrics table (2026-07-22, Task 2.3 — hourly resource aggregates)
--
-- Why: MetricsCollector (services/metrics.js) samples docker stats every 60s
-- into an in-memory 24h ring buffer. Raw per-minute samples are NEVER written
-- to the DB (past incident: unbounded raw logging grew 158MB). Each UTC hour
-- boundary flushes one aggregate row per project, and rows older than 30 days
-- are deleted in the same batch — the table stays bounded at roughly
-- projects × 24 × 30 rows.
--
-- Idempotent — safe to re-run. Run manually on the production DB at merge time
-- (Orbitron has no migration framework; db/schema.sql is the reference definition).

CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    ts_hour TIMESTAMP NOT NULL,
    cpu_avg REAL,
    cpu_max REAL,
    mem_avg REAL,
    mem_max REAL,
    samples INTEGER,
    -- UNIQUE already creates the (project_id, ts_hour) index — no separate index needed
    UNIQUE(project_id, ts_hour)
);
