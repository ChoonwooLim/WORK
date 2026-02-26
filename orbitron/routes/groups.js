const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { decrypt } = require('../db/crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

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

// Helper: enrich a config-service with connection info for DB types
function enrichConfigService(svc) {
    if (svc.type === 'db_postgres' && svc.connection_info) {
        const hostIP = getHostIP();
        const c = svc.connection_info;
        c.internal_url = c.internal_url || `postgresql://${c.username}:${c.password}@${c.hostname}:${c.port}/${c.database}`;
        c.external_url = c.external_url || `postgresql://${c.username}:${c.password}@${hostIP}:${c.port}/${c.database}`;
        c.psql_command = c.psql_command || `PGPASSWORD=${c.password} psql -h ${hostIP} -p ${c.port} -U ${c.username} -d ${c.database}`;
    }
    return svc;
}

// GET /api/groups - List all groups for current user
router.get('/', async (req, res) => {
    try {
        const groups = await db.queryAll(
            `SELECT g.*,
                    COUNT(p.id) AS linked_count,
                    COUNT(CASE WHEN p.status = 'running' THEN 1 END) AS running_count
             FROM project_groups g
             LEFT JOIN projects p ON p.group_id = g.id
             WHERE g.user_id = $1
             GROUP BY g.id
             ORDER BY g.created_at DESC`,
            [req.user.userId]
        );
        // Add config service count
        groups.forEach(g => {
            const configServices = Array.isArray(g.services_config) ? g.services_config : [];
            g.service_count = parseInt(g.linked_count) + configServices.length;
        });
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/groups - Create a new group
router.post('/', async (req, res) => {
    try {
        const { name, description, services_config } = req.body;
        if (!name) return res.status(400).json({ error: '그룹 이름은 필수입니다.' });

        const group = await db.queryOne(
            `INSERT INTO project_groups (user_id, name, description, services_config)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.user.userId, name, description || '', JSON.stringify(services_config || [])]
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

// GET /api/groups/:id - Get group detail with MERGED services (linked projects + config services)
router.get('/:id', async (req, res) => {
    try {
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // 1. Linked Orbitron projects
        const linkedProjects = await db.queryAll(
            'SELECT * FROM projects WHERE group_id = $1 ORDER BY created_at ASC',
            [group.id]
        );

        const enrichedLinked = linkedProjects.map(s => {
            decryptEnvVars(s);
            s.runtime_label = getRuntimeLabel(s);
            s.source = 'linked'; // Mark as linked Orbitron project

            // For DB services, add connection info
            if (s.type === 'db_postgres') {
                const hostIP = getHostIP();
                const user = s.env_vars?.POSTGRES_USER || 'orbitron_user';
                const pass = s.env_vars?.POSTGRES_PASSWORD || 'orbitron_db_pass';
                const dbName = s.env_vars?.POSTGRES_DB || 'orbitron_db';
                const containerHost = `orbitron-${s.subdomain}`;
                const port = s.port || 5432;
                s.connection_info = {
                    hostname: containerHost, port, database: dbName, username: user, password: pass,
                    internal_url: `postgresql://${user}:${pass}@${containerHost}:${port}/${dbName}`,
                    external_url: `postgresql://${user}:${pass}@${hostIP}:${port}/${dbName}`,
                    psql_command: `PGPASSWORD=${pass} psql -h ${hostIP} -p ${port} -U ${user} -d ${dbName}`
                };
            }

            if (s.env_vars?.DATABASE_URL) {
                s.has_database_url = true;
                s.database_url = s.env_vars.DATABASE_URL;
            }

            return s;
        });

        // 2. Config-based sub-services
        const configServices = Array.isArray(group.services_config) ? group.services_config : [];
        const enrichedConfig = configServices.map(s => {
            s.source = 'config'; // Mark as config-defined service
            return enrichConfigService(s);
        });

        // 3. Merge both lists: config services first (canonical), then any linked projects not already in config
        const allServices = [...enrichedConfig, ...enrichedLinked];

        res.json({ ...group, services: allServices });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/groups/:id - Update a group (name, description, services_config)
router.put('/:id', async (req, res) => {
    try {
        const { name, description, services_config } = req.body;
        const updateFields = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { updateFields.push(`name = $${idx++}`); values.push(name); }
        if (description !== undefined) { updateFields.push(`description = $${idx++}`); values.push(description); }
        if (services_config !== undefined) { updateFields.push(`services_config = $${idx++}`); values.push(JSON.stringify(services_config)); }
        updateFields.push(`updated_at = NOW()`);
        values.push(req.params.id, req.user.userId);

        const group = await db.queryOne(
            `UPDATE project_groups SET ${updateFields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx++} RETURNING *`,
            values
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

        await db.query('UPDATE projects SET group_id = NULL WHERE group_id = $1', [group.id]);
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

        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const project = await db.queryOne(
            'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
            [project_id, req.user.userId]
        );
        if (!project) return res.status(404).json({ error: 'Project not found' });

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

// POST /api/groups/:id/config/service - Add a config-defined sub-service
router.post('/:id/config/service', async (req, res) => {
    try {
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const { key, name, type, runtime, root_dir, build_command, start_command, env_vars, connection_info } = req.body;
        if (!key || !name) return res.status(400).json({ error: 'key와 name은 필수입니다.' });

        const config = Array.isArray(group.services_config) ? [...group.services_config] : [];

        // Check for duplicate key
        if (config.some(s => s.key === key)) {
            return res.status(409).json({ error: `서비스 키 "${key}"가 이미 존재합니다.` });
        }

        config.push({ key, name, type: type || 'web', runtime: runtime || '', root_dir: root_dir || '', build_command: build_command || '', start_command: start_command || '', env_vars: env_vars || {}, connection_info: connection_info || null });

        await db.query(
            'UPDATE project_groups SET services_config = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(config), group.id]
        );

        res.status(201).json({ message: `서비스 "${name}"이 추가되었습니다.`, services_config: config });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/groups/:id/config/service/:key - Update a config service
router.put('/:id/config/service/:key', async (req, res) => {
    try {
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const config = Array.isArray(group.services_config) ? [...group.services_config] : [];
        const idx = config.findIndex(s => s.key === req.params.key);
        if (idx === -1) return res.status(404).json({ error: 'Service not found' });

        // Merge updates into existing service config
        const updates = req.body;
        config[idx] = { ...config[idx], ...updates, key: req.params.key }; // key is immutable

        await db.query(
            'UPDATE project_groups SET services_config = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(config), group.id]
        );

        res.json({ message: '서비스 설정이 업데이트되었습니다.', service: config[idx] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/groups/:id/config/service/:key - Remove a config service
router.delete('/:id/config/service/:key', async (req, res) => {
    try {
        const group = await db.queryOne(
            'SELECT * FROM project_groups WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const config = Array.isArray(group.services_config) ? group.services_config.filter(s => s.key !== req.params.key) : [];

        await db.query(
            'UPDATE project_groups SET services_config = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(config), group.id]
        );

        res.json({ message: '서비스가 제거되었습니다.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
