const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const db = require('./db/db');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/projects', require('./routes/projects'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/deployments', require('./routes/deployments'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Server info - returns public IP for external URL display
app.get('/api/server-info', async (req, res) => {
    try {
        const { execSync } = require('child_process');
        const publicIp = execSync('curl -4 -s --connect-timeout 3 ifconfig.me 2>/dev/null', { stdio: 'pipe' }).toString().trim();
        res.json({ publicIp });
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

        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════╗
║   🚀 DevDeploy Server Running       ║
║   http://localhost:${PORT}              ║
║   Dashboard: http://localhost:${PORT}   ║
║   Webhook: POST /api/webhooks/github ║
╚══════════════════════════════════════╝
`);
        });
    } catch (error) {
        console.error('❌ Failed to start:', error.message);
        process.exit(1);
    }
}

start();
