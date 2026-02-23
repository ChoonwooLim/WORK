-- Orbitron Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Accounts table: make sure it exists before projects table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    github_url VARCHAR(500),
    branch VARCHAR(100) DEFAULT 'main',
    source_type VARCHAR(20) DEFAULT 'github',
    build_command VARCHAR(500) DEFAULT 'npm install && npm run build',
    start_command VARCHAR(500) DEFAULT 'npm start',
    port INTEGER,
    subdomain VARCHAR(100) UNIQUE,
    env_vars JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'stopped',
    container_id VARCHAR(100),
    tunnel_url VARCHAR(500),
    custom_domain VARCHAR(500),
    auto_deploy BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Migration: add missing columns to existing projects table
DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'github';
    ALTER TABLE projects ALTER COLUMN github_url DROP NOT NULL;
    
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    
    -- New AI model choice column
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50) DEFAULT 'claude-4-6-opus-20260205';

    -- New AI Chat History column
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_chat_history JSONB DEFAULT '[]'::jsonb;

    -- Assign existing projects to the first user (admin) if they have no owner
    UPDATE projects SET user_id = (SELECT id FROM users ORDER BY id ASC LIMIT 1) WHERE user_id IS NULL;
    
    -- Make user_id NOT NULL after assigning defaults
    ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;

    -- Add project type (e.g. web, db_postgres)
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'web';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Deployments table
CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    commit_hash VARCHAR(40),
    commit_message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    logs TEXT DEFAULT '',
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP
);
