const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const db = require('../db/db');

// ============ SYSTEM METRICS ============

function getSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptime = os.uptime();

    // CPU usage calculation
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
        for (const type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
    });
    const cpuUsage = ((1 - totalIdle / totalTick) * 100).toFixed(1);

    // Process-level info
    const processUptime = process.uptime();
    const processMemory = process.memoryUsage();

    return {
        cpu: {
            usage: parseFloat(cpuUsage),
            cores: cpus.length,
            model: cpus[0]?.model || 'Unknown'
        },
        memory: {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            percent: ((usedMem / totalMem) * 100).toFixed(1)
        },
        process: {
            pid: process.pid,
            uptime: processUptime,
            nodeVersion: process.version,
            memoryUsage: {
                rss: processMemory.rss,
                heapUsed: processMemory.heapUsed,
                heapTotal: processMemory.heapTotal
            }
        },
        system: {
            uptime: uptime,
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            loadAvg: os.loadavg()
        }
    };
}

async function getDiskUsage() {
    try {
        const { stdout } = await execAsync("df -B1 / | tail -1 | awk '{print $2,$3,$4,$5}'");
        const [total, used, available, percent] = stdout.trim().split(/\s+/);
        return {
            total: parseInt(total),
            used: parseInt(used),
            available: parseInt(available),
            percent: parseFloat(percent)
        };
    } catch (e) {
        return { total: 0, used: 0, available: 0, percent: 0 };
    }
}

async function getNetworkIO() {
    try {
        const { stdout } = await execAsync("cat /proc/net/dev | grep -E 'eth0|ens|wlan|enp' | head -1 | awk '{print $2,$10}'");
        const [rx, tx] = stdout.trim().split(/\s+/);
        return { rxBytes: parseInt(rx) || 0, txBytes: parseInt(tx) || 0 };
    } catch (e) {
        return { rxBytes: 0, txBytes: 0 };
    }
}

// GET /api/admin/system
router.get('/system', async (req, res) => {
    try {
        const metrics = getSystemMetrics();
        const disk = await getDiskUsage();
        const network = await getNetworkIO();
        res.json({ ...metrics, disk, network });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/admin/system/stream — SSE real-time system metrics
router.get('/system/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const send = async () => {
        try {
            const metrics = getSystemMetrics();
            const disk = await getDiskUsage();
            const network = await getNetworkIO();
            res.write(`data: ${JSON.stringify({ ...metrics, disk, network })}\n\n`);
        } catch (e) {
            res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        }
    };

    send(); // Initial data
    const interval = setInterval(send, 2000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

// ============ DOCKER STATUS ============

// GET /api/admin/docker
router.get('/docker', async (req, res) => {
    try {
        const [containers, images, volumes] = await Promise.all([
            execAsync("docker ps -a --format '{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}' 2>/dev/null").catch(() => ({ stdout: '' })),
            execAsync("docker images --format '{{.Repository}}:{{.Tag}}|{{.Size}}' 2>/dev/null").catch(() => ({ stdout: '' })),
            execAsync("docker volume ls --format '{{.Name}}' 2>/dev/null").catch(() => ({ stdout: '' }))
        ]);

        const containerList = containers.stdout.trim().split('\n').filter(Boolean).map(line => {
            const [id, name, status, image, ports] = line.split('|');
            return { id, name, status, image, ports };
        });

        const imageList = images.stdout.trim().split('\n').filter(Boolean).map(line => {
            const [repo, size] = line.split('|');
            return { repo, size };
        });

        const running = containerList.filter(c => c.status?.startsWith('Up')).length;

        res.json({
            containers: { total: containerList.length, running, list: containerList },
            images: { total: imageList.length, list: imageList },
            volumes: { total: volumes.stdout.trim().split('\n').filter(Boolean).length }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ USER MANAGEMENT ============

// GET /api/admin/users?search=&role=&plan=&sort=&order=&page=&limit=
router.get('/users', async (req, res) => {
    try {
        const { search, role, plan, sort = 'created_at', order = 'asc', page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
        const offset = (pageNum - 1) * limitNum;
        const allowedSorts = ['id', 'username', 'email', 'role', 'plan', 'created_at', 'project_count'];
        const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

        let whereClauses = [];
        let params = [];
        let paramIdx = 1;

        if (search) {
            whereClauses.push(`(u.username ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
            params.push(`%${search}%`);
            paramIdx++;
        }
        if (role && ['admin', 'user'].includes(role)) {
            whereClauses.push(`u.role = $${paramIdx}`);
            params.push(role);
            paramIdx++;
        }
        if (plan && ['starter', 'pro', 'team', 'enterprise'].includes(plan)) {
            whereClauses.push(`COALESCE(u.plan, 'starter') = $${paramIdx}`);
            params.push(plan);
            paramIdx++;
        }

        const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count total
        const countResult = await db.query(`SELECT COUNT(DISTINCT u.id) as total FROM users u ${whereStr}`, params);
        const total = parseInt(countResult.rows[0].total);

        // Fetch paginated data
        const result = await db.query(`
            SELECT u.id, u.username, u.email, u.role, u.plan, u.created_at,
                   COUNT(p.id) as project_count
            FROM users u
            LEFT JOIN projects p ON p.user_id = u.id
            ${whereStr}
            GROUP BY u.id
            ORDER BY ${sortCol === 'project_count' ? 'project_count' : 'u.' + sortCol} ${sortOrder}
            LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
        `, [...params, limitNum, offset]);

        res.json({
            users: result.rows,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user".' });
    }
    // Prevent self-demotion
    if (parseInt(id) === req.user.userId && role !== 'admin') {
        return res.status(400).json({ error: 'Cannot change your own role.' });
    }
    try {
        await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/admin/users/:id/plan
router.patch('/users/:id/plan', async (req, res) => {
    const { id } = req.params;
    const { plan } = req.body;
    if (!['starter', 'pro', 'team', 'enterprise'].includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan. Must be starter, pro, team, or enterprise.' });
    }
    try {
        await db.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ ALL PROJECTS ============

// GET /api/admin/projects
router.get('/projects', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.*, u.username as owner_name, u.email as owner_email
            FROM projects p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.updated_at DESC
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ SERVER LOGS ============

// GET /api/admin/logs?lines=100
router.get('/logs', async (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    try {
        // Try PM2 logs first, then journalctl, then fallback
        let logs = '';
        try {
            const { stdout } = await execAsync(`journalctl -u orbitron --no-pager -n ${lines} 2>/dev/null || tail -n ${lines} /var/log/syslog 2>/dev/null || echo "Log source not available"`);
            logs = stdout;
        } catch (e) {
            logs = 'Log retrieval not available. Server may be running without systemd.';
        }
        res.json({ logs, lines });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
