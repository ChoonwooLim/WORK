const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const db = require('./db/db');
const { decrypt } = require('./db/crypto');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Best-effort decrypt of project.env_vars from raw DB form (string|object|null) → plain object.
// Mirrors the logic in services/deployer.js so the recovery path doesn't pass an
// encrypted string to dockerService.startContainer (which would treat each character as a key).
function decryptProjectEnvVars(project) {
    let envVars = {};
    const raw = project.env_vars;
    if (raw && typeof raw === 'string') {
        try {
            const decrypted = decrypt(raw);
            envVars = decrypted ? JSON.parse(decrypted) : {};
        } catch (e) {
            console.error(`⚠️ Failed to decrypt env_vars for project ${project.id} (${project.name}); using empty {}`);
            envVars = {};
        }
    } else if (raw && typeof raw === 'object') {
        envVars = raw;
    }
    project.env_vars = envVars;
    return project;
}

// Validate required environment variables
const REQUIRED_ENV = ['JWT_SECRET'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ FATAL: ${key} environment variable is required. Set it in .env`);
        process.exit(1);
    }
}

const app = express();
// Trust exactly one proxy hop (Cloudflare → local). `true` was permissive and broke
// express-rate-limit's IP identity check (ERR_ERL_PERMISSIVE_TRUST_PROXY), allowing
// clients to spoof X-Forwarded-For and bypass rate limits.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
// Skip high-frequency dashboard polling endpoints in access logs to prevent the
// PM2 stdout log from ballooning (was 158MB / 2.5M lines — 99% was /api/projects/*/stats polling).
app.use(morgan('dev', {
    skip: (req) => /^\/api\/projects\/\d+\/stats$/.test(req.path)
        || (req.method === 'GET' && req.path === '/api/projects')
}));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

const authMiddleware = require('./middleware/auth');
const viewerGuard = require('./middleware/viewerGuard');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', authMiddleware, viewerGuard, require('./routes/projects'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/deployments', authMiddleware, viewerGuard, require('./routes/deployments'));
app.use('/api/groups', authMiddleware, viewerGuard, require('./routes/groups'));
app.use('/api/projects', authMiddleware, viewerGuard, require('./routes/source'));
app.use('/api/pixel-streaming', require('./routes/pixelStreaming'));
app.use('/api/admin', authMiddleware, require('./middleware/adminAuth'), require('./routes/admin'));
app.use('/api/issues', authMiddleware, viewerGuard, require('./routes/issues'));
app.use('/api/projects', authMiddleware, viewerGuard, require('./routes/domains'));
app.use('/api/wan', authMiddleware, viewerGuard, require('./routes/wan'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// PDF generation endpoint — renders any local page to PDF using headless Chrome
app.get('/api/pdf/:page', async (req, res) => {
    const page = req.params.page;
    const allowed = ['presentation', 'ir', 'comparison', 'patent-application'];
    // Allow docs-content markdown via ir.html viewer
    const isPatent = page === 'patent-application';

    if (!allowed.includes(page)) {
        return res.status(400).json({ error: '허용되지 않는 페이지입니다.' });
    }

    try {
        const puppeteer = require('puppeteer-core');
        const chromePath = '/usr/bin/google-chrome';
        const port = process.env.PORT || 4000;

        const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const browserPage = await browser.newPage();
        await browserPage.setViewport({ width: 1920, height: 1080 });

        let url;
        if (page === 'presentation') {
            url = `http://localhost:${port}/presentation.html?print-pdf`;
        } else if (isPatent) {
            url = `http://localhost:${port}/docs.html#/patent-application`;
        } else {
            url = `http://localhost:${port}/${page}.html`;
        }

        await browserPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        // Wait extra for fonts/images
        await new Promise(r => setTimeout(r, 2000));

        const pdfBuffer = await browserPage.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
            ...(page === 'presentation' ? { width: '1920px', height: '1080px', landscape: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } } : {})
        });

        await browser.close();

        const filename = `Orbitron_${page.charAt(0).toUpperCase() + page.slice(1)}_${new Date().toISOString().slice(0, 10)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (e) {
        console.error('PDF 생성 오류:', e.message);
        res.status(500).json({ error: `PDF 생성 실패: ${e.message}` });
    }
});

// SSE - Real-time deploy progress stream
const deployer = require('./services/deployer');
app.get('/api/deploy-stream/:projectId', authMiddleware, (req, res) => {
    const projectId = parseInt(req.params.projectId);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', projectId })}\n\n`);

    // Sync latest progress instantly for clients that connected mid-deployment
    if (deployer.latestProgress && deployer.latestProgress.has(projectId)) {
        res.write(`data: ${JSON.stringify(deployer.latestProgress.get(projectId))}\n\n`);
    }

    // Listen for deploy progress events
    const onProgress = (data) => {
        if (data.projectId === projectId) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    deployer.on('deploy-progress', onProgress);

    // Heartbeat every 5s (prevents proxy timeout during long builds)
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 5000);

    // Cleanup on disconnect
    req.on('close', () => {
        deployer.removeListener('deploy-progress', onProgress);
        clearInterval(heartbeat);
    });
});

// Server info - returns public IP for external URL display
app.get('/api/server-info', async (req, res) => {
    try {
        const { stdout } = await execAsync('curl -4 -s --connect-timeout 3 ifconfig.me 2>/dev/null');
        res.json({ publicIp: stdout.trim() });
    } catch (e) {
        res.json({ publicIp: null });
    }
});

// SPA fallback - serve app.html for any non-API route (app routing)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'app.html'));
    } else {
        next();
    }
});

// Initialize database and start server
async function start() {
    try {
        // Run schema
        const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
        await db.query(schema);
        console.log('✅ Database schema initialized');

        // Ensure Docker internal network exists for inter-service communication
        try {
            await execAsync('docker network create orbitron_internal --driver bridge 2>/dev/null || true');
            console.log('✅ Docker network orbitron_internal ready');
        } catch (e) {
            console.log('⚠️ Docker network check:', e.message);
        }

        // Startup orphan cleanup: remove stuck Created/Exited containers from previous crashes
        try {
            const dockerService = require('./services/docker');
            const result = await dockerService.cleanupOrphanContainers();
            if (result.removed > 0) {
                console.log(`✅ Startup cleanup: removed ${result.removed} orphan containers`);
            }
        } catch (e) {
            console.log('⚠️ Startup orphan cleanup:', e.message);
        }

        // Periodic orphan cleanup every hour to prevent container accumulation
        setInterval(async () => {
            try {
                const dockerService = require('./services/docker');
                const result = await dockerService.cleanupOrphanContainers();
                if (result.removed > 0) {
                    console.log(`🧹 Hourly cleanup: removed ${result.removed} orphan containers`);
                }
            } catch (e) {
                console.error('Hourly cleanup failed:', e.message);
            }
        }, 60 * 60 * 1000); // 1 hour

        // Auto-create admin user from .env if not exists
        if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            const bcrypt = require('bcrypt');
            const existing = await db.queryOne('SELECT id FROM users WHERE email = $1', [process.env.ADMIN_EMAIL]);
            if (!existing) {
                const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
                let adminUsername = process.env.ADMIN_EMAIL.split('@')[0];
                // Prevent username collision by appending random suffix if already taken
                const nameTaken = await db.queryOne('SELECT id FROM users WHERE username = $1', [adminUsername]);
                if (nameTaken) {
                    adminUsername = `${adminUsername}_${Date.now().toString(36).slice(-4)}`;
                }
                await db.queryOne(
                    "INSERT INTO users (username, email, password_hash, role, plan) VALUES ($1, $2, $3, 'admin', 'enterprise') RETURNING id",
                    [adminUsername, process.env.ADMIN_EMAIL, hash]
                );
                console.log(`🛡 Admin account created: ${process.env.ADMIN_EMAIL}`);
            } else {
                // Ensure existing user has at least admin role and enterprise plan
                // But preserve superadmin if already set
                await db.query("UPDATE users SET role = CASE WHEN role = 'superadmin' THEN 'superadmin' ELSE 'admin' END, plan = 'enterprise' WHERE email = $1", [process.env.ADMIN_EMAIL]);
            }
        }

        app.listen(PORT, async () => {
            console.log(`
╔══════════════════════════════════════╗
║   🪐 Orbitron Server Running        ║
║   http://localhost:${PORT}              ║
║   Dashboard: http://localhost:${PORT}   ║
║   Webhook: POST /api/webhooks/github ║
╚══════════════════════════════════════╝
`);

            // Warm up local Gemma 4 (Ollama) so the first real chat/analysis
            // doesn't pay a 30s cold-start model load. Fire-and-forget.
            (async () => {
                const ollamaHost = (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
                try {
                    const t0 = Date.now();
                    const res = await fetch(`${ollamaHost}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'gemma4:e4b',
                            messages: [{ role: 'user', content: 'hi' }],
                            stream: false,
                            options: { num_predict: 1 }
                        }),
                        signal: AbortSignal.timeout(60000)
                    });
                    if (res.ok) {
                        console.log(`🌱 Gemma 4 (Ollama) warmed up in ${((Date.now() - t0) / 1000).toFixed(1)}s — local LLM ready`);
                    } else {
                        console.log(`🌱 Ollama warmup skipped (HTTP ${res.status})`);
                    }
                } catch (e) {
                    console.log(`🌱 Ollama warmup skipped (${e.name === 'TimeoutError' ? 'timeout' : e.message}) — local LLM optional`);
                }
            })();

            // Auto-recover tunnels for running projects
            try {
                const tunnelService = require('./services/tunnel');
                const dockerService = require('./services/docker');
                const result = await db.query("SELECT * FROM projects WHERE status = 'running'");
                const runningProjects = result.rows || [];
                for (const project of runningProjects) {
                    // Containers may use exact name (orbitron-<sub>) for DBs
                    // OR Blue-Green name with deploy hash suffix (orbitron-<sub>-<hash>) for web apps.
                    // Look up the actually-running container by prefix first to avoid spurious restarts.
                    const namePrefix = `orbitron-${project.subdomain}`;
                    // IMPORTANT: docker --filter "name=^orbitron-twinverse" also matches
                    // "orbitron-twinverseai-*", so we must post-filter in JS to only accept
                    // names that are EITHER exactly orbitron-<sub> OR orbitron-<sub>-<suffix>.
                    const validNameRe = new RegExp(`^${namePrefix}(-.+)?$`);
                    let runningName = null;
                    try {
                        const { stdout: psOut } = await execAsync(
                            `docker ps --filter "name=^${namePrefix}" --format "{{.Names}}"`
                        );
                        const candidates = psOut.split('\n')
                            .map(s => s.trim())
                            .filter(Boolean)
                            .filter(n => validNameRe.test(n)); // reject siblings like orbitron-twinverseai-*
                        // Prefer exact match, otherwise the most recent prefix-match (highest deploy hash)
                        runningName = candidates.find(n => n === namePrefix)
                            || candidates.sort().reverse()[0]
                            || null;
                    } catch (e) { /* ignore */ }

                    if (runningName) {
                        // Container is alive — just refresh restart policy and bookkeep its name
                        try {
                            await execAsync(`docker update --restart unless-stopped ${runningName} 2>/dev/null`);
                        } catch (e) { /* ignore */ }
                        if (project.container_id !== runningName) {
                            try {
                                await db.query('UPDATE projects SET container_id = $1 WHERE id = $2', [runningName, project.id]);
                            } catch (e) { /* ignore */ }
                        }
                    } else {
                        console.log(`🔄 Restarting container for ${project.name} (no running container found for prefix ${namePrefix})...`);
                        try {
                            // CRITICAL: decrypt env_vars before passing to startContainer.
                            // The raw DB form is an encrypted hex string for ENCRYPTED rows;
                            // without decryption, Object.keys() of the string yields one entry
                            // per character → tens of thousands of -e flags → spawn E2BIG.
                            decryptProjectEnvVars(project);
                            const containerId = await dockerService.startContainer(project);
                            await db.query('UPDATE projects SET container_id = $1 WHERE id = $2', [containerId, project.id]);
                            console.log(`✅ Container restarted: ${namePrefix}`);
                        } catch (e) {
                            console.log(`❌ Failed to restart container for ${project.name}: ${e.message}`);
                            continue;
                        }
                    }

                    // Recover tunnel
                    console.log(`🔗 Recovering tunnel for ${project.name} (port ${project.port})...`);
                    const url = await tunnelService.startTunnel(project);
                    if (url) {
                        await db.query('UPDATE projects SET tunnel_url = $1 WHERE id = $2', [url, project.id]);
                        console.log(`✅ Tunnel recovered: ${url}`);
                    } else {
                        console.log(`⚠️ Failed to recover tunnel for ${project.name}`);
                    }
                }
                if (runningProjects.length > 0) {
                    console.log(`🔗 Recovered ${runningProjects.length} project(s)`);
                }
            } catch (e) {
                console.error('⚠️ Project recovery failed:', e.message);
            }
        });
    } catch (error) {
        console.error('❌ Failed to start:', error.message);
        process.exit(1);
    }
}

start();

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
    const { pool } = require('./db/db');
    pool.end().then(() => {
        console.log('✅ Database pool closed');
        process.exit(0);
    }).catch(() => {
        process.exit(1);
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
        console.error('⚠️ Forced shutdown after 10s timeout');
        process.exit(1);
    }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
