-- RemoteAGT Database Schema
-- Extends the shared Orbitron PostgreSQL database

-- Web Dashboard Users (email/password login)
CREATE TABLE IF NOT EXISTS ragt_web_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',            -- 'user', 'admin', 'superadmin'
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- SNS platform linked accounts
CREATE TABLE IF NOT EXISTS ragt_users (
    id SERIAL PRIMARY KEY,
    web_user_id INTEGER REFERENCES ragt_web_users(id),
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
    web_user_id INTEGER REFERENCES ragt_web_users(id),
    platform VARCHAR(20) NOT NULL DEFAULT 'web',
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
    web_user_id INTEGER REFERENCES ragt_web_users(id),
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
    web_user_id INTEGER REFERENCES ragt_web_users(id),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

-- User sessions (active login tracking)
CREATE TABLE IF NOT EXISTS ragt_sessions (
    id SERIAL PRIMARY KEY,
    web_user_id INTEGER REFERENCES ragt_web_users(id),
    token_hash VARCHAR(200) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ragt_metrics_time ON ragt_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ragt_metrics_name ON ragt_metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ragt_tasks_status ON ragt_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ragt_users_platform ON ragt_users(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_ragt_web_users_email ON ragt_web_users(email);
CREATE INDEX IF NOT EXISTS idx_ragt_audit_time ON ragt_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ragt_sessions_user ON ragt_sessions(web_user_id);
