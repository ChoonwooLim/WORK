const express = require('express');
const router = express.Router();
const db = require('../db/db');

// GET /api/issues — list all issues with optional filters
router.get('/', async (req, res) => {
    try {
        const { category, status, project_id } = req.query;
        let sql = `SELECT i.*, p.name as project_name, u.username as author
                    FROM issues i
                    LEFT JOIN projects p ON i.project_id = p.id
                    LEFT JOIN users u ON i.created_by = u.id
                    WHERE 1=1`;
        const params = [];

        if (category) {
            params.push(category);
            sql += ` AND i.category = $${params.length}`;
        }
        if (status) {
            params.push(status);
            sql += ` AND i.status = $${params.length}`;
        }
        if (project_id) {
            params.push(parseInt(project_id));
            sql += ` AND i.project_id = $${params.length}`;
        }

        sql += ' ORDER BY i.created_at DESC';

        const result = await db.query(sql, params);
        res.json(result.rows || []);
    } catch (err) {
        console.error('Issues fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/issues — create a new issue
router.post('/', async (req, res) => {
    try {
        const { title, category, status, priority, description, solution, project_id } = req.body;
        if (!title) return res.status(400).json({ error: '제목은 필수입니다.' });

        const result = await db.queryOne(
            `INSERT INTO issues (title, category, status, priority, description, solution, project_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [title, category || 'bug', status || 'open', priority || 'medium', description || '', solution || '', project_id || null, req.user?.id || null]
        );
        res.json(result);
    } catch (err) {
        console.error('Issue create error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/issues/:id — update an issue
router.put('/:id', async (req, res) => {
    try {
        const { title, category, status, priority, description, solution, project_id } = req.body;
        const result = await db.queryOne(
            `UPDATE issues SET title=$1, category=$2, status=$3, priority=$4, description=$5, solution=$6, project_id=$7, updated_at=NOW()
             WHERE id=$8 RETURNING *`,
            [title, category, status, priority, description || '', solution || '', project_id || null, req.params.id]
        );
        if (!result) return res.status(404).json({ error: '이슈를 찾을 수 없습니다.' });
        res.json(result);
    } catch (err) {
        console.error('Issue update error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/issues/:id — delete an issue
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM issues WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Issue delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
