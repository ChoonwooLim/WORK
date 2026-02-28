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

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ==================== Middleware ====================
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== API Routes ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'RemoteAGT',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Metrics API (system + containers)
app.get('/api/metrics', async (req, res) => {
    try {
        const metrics = await collector.collectAll();
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Orbitron proxy: projects
app.get('/api/orbitron/projects', async (req, res) => {
    try {
        const projects = await orbitronClient.getProjects();
        res.json(projects || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Orbitron proxy: deploy
app.post('/api/orbitron/projects/:id/deploy', async (req, res) => {
    try {
        const result = await orbitronClient.deployProject(req.params.id);
        res.json(result || { message: 'Deploy triggered' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Orbitron proxy: logs
app.get('/api/orbitron/projects/:id/logs', async (req, res) => {
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

// Tasks API
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await db.queryAll(
            'SELECT * FROM ragt_tasks ORDER BY created_at DESC LIMIT 50'
        );
        res.json(tasks);
    } catch {
        res.json([]);
    }
});

// Plan API (returns rendered HTML from markdown)
app.get('/api/plan', async (req, res) => {
    try {
        const planPath = path.join(__dirname, 'docs', 'plan.md');
        const md = fs.readFileSync(planPath, 'utf-8');
        // Simple markdown to HTML conversion
        const html = simpleMarkdownToHtml(md);
        res.json({ html });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Telegram status
app.get('/api/telegram/status', (req, res) => {
    res.json({
        botConfigured: !!config.telegram.botToken,
        adminConfigured: !!config.telegram.adminId,
    });
});

// SPA fallback
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        next();
    }
});

// ==================== Simple Markdown to HTML ====================
function simpleMarkdownToHtml(md) {
    let html = md
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
        })
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Blockquote (including alerts)
        .replace(/^> \[!(\w+)\]\n> (.+)$/gm, '<blockquote class="alert-$1"><strong>$1:</strong> $2</blockquote>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr>')
        // Tables
        .replace(/^\|(.+)\|$/gm, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.every(c => /^[\s-:]+$/.test(c))) return ''; // separator row
            const tag = cells.some(c => /^[\s-:]+$/.test(c)) ? 'td' : 'td';
            return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
        })
        // Unordered lists
        .replace(/^- \[ \] (.+)$/gm, '<li>☐ $1</li>')
        .replace(/^- \[x\] (.+)$/gm, '<li>☑ $1</li>')
        .replace(/^- \[\/\] (.+)$/gm, '<li>🔄 $1</li>')
        .replace(/^[•\-] (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Paragraphs
        .replace(/^(?!<[hpulotbd]|<\/|<li|<hr|<pre|<block|<tr)(.+)$/gm, '<p>$1</p>')
        // Wrap consecutive <li> in <ul>
        .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>')
        // Wrap consecutive <tr> in <table>
        .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, '<table>$&</table>');

    return html;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==================== Startup ====================
async function start() {
    try {
        // 1. Test DB connection
        const dbOk = await testConnection();

        // 2. Initialize schema
        if (dbOk) {
            const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
            await db.query(schema);
            logger.info('DB', 'RemoteAGT schema initialized');
        }

        // 3. Connect to Orbitron API
        await orbitronClient.login();

        // 4. Start metrics collection
        collector.startPeriodicCollection(config.monitor.collectInterval);

        // 5. Set up alert evaluation on each collection
        const origCollect = collector.collectAll.bind(collector);
        collector.collectAll = async function () {
            const metrics = await origCollect();
            alertRules.evaluate(metrics);
            return metrics;
        };

        // 6. Start Telegram bot
        await telegramGateway.start();

        // 7. Start HTTP server
        app.listen(config.port, () => {
            logger.system(`RemoteAGT Server Running`);
            console.log(`
╔════════════════════════════════════════╗
║  🪐 RemoteAGT — AI 원격 지휘·통제     ║
║  Dashboard: http://localhost:${config.port}      ║
║  API:       http://localhost:${config.port}/api  ║
║  Health:    http://localhost:${config.port}/api/health ║
╚════════════════════════════════════════╝
      `);
        });

    } catch (err) {
        logger.error('Server', `Failed to start: ${err.message}`);
        console.error(err);
        process.exit(1);
    }
}

// Graceful shutdown
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
