const express = require('express');
const router = express.Router();
const db = require('../db/db');
const deployer = require('../services/deployer');

// GET /api/projects - List all projects
router.get('/', async (req, res) => {
    try {
        const projects = await db.queryAll(
            'SELECT * FROM projects ORDER BY created_at DESC'
        );
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id - Get project details
router.get('/:id', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res) => {
    try {
        const { name, github_url, branch, build_command, start_command, port, subdomain, env_vars } = req.body;

        if (!name || !github_url) {
            return res.status(400).json({ error: 'name and github_url are required' });
        }

        const projectSubdomain = subdomain || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const projectPort = port || (3000 + Math.floor(Math.random() * 1000));

        const project = await db.queryOne(
            `INSERT INTO projects (name, github_url, branch, build_command, start_command, port, subdomain, env_vars)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, github_url, branch || 'main', build_command, start_command, projectPort, projectSubdomain, JSON.stringify(env_vars || {})]
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
        const { name, github_url, branch, build_command, start_command, port, subdomain, env_vars } = req.body;
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
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
            [name, github_url, branch, build_command, start_command, port, subdomain, env_vars ? JSON.stringify(env_vars) : null, req.params.id]
        );
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/projects/:id - Delete a project
router.delete('/:id', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        await deployer.deleteProject(project);
        await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);

        res.json({ message: 'Project deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/deploy - Manually trigger deploy
router.post('/:id/deploy', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Deploy in background
        res.json({ message: 'Deployment started', project_id: project.id });

        deployer.deploy(project).catch(err => {
            console.error(`Deploy error for ${project.name}:`, err);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/stop - Stop a project
router.post('/:id/stop', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        await deployer.stop(project);
        res.json({ message: 'Project stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
