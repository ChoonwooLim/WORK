const express = require('express');
const router = express.Router();
const db = require('../db/db');
const dockerService = require('../services/docker');

// GET /api/deployments/:projectId - Get deployments for a project
router.get('/:projectId', async (req, res) => {
    try {
        const deployments = await db.queryAll(
            'SELECT * FROM deployments WHERE project_id = $1 ORDER BY started_at DESC LIMIT 20',
            [req.params.projectId]
        );
        res.json(deployments);
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
