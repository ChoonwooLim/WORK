// server.js — RemoteAGT Main Entry Point
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

import config from './src/utils/config.js';
import logger from './src/utils/logger.js';
import db, { testConnection } from './db/db.js';
import collector from './src/monitor/collector.js';
import alertRules from './src/monitor/alertRules.js';
import telegramGateway from './src/gateways/telegram.js';
import orbitronClient from './src/bridge/orbitronClient.js';
import { authRequired } from './src/middleware/auth.js';
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/routes/admin.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ==================== Middleware ====================
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== Auth Routes (public) ====================
app.use('/api/auth', authRoutes);

// ==================== Public API Routes ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'RemoteAGT',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Plan API (public - returns rendered HTML from markdown)
app.get('/api/plan', async (req, res) => {
    try {
        const planPath = path.join(__dirname, 'docs', 'plan.md');
        const md = fs.readFileSync(planPath, 'utf-8');
        const html = simpleMarkdownToHtml(md);
        res.json({ html });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Telegram status (public)
app.get('/api/telegram/status', (req, res) => {
    res.json({
        botConfigured: !!config.telegram.botToken,
        adminConfigured: !!config.telegram.adminId,
    });
});

// ==================== Protected API Routes ====================

// Metrics API (system + containers) — requires auth
app.get('/api/metrics', authRequired, async (req, res) => {
    try {
        const metrics = await collector.collectAll();
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Orbitron proxy: projects — requires auth
app.get('/api/orbitron/projects', authRequired, async (req, res) => {
    try {
        const projects = await orbitronClient.getProjects();
        res.json(projects || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Orbitron proxy: deploy — requires auth
app.post('/api/orbitron/projects/:id/deploy', authRequired, async (req, res) => {
    try {
        const result = await orbitronClient.deployProject(req.params.id);

        // Audit log
        await db.query(
            'INSERT INTO ragt_audit_log (web_user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'deploy', JSON.stringify({ projectId: req.params.id }), req.ip]
        );

        res.json(result || { message: 'Deploy triggered' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Orbitron proxy: logs — requires auth
app.get('/api/orbitron/projects/:id/logs', authRequired, async (req, res) => {
    try {
        const subdomain = req.query.subdomain;
        if (subdomain) {
            const { stdout } = await execAsync(`docker logs --tail 50 orbitron-${subdomain} 2>&1`);
            res.json({ logs: stdout });
        } else {
            const result = await orbitronClient.getProjectLogs(req.params.id);
            res.json(result || { logs: '' });
        }
    } catch (err) {
        res.json({ logs: `Error: ${err.message}` });
    }
});

// Tasks API — requires auth
app.get('/api/tasks', authRequired, async (req, res) => {
    try {
        // Regular users see only their own tasks, admins see all
        const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
        const tasks = isAdmin
            ? await db.queryAll('SELECT * FROM ragt_tasks ORDER BY created_at DESC LIMIT 50')
            : await db.queryAll('SELECT * FROM ragt_tasks WHERE web_user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
        res.json(tasks);
    } catch {
        res.json([]);
    }
});

// ==================== Admin Routes ====================
app.use('/api/admin', adminRoutes);

// ==================== Page Routing ====================

// Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Dashboard (SPA) — all non-API, non-login routes serve index.html
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && req.path !== '/login') {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        next();
    }
});

// ==================== Markdown to HTML ====================
function simpleMarkdownToHtml(md) {
    let html = md
        .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^---$/gm, '<hr>')
        .replace(/^\|(.+)\|$/gm, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.every(c => /^[\s-:]+$/.test(c))) return '';
            return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`;
        })
        .replace(/^- \[ \] (.+)$/gm, '<li>☐ $1</li>')
        .replace(/^- \[x\] (.+)$/gm, '<li>☑ $1</li>')
        .replace(/^[•\-] (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/^(?!<[hpulotbd]|<\/|<li|<hr|<pre|<block|<tr)(.+)$/gm, '<p>$1</p>')
        .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, '<table>$&</table>');
    return html;
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ==================== Startup ====================
async function start() {
    try {
        const dbOk = await testConnection();

        if (dbOk) {
            const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
            await db.query(schema);
            logger.info('DB', 'RemoteAGT schema initialized');
        }

        await orbitronClient.login();
        collector.startPeriodicCollection(config.monitor.collectInterval);

        const origCollect = collector.collectAll.bind(collector);
        collector.collectAll = async function () {
            const metrics = await origCollect();
            alertRules.evaluate(metrics);
            return metrics;
        };

        await telegramGateway.start();

        app.listen(config.port, () => {
            logger.system(`RemoteAGT Server Running`);
            console.log(`
╔════════════════════════════════════════╗
║  🪐 RemoteAGT — AI 원격 지휘·통제     ║
║  Dashboard: http://localhost:${config.port}      ║
║  Login:     http://localhost:${config.port}/login ║
║  API:       http://localhost:${config.port}/api   ║
╚════════════════════════════════════════╝
            `);
        });
    } catch (err) {
        logger.error('Server', `Failed to start: ${err.message}`);
        console.error(err);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    logger.info('Server', 'Shutting down...');
    collector.stopPeriodicCollection();
    await telegramGateway.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    collector.stopPeriodicCollection();
    await telegramGateway.stop();
    process.exit(0);
});

start();
