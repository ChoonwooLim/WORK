const express = require('express');
const router = express.Router();
const db = require('../db/db');
const deployer = require('../services/deployer');
const { execSync } = require('child_process');
const nginxService = require('../services/nginx');

// GET /api/projects - List all projects
router.get('/', async (req, res) => {
    try {
        const projects = await db.queryAll(
            'SELECT * FROM projects ORDER BY created_at DESC'
        );
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id - Get project details
router.get('/:id', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res) => {
    try {
        const { name, github_url, branch, build_command, start_command, port, subdomain, env_vars, auto_deploy } = req.body;

        if (!name || !github_url) {
            return res.status(400).json({ error: 'name and github_url are required' });
        }

        // Generate a valid subdomain: use provided subdomain, or sanitize the name,
        // or fall back to the GitHub repo name if the name produces no ASCII characters
        let projectSubdomain = subdomain;
        if (!projectSubdomain) {
            let sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            if (!sanitized) {
                // Name had no ASCII chars (e.g. Korean) — extract repo name from GitHub URL
                const repoMatch = github_url.match(/\/([^\/]+?)(\.git)?$/);
                sanitized = repoMatch ? repoMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : `project-${Date.now()}`;
            }
            projectSubdomain = sanitized;
        }
        const projectPort = port || (3000 + Math.floor(Math.random() * 1000));

        const project = await db.queryOne(
            `INSERT INTO projects (name, github_url, branch, build_command, start_command, port, subdomain, env_vars, auto_deploy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [name, github_url, branch || 'main', build_command, start_command, projectPort, projectSubdomain, JSON.stringify(env_vars || {}), auto_deploy !== false]
        );

        res.status(201).json(project);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Subdomain already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/projects/:id - Update a project
router.put('/:id', async (req, res) => {
    try {
        const { name, github_url, branch, build_command, start_command, port, subdomain, env_vars, auto_deploy, custom_domain } = req.body;
        const project = await db.queryOne(
            `UPDATE projects SET
        name = COALESCE($1, name),
        github_url = COALESCE($2, github_url),
        branch = COALESCE($3, branch),
        build_command = COALESCE($4, build_command),
        start_command = COALESCE($5, start_command),
        port = COALESCE($6, port),
        subdomain = COALESCE($7, subdomain),
        env_vars = COALESCE($8, env_vars),
        auto_deploy = COALESCE($9, auto_deploy),
        custom_domain = COALESCE($10, custom_domain),
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
            [name, github_url, branch, build_command, start_command, port, subdomain, env_vars ? JSON.stringify(env_vars) : null, auto_deploy !== undefined ? auto_deploy : null, custom_domain !== undefined ? custom_domain : null, req.params.id]
        );
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // If custom_domain changed, update nginx config
        if (custom_domain !== undefined) {
            nginxService.addProject(project);
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/projects/:id - Delete a project
router.delete('/:id', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        await deployer.deleteProject(project);
        await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);

        res.json({ message: 'Project deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/deploy - Manually trigger deploy
router.post('/:id/deploy', async (req, res) => {
    try {
        const { commit_hash } = req.body || {};
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Deploy in background
        res.json({ message: 'Deployment started', project_id: project.id, commit: commit_hash || 'latest' });

        deployer.deploy(project, commit_hash || null, null).catch(err => {
            console.error(`Deploy error for ${project.name}:`, err);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/stop - Stop a project
router.post('/:id/stop', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        await deployer.stop(project);
        res.json({ message: 'Project stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id/stats - Container resource usage
router.get('/:id/stats', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const containerName = `orbitron-${project.subdomain}`;
        try {
            const raw = execSync(
                `docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.PIDs}}' ${containerName} 2>/dev/null`,
                { stdio: 'pipe', timeout: 5000 }
            ).toString().trim();
            const [cpu, memUsage, memPerc, netIO, pids] = raw.split('|');

            // Get uptime
            const uptimeRaw = execSync(
                `docker inspect --format '{{.State.StartedAt}}' ${containerName} 2>/dev/null`,
                { stdio: 'pipe', timeout: 3000 }
            ).toString().trim();
            const startedAt = new Date(uptimeRaw);
            const uptimeMs = Date.now() - startedAt.getTime();

            res.json({
                cpu: cpu.replace('%', '').trim(),
                memUsage: memUsage.trim(),
                memPercent: memPerc.replace('%', '').trim(),
                netIO: netIO.trim(),
                pids: pids.trim(),
                uptime: uptimeMs,
                startedAt: uptimeRaw
            });
        } catch (e) {
            res.json({ cpu: '0', memUsage: '0B / 0B', memPercent: '0', netIO: '0B / 0B', pids: '0', uptime: 0, error: 'Container not running' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id/commits - Get recent 20 commits for deployment options
router.get('/:id/commits', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const path = require('path');
        const fs = require('fs');
        const projectDir = path.join(__dirname, '..', 'deployments', project.subdomain);

        if (!fs.existsSync(path.join(projectDir, '.git'))) {
            return res.json([]); // Not cloned yet
        }

        try {
            // Check remote for newer commits first, but fallback gracefully if it fails
            try {
                execSync(`git fetch origin ${project.branch}`, { cwd: projectDir, timeout: 5000 });
            } catch (e) { } // ignore fetch errors (e.g., offline)

            const formatStr = '%H|%h|%s|%an|%ad';
            // Output local and remote commits on the specified branch
            const logCmd = `git log -n 20 --pretty=format:"${formatStr}" origin/${project.branch} 2>/dev/null || git log -n 20 --pretty=format:"${formatStr}" 2>/dev/null`;

            const raw = execSync(logCmd, { cwd: projectDir, timeout: 5000 }).toString().trim();
            if (!raw) return res.json([]);

            const commits = raw.split('\n').filter(Boolean).map(line => {
                const parts = line.split('|');
                return {
                    hash: parts[0] || '',
                    shortHash: parts[1] || '',
                    message: parts[2] || '',
                    author: parts[3] || '',
                    date: parts[4] || ''
                };
            });
            res.json(commits);
        } catch (e) {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/rollback - Rollback to specific deployment
router.post('/:id/rollback', async (req, res) => {
    try {
        const { deployment_id } = req.body;
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const deployment = await db.queryOne('SELECT * FROM deployments WHERE id = $1 AND project_id = $2', [deployment_id, req.params.id]);
        if (!deployment || !deployment.commit_hash) {
            return res.status(400).json({ error: 'Invalid deployment or missing commit hash' });
        }

        // Trigger deploy in background with specific commit
        res.json({ message: 'Rollback started', commit: deployment.commit_hash });
        deployer.deploy(project, deployment.commit_hash).catch(err => {
            console.error(`Rollback error for ${project.name}:`, err);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/exec - Execute command in container
router.post('/:id/exec', async (req, res) => {
    try {
        const { command } = req.body;
        if (!command) return res.status(400).json({ error: 'command is required' });

        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const containerName = `orbitron-${project.subdomain}`;
        // Sanitize: block dangerous commands
        const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork'];
        if (blocked.some(b => command.includes(b))) {
            return res.status(403).json({ error: 'Blocked command' });
        }

        try {
            const output = execSync(
                `docker exec ${containerName} sh -c ${JSON.stringify(command)} 2>&1`,
                { stdio: 'pipe', timeout: 10000, maxBuffer: 1024 * 1024 }
            ).toString();
            res.json({ output });
        } catch (e) {
            res.json({ output: e.stdout?.toString() || e.stderr?.toString() || e.message });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/clone-backup - Clone repo to GitClones folder for backup
router.post('/:id/clone-backup', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const path = require('path');
        const fs = require('fs');
        const CLONE_DIR = '/home/stevenlim/GitClones';

        // Ensure GitClones directory exists
        if (!fs.existsSync(CLONE_DIR)) {
            fs.mkdirSync(CLONE_DIR, { recursive: true });
        }

        // Extract repo name from GitHub URL
        const repoMatch = project.github_url.match(/\/([^\/]+?)(?:\.git)?$/);
        const repoName = repoMatch ? repoMatch[1] : project.subdomain;
        const clonePath = path.join(CLONE_DIR, repoName);

        if (fs.existsSync(path.join(clonePath, '.git'))) {
            // Already cloned - pull latest
            try {
                const output = execSync(
                    `cd ${clonePath} && git fetch origin && git pull origin ${project.branch}`,
                    { stdio: 'pipe', timeout: 30000, maxBuffer: 1024 * 1024 * 50 }
                ).toString();
                res.json({
                    success: true,
                    action: 'updated',
                    path: clonePath,
                    message: `백업이 최신 상태로 업데이트되었습니다.`,
                    output
                });
            } catch (e) {
                res.status(500).json({
                    error: `Git pull 실패: ${e.stderr?.toString() || e.message}`,
                    path: clonePath
                });
            }
        } else {
            // Fresh clone
            try {
                const output = execSync(
                    `git clone -b ${project.branch} ${project.github_url} ${clonePath}`,
                    { stdio: 'pipe', timeout: 60000, maxBuffer: 1024 * 1024 * 50 }
                ).toString();
                res.json({
                    success: true,
                    action: 'cloned',
                    path: clonePath,
                    message: `리포지토리가 ${clonePath}에 클론되었습니다.`,
                    output
                });
            } catch (e) {
                res.status(500).json({
                    error: `Git clone 실패: ${e.stderr?.toString() || e.message}`,
                    path: clonePath
                });
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
