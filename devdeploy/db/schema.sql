-- DevDeploy Database Schema

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    github_url VARCHAR(500) NOT NULL,
    branch VARCHAR(100) DEFAULT 'main',
    build_command VARCHAR(500) DEFAULT 'npm install && npm run build',
    start_command VARCHAR(500) DEFAULT 'npm start',
    port INTEGER,
    subdomain VARCHAR(100) UNIQUE,
    env_vars JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'stopped',
    container_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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
