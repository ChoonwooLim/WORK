const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const db = require('./db/db');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

const authMiddleware = require('./middleware/auth');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', authMiddleware, require('./routes/projects'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/deployments', authMiddleware, require('./routes/deployments'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
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

// SPA fallback - serve index.html for any non-API route
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

        app.listen(PORT, async () => {
            console.log(`
╔══════════════════════════════════════╗
║   🪐 Orbitron Server Running        ║
║   http://localhost:${PORT}              ║
║   Dashboard: http://localhost:${PORT}   ║
║   Webhook: POST /api/webhooks/github ║
╚══════════════════════════════════════╝
`);
            // Auto-recover tunnels for running projects
            try {
                const tunnelService = require('./services/tunnel');
                const dockerService = require('./services/docker');
                const result = await db.query("SELECT * FROM projects WHERE status = 'running'");
                const runningProjects = result.rows || [];
                for (const project of runningProjects) {
                    // Check and restart container if needed
                    const containerName = `orbitron-${project.subdomain}`;
                    const containerStatus = await dockerService.getContainerStatus(containerName);
                    if (containerStatus !== 'running') {
                        console.log(`🔄 Restarting container for ${project.name} (was: ${containerStatus})...`);
                        try {
                            const containerId = await dockerService.startContainer(project);
                            await db.query('UPDATE projects SET container_id = $1 WHERE id = $2', [containerId, project.id]);
                            console.log(`✅ Container restarted: ${containerName}`);
                        } catch (e) {
                            console.log(`❌ Failed to restart container for ${project.name}: ${e.message}`);
                            continue;
                        }
                    } else {
                        // Update restart policy for existing running containers
                        try {
                            await execAsync(`docker update --restart unless-stopped ${containerName} 2>/dev/null`);
                        } catch (e) { /* ignore */ }
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
