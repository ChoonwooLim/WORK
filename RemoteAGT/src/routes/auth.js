// src/routes/auth.js
// Authentication routes (login, register, me)
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../utils/config.js';
import db from '../../db/db.js';
import logger from '../utils/logger.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
        }

        const user = await db.queryOne(
            'SELECT * FROM ragt_web_users WHERE email = $1 AND is_active = true',
            [email.toLowerCase().trim()]
        );

        if (!user) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        // Update login stats
        await db.query(
            'UPDATE ragt_web_users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1',
            [user.id]
        );

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username, role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        // Audit log
        await db.query(
            'INSERT INTO ragt_audit_log (web_user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [user.id, 'login', JSON.stringify({ email: user.email }), req.ip]
        );

        logger.info('Auth', `Login: ${user.email} (${user.role})`);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url,
            },
        });
    } catch (err) {
        logger.error('Auth', `Login error: ${err.message}`);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: '모든 필드를 입력하세요.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
        }

        // Check if email exists
        const existing = await db.queryOne(
            'SELECT id FROM ragt_web_users WHERE email = $1',
            [email.toLowerCase().trim()]
        );
        if (existing) {
            return res.status(409).json({ error: '이미 등록된 이메일입니다.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Check if this is the first user → make superadmin
        const userCount = await db.queryOne('SELECT COUNT(*) as count FROM ragt_web_users');
        const role = parseInt(userCount.count) === 0 ? 'superadmin' : 'user';

        const user = await db.queryOne(
            `INSERT INTO ragt_web_users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, role`,
            [username.trim(), email.toLowerCase().trim(), passwordHash, role]
        );

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username, role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        // Audit
        await db.query(
            'INSERT INTO ragt_audit_log (web_user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [user.id, 'register', JSON.stringify({ email: user.email, role }), req.ip]
        );

        logger.success('Auth', `New user registered: ${user.email} (${role})`);

        res.status(201).json({
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role },
        });
    } catch (err) {
        logger.error('Auth', `Register error: ${err.message}`);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// GET /api/auth/me — current user info
router.get('/me', authRequired, async (req, res) => {
    try {
        const user = await db.queryOne(
            'SELECT id, username, email, role, avatar_url, last_login_at, login_count, created_at FROM ragt_web_users WHERE id = $1',
            [req.user.id]
        );
        if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/profile — update own profile
router.put('/profile', authRequired, async (req, res) => {
    try {
        const { username, avatar_url } = req.body;
        const user = await db.queryOne(
            'UPDATE ragt_web_users SET username = COALESCE($1, username), avatar_url = COALESCE($2, avatar_url), updated_at = NOW() WHERE id = $3 RETURNING id, username, email, role, avatar_url',
            [username, avatar_url, req.user.id]
        );
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
