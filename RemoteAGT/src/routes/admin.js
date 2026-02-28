// src/routes/admin.js
// Super Admin dashboard API routes
import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../../db/db.js';
import collector from '../monitor/collector.js';
import logger from '../utils/logger.js';
import { authRequired, superAdminRequired } from '../middleware/auth.js';

const router = Router();

// All admin routes require auth + superadmin
router.use(authRequired, superAdminRequired);

// ==================== Dashboard Stats ====================

// GET /api/admin/stats — overall system statistics for admin dashboard
router.get('/stats', async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            totalTasks,
            completedTasks,
            failedTasks,
            recentLogins,
            totalNotifications,
        ] = await Promise.all([
            db.queryOne('SELECT COUNT(*) as count FROM ragt_web_users'),
            db.queryOne("SELECT COUNT(*) as count FROM ragt_web_users WHERE last_login_at > NOW() - INTERVAL '7 days'"),
            db.queryOne('SELECT COUNT(*) as count FROM ragt_tasks'),
            db.queryOne("SELECT COUNT(*) as count FROM ragt_tasks WHERE status = 'completed'"),
            db.queryOne("SELECT COUNT(*) as count FROM ragt_tasks WHERE status = 'failed'"),
            db.queryOne("SELECT COUNT(*) as count FROM ragt_audit_log WHERE action = 'login' AND created_at > NOW() - INTERVAL '24 hours'"),
            db.queryOne('SELECT COUNT(*) as count FROM ragt_notifications'),
        ]);

        // System metrics
        const metrics = collector.getLatest();

        res.json({
            users: {
                total: parseInt(totalUsers.count),
                activeThisWeek: parseInt(activeUsers.count),
                loginsToday: parseInt(recentLogins.count),
            },
            tasks: {
                total: parseInt(totalTasks.count),
                completed: parseInt(completedTasks.count),
                failed: parseInt(failedTasks.count),
            },
            notifications: parseInt(totalNotifications.count),
            system: metrics?.system || null,
            containers: metrics?.containers || [],
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== User Management ====================

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            where += ` AND (username ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }
        if (role) {
            params.push(role);
            where += ` AND role = $${params.length}`;
        }

        params.push(limit, offset);
        const users = await db.queryAll(
            `SELECT id, username, email, role, is_active, last_login_at, login_count, created_at
       FROM ragt_web_users ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const total = await db.queryOne(`SELECT COUNT(*) as count FROM ragt_web_users ${where}`, params.slice(0, -2));

        res.json({
            users,
            total: parseInt(total.count),
            page: parseInt(page),
            totalPages: Math.ceil(parseInt(total.count) / limit),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/users/:id — user detail
router.get('/users/:id', async (req, res) => {
    try {
        const user = await db.queryOne(
            `SELECT id, username, email, role, is_active, avatar_url, last_login_at, login_count, created_at, updated_at
       FROM ragt_web_users WHERE id = $1`,
            [req.params.id]
        );
        if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

        // Get linked SNS accounts
        const snsAccounts = await db.queryAll(
            'SELECT * FROM ragt_users WHERE web_user_id = $1',
            [user.id]
        );

        // Get recent activity
        const recentActivity = await db.queryAll(
            'SELECT * FROM ragt_audit_log WHERE web_user_id = $1 ORDER BY created_at DESC LIMIT 20',
            [user.id]
        );

        // Get task stats
        const taskStats = await db.queryOne(
            `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM ragt_tasks WHERE web_user_id = $1`,
            [user.id]
        );

        res.json({ ...user, snsAccounts, recentActivity, taskStats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/admin/users/:id — update user (role, active status)
router.put('/users/:id', async (req, res) => {
    try {
        const { role, is_active, username } = req.body;
        const targetId = parseInt(req.params.id);

        // Prevent changing own superadmin role
        if (targetId === req.user.id && role && role !== 'superadmin') {
            return res.status(400).json({ error: '자신의 최상위 관리자 권한은 변경할 수 없습니다.' });
        }

        const user = await db.queryOne(
            `UPDATE ragt_web_users SET
        role = COALESCE($1, role),
        is_active = COALESCE($2, is_active),
        username = COALESCE($3, username),
        updated_at = NOW()
       WHERE id = $4 RETURNING id, username, email, role, is_active`,
            [role, is_active, username, targetId]
        );

        if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

        // Audit
        await db.query(
            'INSERT INTO ragt_audit_log (web_user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'admin_update_user', JSON.stringify({ targetId, changes: req.body }), req.ip]
        );

        logger.info('Admin', `User updated: ${user.email} → role=${user.role}, active=${user.is_active}`);
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/users/:id — deactivate (soft delete)
router.delete('/users/:id', async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        if (targetId === req.user.id) {
            return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' });
        }

        await db.query('UPDATE ragt_web_users SET is_active = false, updated_at = NOW() WHERE id = $1', [targetId]);

        await db.query(
            'INSERT INTO ragt_audit_log (web_user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'admin_deactivate_user', JSON.stringify({ targetId }), req.ip]
        );

        res.json({ message: '사용자가 비활성화되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE ragt_web_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);

        await db.query(
            'INSERT INTO ragt_audit_log (web_user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [req.user.id, 'admin_reset_password', JSON.stringify({ targetId: req.params.id }), req.ip]
        );

        res.json({ message: '비밀번호가 재설정되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Activity Log ====================

// GET /api/admin/audit — audit log
router.get('/audit', async (req, res) => {
    try {
        const { page = 1, limit = 30, action, userId } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (action) {
            params.push(action);
            where += ` AND a.action = $${params.length}`;
        }
        if (userId) {
            params.push(userId);
            where += ` AND a.web_user_id = $${params.length}`;
        }

        params.push(limit, offset);
        const logs = await db.queryAll(
            `SELECT a.*, u.username, u.email
       FROM ragt_audit_log a
       LEFT JOIN ragt_web_users u ON a.web_user_id = u.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const total = await db.queryOne(`SELECT COUNT(*) as count FROM ragt_audit_log a ${where}`, params.slice(0, -2));

        res.json({
            logs,
            total: parseInt(total.count),
            page: parseInt(page),
            totalPages: Math.ceil(parseInt(total.count) / limit),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== All Tasks ====================

// GET /api/admin/tasks — all tasks from all users
router.get('/tasks', async (req, res) => {
    try {
        const { page = 1, limit = 30, status, userId } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE 1=1';
        const params = [];

        if (status) {
            params.push(status);
            where += ` AND t.status = $${params.length}`;
        }
        if (userId) {
            params.push(userId);
            where += ` AND (t.web_user_id = $${params.length} OR t.user_id = $${params.length})`;
        }

        params.push(limit, offset);
        const tasks = await db.queryAll(
            `SELECT t.*, u.username, u.email
       FROM ragt_tasks t
       LEFT JOIN ragt_web_users u ON t.web_user_id = u.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const total = await db.queryOne(`SELECT COUNT(*) as count FROM ragt_tasks t ${where}`, params.slice(0, -2));

        res.json({
            tasks,
            total: parseInt(total.count),
            page: parseInt(page),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== System Controls ====================

// POST /api/admin/system/collect-metrics — force metric collection
router.post('/system/collect-metrics', async (req, res) => {
    try {
        const metrics = await collector.collectAll();
        res.json({ message: '메트릭이 수집되었습니다.', metrics });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
