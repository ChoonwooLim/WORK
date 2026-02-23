const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/db');
const deployer = require('../services/deployer');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'orbitron-secret';

// POST /api/webhooks/github - Receive GitHub webhook
router.post('/github', async (req, res) => {
    try {
        const event = req.headers['x-github-event'];
        const signature = req.headers['x-hub-signature-256'];

        // Verify signature if secret is set
        if (WEBHOOK_SECRET && signature) {
            if (!req.rawBody) return res.status(400).json({ error: 'Raw body required for signature verification' });
            const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
            const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
            if (signature !== digest) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        // Only handle push events
        if (event !== 'push') {
            return res.json({ message: `Ignored event: ${event}` });
        }

        const payload = req.body;
        const repoUrl = payload.repository?.html_url || payload.repository?.clone_url;
        const branch = payload.ref?.replace('refs/heads/', '');
        const commitHash = payload.after;
        const commitMessage = payload.head_commit?.message || '';

        if (!repoUrl) {
            return res.status(400).json({ error: 'No repository URL in payload' });
        }

        // Find matching projects
        const projects = await db.queryAll(
            `SELECT * FROM projects WHERE github_url LIKE $1 AND branch = $2`,
            [`%${payload.repository.full_name}%`, branch]
        );

        if (projects.length === 0) {
            return res.json({ message: 'No matching projects found' });
        }

        // Deploy each matching project (if auto_deploy is enabled)
        const results = [];
        for (const project of projects) {
            if (project.auto_deploy === false) {
                console.log(`⏭️ Skipping auto-deploy for ${project.name} (auto_deploy disabled)`);
                results.push({ project: project.name, status: 'skipped' });
                continue;
            }
            console.log(`🚀 Auto-deploying: ${project.name} (commit: ${commitHash?.substring(0, 7)})`);
            deployer.deploy(project, commitHash, commitMessage).catch(err => {
                console.error(`Deploy error for ${project.name}:`, err);
            });
            results.push({ project: project.name, status: 'deploying' });
        }

        res.json({ message: 'Deployments triggered', results });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
