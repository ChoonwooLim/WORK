const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const { decrypt } = require('../db/crypto');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', 'build', '.next', 'venv', '.venv', '.cache', 'coverage']);
const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.yaml', '.yml', '.toml', '.cfg', '.env', '.html', '.css', '.md', '.sh', '.sql']);
const MAX_FILE_SIZE = 100 * 1024; // 100KB per file

/**
 * GET /api/projects/:id/source/tree
 * Returns the file tree of the project
 */
router.get('/:id/source/tree', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ error: '프로젝트 소스 디렉토리가 없습니다.' });
        }

        const tree = buildFileTree(projectDir, projectDir, 0, 4);
        res.json({ tree, projectDir: project.subdomain });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/projects/:id/source/file?path=relative/path
 * Returns the content of a specific file
 */
router.get('/:id/source/file', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'path 파라미터가 필요합니다.' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        const fullPath = path.join(projectDir, filePath);

        // Security: prevent directory traversal
        if (!fullPath.startsWith(projectDir)) {
            return res.status(403).json({ error: '접근이 거부되었습니다.' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_FILE_SIZE) {
            return res.status(413).json({ error: '파일이 너무 큽니다 (최대 100KB)' });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const ext = path.extname(fullPath).toLowerCase();

        res.json({
            path: filePath,
            content,
            size: stat.size,
            extension: ext,
            lastModified: stat.mtime,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/projects/:id/source/file
 * Saves modifications to a specific file
 */
router.post('/:id/source/file', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
            return res.status(400).json({ error: 'path 및 content 파라미터가 필요합니다.' });
        }

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        const fullPath = path.join(projectDir, filePath);

        // Security: prevent directory traversal
        if (!fullPath.startsWith(projectDir)) {
            return res.status(403).json({ error: '접근이 거부되었습니다.' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        // Write content to file
        fs.writeFileSync(fullPath, content, 'utf-8');

        res.json({ success: true, message: '파일이 성공적으로 저장되었습니다.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/projects/:id/source/context
 * Returns an AI-ready summary of project source (auto-collected)
 */
router.get('/:id/source/context', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ error: '소스 디렉토리가 없습니다.' });
        }

        const sourceContext = collectSourceContext(projectDir);

        // Get recent deploy logs
        const lastDeployment = await db.queryOne(
            'SELECT logs, status FROM deployments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
            [project.id]
        );

        let recentLogs = null;
        if (lastDeployment && lastDeployment.logs) {
            const logLines = lastDeployment.logs.split('\n');
            recentLogs = logLines.slice(-100).join('\n');
        }

        res.json({
            name: project.name,
            type: project.type,
            status: project.status,
            build_command: project.build_command,
            start_command: project.start_command,
            github_url: project.github_url,
            sourceContext,
            recentLogs,
            lastDeployStatus: lastDeployment?.status || null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Build file tree recursively
 */
function buildFileTree(baseDir, currentDir, depth = 0, maxDepth = 4) {
    if (depth >= maxDepth) return [];
    const items = [];

    try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

            const fullPath = path.join(currentDir, entry.name);
            const relPath = path.relative(baseDir, fullPath);

            if (entry.isDirectory()) {
                const children = buildFileTree(baseDir, fullPath, depth + 1, maxDepth);
                items.push({ name: entry.name, path: relPath, type: 'dir', children });
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const stat = fs.statSync(fullPath);
                items.push({
                    name: entry.name,
                    path: relPath,
                    type: 'file',
                    size: stat.size,
                    extension: ext,
                });
            }
        }
    } catch { }

    // Sort: directories first, then files alphabetically
    items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return items;
}

/**
 * Collect source files for AI context
 */
function collectSourceContext(projectDir) {
    const MAX_FILES = 25;
    const MAX_LINES = 200;
    const files = [];

    // Phase 1: Priority files — always collect critical config files first
    const priorityFiles = [
        'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
        'package.json', 'requirements.txt', 'pyproject.toml',
        '.env.example', '.env.production',
        'orbitron.yaml', 'next.config.js', 'next.config.mjs',
        'vite.config.js', 'vite.config.ts', 'tsconfig.json',
        'nginx.conf', 'Procfile'
    ];

    for (const pf of priorityFiles) {
        if (files.length >= MAX_FILES) break;
        const fullPath = path.join(projectDir, pf);
        try {
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const stat = fs.statSync(fullPath);
                if (stat.size > MAX_FILE_SIZE) continue;
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lines = content.split('\n');
                const trimmed = lines.slice(0, MAX_LINES).join('\n');
                files.push(`--- ${pf} (${lines.length} lines, PRIORITY) ---\n${trimmed}${lines.length > MAX_LINES ? '\n... (truncated)' : ''}`);
            }
        } catch { }
    }

    // Phase 2: Walk remaining source files
    const walk = (dir, depth = 0) => {
        if (depth > 3 || files.length >= MAX_FILES) return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (files.length >= MAX_FILES) break;
                if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (SOURCE_EXTENSIONS.has(ext)) {
                        const relPath = path.relative(projectDir, fullPath);
                        // Skip if already collected as priority file
                        if (files.some(f => f.includes(`--- ${relPath} `))) continue;
                        try {
                            const stat = fs.statSync(fullPath);
                            if (stat.size > MAX_FILE_SIZE) continue;
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            const lines = content.split('\n');
                            const trimmed = lines.slice(0, MAX_LINES).join('\n');
                            files.push(`--- ${relPath} (${lines.length} lines) ---\n${trimmed}${lines.length > MAX_LINES ? '\n... (truncated)' : ''}`);
                        } catch { }
                    }
                }
            }
        } catch { }
    };

    walk(projectDir);
    return files.length > 0 ? files.join('\n\n') : null;
}

module.exports = router;
module.exports.collectSourceContext = collectSourceContext;
