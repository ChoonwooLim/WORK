const express = require('express');
const router = express.Router();
const db = require('../db/db');
const dockerService = require('../services/docker');

// GET /api/deployments/:projectId - Get deployments for a project
router.get('/:projectId', async (req, res) => {
    try {
        const deployments = await db.queryAll(
            'SELECT id, project_id, commit_hash, commit_message, status, started_at, finished_at, LENGTH(logs) as log_size FROM deployments WHERE project_id = $1 ORDER BY started_at DESC LIMIT 20',
            [req.params.projectId]
        );
        res.json(deployments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/deployments/:projectId/log/:deploymentId - Get full deployment log
router.get('/:projectId/log/:deploymentId', async (req, res) => {
    try {
        const deployment = await db.queryOne(
            'SELECT id, project_id, commit_hash, commit_message, status, logs, started_at, finished_at FROM deployments WHERE id = $1 AND project_id = $2',
            [req.params.deploymentId, req.params.projectId]
        );
        if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
        res.json(deployment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/deployments/:projectId/logs - Get live container logs
router.get('/:projectId/logs', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.projectId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const containerName = `orbitron-${project.subdomain}`;
        const logs = await dockerService.getContainerLogs(containerName, req.query.lines || 100);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
