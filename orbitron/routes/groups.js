const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { decrypt } = require('../db/crypto');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const os = require('os');

// Helper: get host LAN IP for external DB URLs
function getHostIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Helper: decrypt project env_vars
function decryptEnvVars(project) {
    if (project.env_vars && typeof project.env_vars === 'string') {
        try {
            const decrypted = decrypt(project.env_vars);
            project.env_vars = decrypted ? JSON.parse(decrypted) : {};
        } catch (e) { project.env_vars = {}; }
    }
    return project;
}

// Helper: detect runtime label from project
function getRuntimeLabel(project) {
    if (project.type === 'db_postgres') return 'PostgreSQL';
    if (project.type === 'db_redis') return 'Redis';
    if (project.type === 'worker') return 'Worker';

    // Try to detect from deployment directory
    const path = require('path');
    const fs = require('fs');
    const projDir = path.join(__dirname, '..', 'deployments', project.subdomain || '');
    try {
        if (fs.existsSync(path.join(projDir, 'requirements.txt')) || fs.existsSync(path.join(projDir, 'main.py'))) return 'Python';
        if (fs.existsSync(path.join(projDir, 'package.json'))) {
            const pkg = JSON.parse(fs.readFileSync(path.join(projDir, 'package.json'), 'utf-8'));
            if (pkg.dependencies?.next || pkg.devDependencies?.next) return 'Next.js';
            if (pkg.dependencies?.react || pkg.devDependencies?.react) return 'React';
            if (pkg.dependencies?.vue || pkg.devDependencies?.vue) return 'Vue';
            return 'Node.js';
        }
        if (fs.existsSync(path.join(projDir, 'index.html'))) return 'Static';
    } catch (e) { }

    if (project.source_type === 'upload') return 'Upload';
    return 'Web';
}

// GET /api/groups - List all groups for current user
router.get('/', async (req, res) => {
    try {
        const groups = await db.queryAll(
            `SELECT g.*,
                    COUNT(p.id) AS service_count,
                    COUNT(CASE WHEN p.status = 'running' THEN 1 END) AS running_count
             FROM project_groups g
             LEFT JOIN projects p ON p.group_id = g.id
             WHERE g.user_id = $1
             GROUP BY g.id
             ORDER BY g.created_at DESC`,
            [req.user.userId]
        );
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/groups - Create a new group
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: '그룹 이름은 필수입니다.' });

        const group = await db.queryOne(
            `INSERT INTO project_groups (user_id, name, description)
             VALUES ($1, $2, $3) RETURNING *`,
            [req.user.userId, name, description || '']
        );
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/groups/unassigned/projects - Get projects not assigned to any group
// MUST be before /:id to avoid Express matching 'unassigned' as an id!
router.get('/unassigned/projects', async (req, res) => {
    try {
        const projects = await db.queryAll(
            'SELECT id, name, type, status, subdomain FROM projects WHERE user_id = $1 AND group_id IS NULL ORDER BY name ASC',
            [req.user.userId]
        );
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/groups/:id - Get group detail with services
router.get('/:id', async (req, res) => {
    try {
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const services = await db.queryAll(
            'SELECT * FROM projects WHERE group_id = $1 ORDER BY created_at ASC',
            [group.id]
        );

        // Decrypt env_vars and add runtime labels
        const enrichedServices = services.map(s => {
            decryptEnvVars(s);
            s.runtime_label = getRuntimeLabel(s);

            // For DB services, add connection info
            if (s.type === 'db_postgres') {
                const hostIP = getHostIP();
                const user = s.env_vars?.POSTGRES_USER || 'orbitron_user';
                const pass = s.env_vars?.POSTGRES_PASSWORD || 'orbitron_db_pass';
                const dbName = s.env_vars?.POSTGRES_DB || 'orbitron_db';
                const containerHost = `orbitron-${s.subdomain}`;
                const port = s.port || 5432;

                s.connection_info = {
                    hostname: containerHost,
                    port,
                    database: dbName,
                    username: user,
                    password: pass,
                    internal_url: `postgresql://${user}:${pass}@${containerHost}:${port}/${dbName}`,
                    external_url: `postgresql://${user}:${pass}@${hostIP}:${port}/${dbName}`,
                    psql_command: `PGPASSWORD=${pass} psql -h ${hostIP} -p ${port} -U ${user} -d ${dbName}`
                };
            }

            // For web projects with DATABASE_URL, expose it too
            if (s.env_vars?.DATABASE_URL) {
                const dbUrl = s.env_vars.DATABASE_URL;
                s.has_database_url = true;
                s.database_url = dbUrl;
            }

            return s;
        });

        res.json({ ...group, services: enrichedServices });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/groups/:id - Update a group
router.put('/:id', async (req, res) => {
    try {
        const { name, description } = req.body;
        const group = await db.queryOne(
            `UPDATE project_groups SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                updated_at = NOW()
             WHERE id = $3 AND user_id = $4 RETURNING *`,
            [name, description, req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/groups/:id - Delete a group (services are only detached, not deleted)
router.delete('/:id', async (req, res) => {
    try {
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Detach services from group
        await db.query('UPDATE projects SET group_id = NULL WHERE group_id = $1', [group.id]);
        // Delete group
        await db.query('DELETE FROM project_groups WHERE id = $1', [group.id]);

        res.json({ message: '그룹이 삭제되었습니다. 서비스는 유지됩니다.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/groups/:id/services - Add existing project to group
router.post('/:id/services', async (req, res) => {
    try {
        const { project_id } = req.body;
        if (!project_id) return res.status(400).json({ error: 'project_id는 필수입니다.' });

        // Verify group ownership
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Verify project ownership
        const project = await db.queryOne(
            'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
            [project_id, req.user.userId]
        );
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Assign project to group
        await db.query('UPDATE projects SET group_id = $1 WHERE id = $2', [group.id, project.id]);

        res.json({ message: `${project.name}이(가) ${group.name} 그룹에 추가되었습니다.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/groups/:id/services/:projectId - Remove project from group
router.delete('/:id/services/:projectId', async (req, res) => {
    try {
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        await db.query(
            'UPDATE projects SET group_id = NULL WHERE id = $1 AND group_id = $2 AND user_id = $3',
            [req.params.projectId, group.id, req.user.userId]
        );

        res.json({ message: '서비스가 그룹에서 제거되었습니다.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
