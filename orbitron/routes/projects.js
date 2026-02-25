const express = require('express');
const router = express.Router();
const db = require('../db/db');
const deployer = require('../services/deployer');
const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const nginxService = require('../services/nginx');
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { encrypt, decrypt } = require('../db/crypto');

// Multer config for ZIP upload (max 500MB)
const upload = multer({
    dest: path.join(__dirname, '..', 'uploads_tmp'),
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('ZIP 파일만 업로드할 수 있습니다.'));
        }
    }
});

// GET /api/projects - List all projects for current user
router.get('/', async (req, res) => {
    try {
        const projects = await db.queryAll(
            'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.userId]
        );
        // Decrypt env_vars before sending to client
        const decryptedProjects = projects.map(p => {
            if (p.env_vars && typeof p.env_vars === 'string') {
                try {
                    const decrypted = decrypt(p.env_vars);
                    p.env_vars = decrypted ? JSON.parse(decrypted) : {};
                } catch (e) { p.env_vars = {}; }
            }
            return p;
        });
        res.json(decryptedProjects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id - Get project details
router.get('/:id', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        // Decrypt env_vars before sending to client
        if (project.env_vars && typeof project.env_vars === 'string') {
            try {
                const decrypted = decrypt(project.env_vars);
                project.env_vars = decrypted ? JSON.parse(decrypted) : {};
            } catch (e) { project.env_vars = {}; }
        }
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res) => {
    try {
        const { name, github_url, branch, build_command, start_command, port, subdomain, env_vars, auto_deploy, ai_model, type } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        // For web services github_url is required, for databases it is not.
        const projectType = type || 'web';
        if (projectType === 'web' && !github_url) {
            return res.status(400).json({ error: 'github_url is required for web apps' });
        }

        // Generate a valid subdomain: use provided subdomain, or sanitize the name,
        // or fall back to the GitHub repo name if the name produces no ASCII characters
        let projectSubdomain = subdomain;
        if (!projectSubdomain) {
            let sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            if (!sanitized) {
                // Name had no ASCII chars (e.g. Korean) — extract repo name from GitHub URL or use timestamp
                const repoMatch = github_url ? github_url.match(/\/([^\/]+?)(\.git)?$/) : null;
                sanitized = repoMatch ? repoMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : `project-${Date.now()}`;
            }
            projectSubdomain = sanitized;
        }

        // STRICT VALIDATION for subdomain (prevents XSS and Command Injection)
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(projectSubdomain)) {
            return res.status(400).json({ error: '서브도메인은 영문 소문자, 숫자, 하이픈(-)만 포함해야 합니다.' });
        }

        const projectPort = port || (3000 + Math.floor(Math.random() * 1000));

        // Encrypt environment variables and wrap in double quotes for JSONB column
        const encryptedEnvVars = '"' + encrypt(JSON.stringify(env_vars || {})) + '"';

        // Include ai_model and type in insertion
        const project = await db.queryOne(
            `INSERT INTO projects (
                user_id, name, github_url, branch, build_command, start_command, 
                port, subdomain, env_vars, auto_deploy, source_type, ai_model, type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'github', $11, $12) RETURNING *`,
            [req.user.userId, name, github_url, branch || 'main', build_command, start_command, projectPort, projectSubdomain, encryptedEnvVars, auto_deploy !== false, ai_model || 'claude-4-6-opus-20260205', projectType]
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
        const { name, github_url, branch, build_command, start_command, port, subdomain, env_vars, auto_deploy, custom_domain, ai_model } = req.body;
        if (subdomain && !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
            return res.status(400).json({ error: '서브도메인은 영문 소문자, 숫자, 하이픈(-)만 포함해야 합니다.' });
        }

        const encryptedEnvVars = env_vars ? '"' + encrypt(JSON.stringify(env_vars)) + '"' : null;

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
        ai_model = COALESCE($11, ai_model),
        updated_at = NOW()
       WHERE id = $12 AND user_id = $13 RETURNING *`,
            [name, github_url, branch, build_command, start_command, port, subdomain, encryptedEnvVars, auto_deploy !== undefined ? auto_deploy : null, custom_domain !== undefined ? custom_domain : null, ai_model !== undefined ? ai_model : null, req.params.id, req.user.userId]
        );
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        // If custom_domain changed, update nginx config
        if (custom_domain !== undefined) {
            nginxService.addProject(project);
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/projects/:id - Delete a project (with name confirmation)
router.delete('/:id', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        // Safety check: require confirm_name to match the project name
        const { confirm_name } = req.body || {};
        if (!confirm_name || confirm_name !== project.name) {
            return res.status(400).json({ error: '프로젝트 이름 확인이 일치하지 않습니다. 삭제가 취소되었습니다.' });
        }

        await deployer.deleteProject(project);
        await db.query('DELETE FROM deployments WHERE project_id = $1', [req.params.id]);
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
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

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
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        await deployer.stop(project);
        res.json({ message: 'Project stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id/stats - Container resource usage
router.get('/:id/stats', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const containerName = `orbitron-${project.subdomain}`;
        try {
            const { stdout: raw } = await execAsync(
                `docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.PIDs}}' ${containerName} 2>/dev/null`,
                { timeout: 5000 }
            );
            const [cpu, memUsage, memPerc, netIO, pids] = raw.trim().split('|');

            // Get uptime
            const { stdout: uptimeRaw } = await execAsync(
                `docker inspect --format '{{.State.StartedAt}}' ${containerName} 2>/dev/null`,
                { timeout: 3000 }
            );
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
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

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

            const { stdout: raw } = await execAsync(logCmd, { cwd: projectDir, timeout: 5000 });
            if (!raw || !raw.trim()) return res.json([]);

            const commits = raw.trim().split('\n').filter(Boolean).map(line => {
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
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

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

        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const containerName = `orbitron-${project.subdomain}`;
        // Sanitize: block dangerous commands
        const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork'];
        if (blocked.some(b => command.includes(b))) {
            return res.status(403).json({ error: 'Blocked command' });
        }

        try {
            // Use spawn instead of exec to prevent shell metacharacter injection entirely
            const childProc = spawn('docker', ['exec', containerName, 'sh', '-c', command], {
                timeout: 10000
            });
            let stdoutData = '';
            let stderrData = '';

            childProc.stdout.on('data', (data) => stdoutData += data);
            childProc.stderr.on('data', (data) => stderrData += data);

            await new Promise((resolve) => {
                childProc.on('close', resolve);
                childProc.on('error', (err) => {
                    stderrData += err.toString();
                    resolve();
                });
            });

            res.json({ output: stdoutData || stderrData });
        } catch (e) {
            res.json({ output: e.message });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/clone-backup - Clone repo to GitClones folder for backup
router.post('/:id/clone-backup', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

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
                const { stdout: output } = await execAsync(
                    `cd ${clonePath} && git fetch origin && git pull origin ${project.branch}`,
                    { maxBuffer: 1024 * 1024 * 50 }
                );
                res.json({
                    success: true,
                    action: 'updated',
                    path: clonePath,
                    message: `백업이 최신 상태로 업데이트되었습니다.`,
                    output
                });
            } catch (e) {
                res.status(500).json({
                    error: `Git pull 실패: ${e.stderr || e.message}`,
                    path: clonePath
                });
            }
        } else {
            // Fresh clone
            try {
                const { stdout: output } = await execAsync(
                    `git clone -b ${project.branch} ${project.github_url} ${clonePath}`,
                    { maxBuffer: 1024 * 1024 * 50 }
                );
                res.json({
                    success: true,
                    action: 'cloned',
                    path: clonePath,
                    message: `리포지토리가 ${clonePath}에 클론되었습니다.`,
                    output
                });
            } catch (e) {
                res.status(500).json({
                    error: `Git clone 실패: ${e.stderr || e.message}`,
                    path: clonePath
                });
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/media-backup - Backup media files to DATA drive
router.post('/:id/media-backup', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const mediaBackup = require('../services/mediaBackup');
        const result = mediaBackup.backupMedia(project);
        res.json({
            success: true,
            message: `미디어 백업 완료: ${result.fileCount}개 파일 (${result.totalSizeFormatted})`,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id/media-backup/status - Get media backup status
router.get('/:id/media-backup/status', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const mediaBackup = require('../services/mediaBackup');
        const status = mediaBackup.getBackupStatus(project);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/media-restore - Restore media files from backup
router.post('/:id/media-restore', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { filename } = req.body || {};
        const mediaBackup = require('../services/mediaBackup');
        const result = mediaBackup.restoreMedia(project, filename || null);
        res.json({
            success: true,
            message: filename
                ? `파일 복원 완료: ${filename}`
                : `전체 복원 완료: ${result.restoredCount}개 파일 복원`,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ PROJECT UPLOAD ============

// POST /api/projects/upload - Create project from uploaded ZIP
router.post('/upload', upload.single('zipfile'), async (req, res) => {
    let tmpPath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ZIP 파일이 필요합니다.' });
        }
        tmpPath = req.file.path;

        const { name, build_command, start_command, port, subdomain, project_type } = req.body;
        if (!name) {
            return res.status(400).json({ error: '프로젝트 이름은 필수입니다.' });
        }

        // Generate subdomain
        let projectSubdomain = subdomain;
        if (!projectSubdomain) {
            let sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            if (!sanitized) {
                sanitized = `upload-${Date.now()}`;
            }
            projectSubdomain = sanitized;
        }
        // Check projectSubdomain validity
        if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(projectSubdomain)) {
            return res.status(400).json({ error: '서브도메인은 영문 소문자, 숫자, 하이픈(-)만 허용됩니다.' });
        }

        const projectPort = port ? parseInt(port) : (3000 + Math.floor(Math.random() * 1000));

        // Handle project_type for Pixel Streaming & Unity WebGL
        let env_vars = {};
        if (project_type === 'pixel_streaming') {
            env_vars.PROJECT_TYPE = 'pixel_streaming';
        } else if (project_type === 'unity_webgl') {
            env_vars.PROJECT_TYPE = 'unity_webgl';
        }
        const encryptedEnvVars = '"' + encrypt(JSON.stringify(env_vars)) + '"';

        // Create project in DB
        const project = await db.queryOne(
            `INSERT INTO projects (user_id, name, github_url, branch, source_type, build_command, start_command, port, subdomain, auto_deploy, env_vars)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10) RETURNING *`,
            [req.user.userId, name, null, 'main', 'upload', build_command || 'npm install', start_command || 'npm start', projectPort, projectSubdomain, encryptedEnvVars]
        );

        // Extract ZIP to deployments dir
        const projectDir = path.join(__dirname, '..', 'deployments', project.subdomain);
        fs.mkdirSync(projectDir, { recursive: true });

        const zip = new AdmZip(tmpPath);
        zip.extractAllTo(projectDir, true);

        // If ZIP contains a single root folder, move contents up
        const entries = fs.readdirSync(projectDir).filter(e => !e.startsWith('.') && e !== 'Dockerfile');
        if (entries.length === 1) {
            const singleDir = path.join(projectDir, entries[0]);
            if (fs.statSync(singleDir).isDirectory()) {
                const innerEntries = fs.readdirSync(singleDir);
                for (const ie of innerEntries) {
                    const src = path.join(singleDir, ie);
                    const dest = path.join(projectDir, ie);
                    fs.renameSync(src, dest);
                }
                fs.rmdirSync(singleDir);
            }
        }

        // Cleanup temp file
        try { fs.unlinkSync(tmpPath); } catch (e) { }
        tmpPath = null;

        res.status(201).json(project);

        // Deploy in background
        deployer.deploy(project, null, null).catch(err => {
            console.error(`Upload deploy error for ${project.name}:`, err);
        });
    } catch (error) {
        if (tmpPath) try { fs.unlinkSync(tmpPath); } catch (e) { }
        if (error.code === '23505') {
            return res.status(409).json({ error: '서브도메인이 이미 존재합니다.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/reupload - Update uploaded project with new ZIP
router.post('/:id/reupload', upload.single('zipfile'), async (req, res) => {
    let tmpPath = null;
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (project.source_type !== 'upload') {
            return res.status(400).json({ error: 'GitHub 프로젝트는 재업로드할 수 없습니다.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'ZIP 파일이 필요합니다.' });
        }
        tmpPath = req.file.path;

        const projectDir = path.join(__dirname, '..', 'deployments', project.subdomain);

        // Remove old source (but keep Dockerfile)
        if (fs.existsSync(projectDir)) {
            const keepFiles = new Set(['Dockerfile']);
            const entries = fs.readdirSync(projectDir);
            for (const entry of entries) {
                if (keepFiles.has(entry)) continue;
                const fullPath = path.join(projectDir, entry);
                fs.rmSync(fullPath, { recursive: true, force: true });
            }
        }
        fs.mkdirSync(projectDir, { recursive: true });

        // Extract new ZIP
        const zip = new AdmZip(tmpPath);
        zip.extractAllTo(projectDir, true);

        // If ZIP contains a single root folder, move contents up
        const entries = fs.readdirSync(projectDir).filter(e => !e.startsWith('.') && e !== 'Dockerfile');
        if (entries.length === 1) {
            const singleDir = path.join(projectDir, entries[0]);
            if (fs.statSync(singleDir).isDirectory()) {
                const innerEntries = fs.readdirSync(singleDir);
                for (const ie of innerEntries) {
                    const src = path.join(singleDir, ie);
                    const dest = path.join(projectDir, ie);
                    fs.renameSync(src, dest);
                }
                fs.rmdirSync(singleDir);
            }
        }

        // Cleanup temp file
        try { fs.unlinkSync(tmpPath); } catch (e) { }
        tmpPath = null;

        res.json({ success: true, message: '소스 코드가 업데이트되었습니다. 재배포를 시작합니다.' });

        // Deploy in background
        deployer.deploy(project, null, null).catch(err => {
            console.error(`Reupload deploy error for ${project.name}:`, err);
        });
    } catch (error) {
        if (tmpPath) try { fs.unlinkSync(tmpPath); } catch (e) { }
        res.status(500).json({ error: error.message });
    }
});

// ============ PROJECT BACKUP ============

// POST /api/projects/:id/project-backup - Backup project to DATA drive
router.post('/:id/project-backup', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const projectBackup = require('../services/projectBackup');
        const result = projectBackup.backupProject(project);
        res.json({
            success: true,
            message: `프로젝트 백업 완료: ${result.copiedCount}개 파일 복사 (${result.totalSizeFormatted})`,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id/project-backup/status - Get project backup status
router.get('/:id/project-backup/status', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const projectBackup = require('../services/projectBackup');
        const status = projectBackup.getProjectBackupStatus(project);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/project-restore - Restore project from backup
router.post('/:id/project-restore', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const projectBackup = require('../services/projectBackup');
        const result = projectBackup.restoreProject(project);
        res.json({
            success: true,
            message: `프로젝트 복원 완료: ${result.copiedCount}개 파일 복원`,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/db-backup - Backup PostgreSQL database
router.post('/:id/db-backup', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Decrypt env_vars before sending to service
        if (project.env_vars && typeof project.env_vars === 'string') {
            try {
                const decrypted = require('../utils/crypto').decrypt(project.env_vars);
                project.env_vars = decrypted ? JSON.parse(decrypted) : {};
            } catch (e) { project.env_vars = {}; }
        }

        const dbBackup = require('../services/dbBackup');
        const result = dbBackup.backupDatabase(project);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/projects/:id/db-restore - Restore PostgreSQL database
router.post('/:id/db-restore', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Decrypt env_vars before sending to service
        if (project.env_vars && typeof project.env_vars === 'string') {
            try {
                const decrypted = require('../utils/crypto').decrypt(project.env_vars);
                project.env_vars = decrypted ? JSON.parse(decrypted) : {};
            } catch (e) { project.env_vars = {}; }
        }

        const dbBackup = require('../services/dbBackup');
        const result = dbBackup.restoreDatabase(project);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/projects/:id/db-backup/status - Get PostgreSQL database backup status
router.get('/:id/db-backup/status', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const dbBackup = require('../services/dbBackup');
        const result = dbBackup.getBackupStatus(project);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// GET /api/projects/:id/chat - Get AI chat history
router.get('/:id/chat', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT ai_chat_history FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        let history = [];
        if (project.ai_chat_history) {
            history = typeof project.ai_chat_history === 'string' ? JSON.parse(project.ai_chat_history) : project.ai_chat_history;
        }
        res.json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/chat - Send a message to AI
router.post('/:id/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const project = await db.queryOne('SELECT id, ai_model, env_vars, ai_chat_history FROM projects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        let history = [];
        if (project.ai_chat_history) {
            history = typeof project.ai_chat_history === 'string' ? JSON.parse(project.ai_chat_history) : project.ai_chat_history;
        }

        // Add user message
        const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
        history.push(userMsg);

        // Decrypt env_vars
        let envVars = {};
        if (project.env_vars && typeof project.env_vars === 'string') {
            try {
                const decrypted = decrypt(project.env_vars);
                envVars = decrypted ? JSON.parse(decrypted) : {};
            } catch (e) {
                console.error(`Failed to decrypt env_vars for project ${project.id}`);
            }
        } else if (typeof project.env_vars === 'object' && project.env_vars !== null) {
            envVars = project.env_vars;
        }

        const aiAnalyzer = require('../services/aiAnalyzer');

        // Ensure ai_model has a safe default if not selected
        const model = project.ai_model || 'claude-4-6-opus-20260205';

        // Get AI response
        const aiResponseText = await aiAnalyzer.chat(history, model, envVars);

        // Add assistant message
        const assistantMsg = { role: 'assistant', content: aiResponseText, timestamp: new Date().toISOString() };
        history.push(assistantMsg);

        // Save updated history to DB
        await db.query('UPDATE projects SET ai_chat_history = $1 WHERE id = $2', [JSON.stringify(history), project.id]);

        res.json({ reply: assistantMsg });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/projects/:id/chat - Clear AI chat history
router.delete('/:id/chat', async (req, res) => {
    try {
        const result = await db.query('UPDATE projects SET ai_chat_history = $1 WHERE id = $2 AND user_id = $3 RETURNING id', ['[]', req.params.id, req.user.userId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });

        res.json({ message: 'Chat history cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
