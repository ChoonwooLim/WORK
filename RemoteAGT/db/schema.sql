-- RemoteAGT Database Schema
-- Extends the shared Orbitron PostgreSQL database

-- Authorized users (SNS account mapping)
CREATE TABLE IF NOT EXISTS ragt_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    platform_user_id VARCHAR(100) NOT NULL,
    auth_level INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(platform, platform_user_id)
);

-- Task queue history
CREATE TABLE IF NOT EXISTS ragt_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES ragt_users(id),
    platform VARCHAR(20) NOT NULL,
    command_raw TEXT NOT NULL,
    command_parsed JSONB,
    intent VARCHAR(50),
    priority INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'queued',
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Monitoring metrics (time-series)
CREATE TABLE IF NOT EXISTS ragt_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(50) NOT NULL,
    metric_value NUMERIC NOT NULL,
    labels JSONB,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Notification history
CREATE TABLE IF NOT EXISTS ragt_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES ragt_users(id),
    platform VARCHAR(20) NOT NULL,
    message_type VARCHAR(30),
    content TEXT NOT NULL,
    is_delivered BOOLEAN DEFAULT false,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log (security)
CREATE TABLE IF NOT EXISTS ragt_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES ragt_users(id),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ragt_metrics_time ON ragt_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ragt_metrics_name ON ragt_metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ragt_tasks_status ON ragt_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ragt_users_platform ON ragt_users(platform, platform_user_id);
