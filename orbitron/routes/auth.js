const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db/db');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is required. Set it in .env');
    process.exit(1);
}
const SALT_ROUNDS = 10;

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per `window` (here, per 15 minutes)
    message: { error: '너무 많은 요청이 발생했습니다. 15분 후에 다시 시도해주세요.', success: false }
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: '모든 필드를 입력해주세요.', success: false });
    }

    if (password.length < 4) {
        return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.', success: false });
    }

    try {
        // Check if email or username already exists
        const existing = await db.queryOne(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );
        if (existing) {
            return res.status(409).json({ error: '이미 사용 중인 이메일 또는 사용자명입니다.', success: false });
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await db.queryOne(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role',
            [username, email, password_hash]
        );

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role }, success: true });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.', success: false });
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.', success: false });
    }

    try {
        const user = await db.queryOne('SELECT * FROM users WHERE email = $1', [email]);
        if (!user) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.', success: false });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.', success: false });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role }, success: true });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '로그인 중 오류가 발생했습니다.', success: false });
    }
});

// ── Personal Access Tokens (Task 3.2 — Orbitron CLI) ──
// 이 라우터는 인증 없이 마운트되므로 (server.js: app.use('/api/auth', ...))
// PAT 라우트에만 authMiddleware 를 개별 적용한다. JWT 또는 기존 PAT 로 인증.
const authMiddleware = require('../middleware/auth');
const patRules = require('../services/patRules');

// POST /api/auth/tokens — PAT 발급. 토큰 원문은 이 응답에서 딱 한 번 노출.
router.post('/tokens', authMiddleware, async (req, res) => {
    try {
        const name = patRules.sanitizePatName(req.body && req.body.name);
        const token = patRules.generatePatToken();
        const row = await db.queryOne(
            'INSERT INTO personal_access_tokens (user_id, name, token_hash) VALUES ($1, $2, $3) RETURNING id, name, created_at',
            [req.user.userId, name, patRules.hashPatToken(token)]
        );
        res.status(201).json({ id: row.id, name: row.name, token, created_at: row.created_at, success: true });
    } catch (error) {
        console.error('PAT issue error:', error.message);
        res.status(500).json({ error: '토큰 발급 중 오류가 발생했습니다.', success: false });
    }
});

// GET /api/auth/tokens — 내 PAT 목록 (해시/원문 미포함)
router.get('/tokens', authMiddleware, async (req, res) => {
    try {
        const tokens = await db.queryAll(
            'SELECT id, name, created_at, last_used_at FROM personal_access_tokens WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.userId]
        );
        res.json(tokens);
    } catch (error) {
        console.error('PAT list error:', error.message);
        res.status(500).json({ error: '토큰 목록 조회 중 오류가 발생했습니다.', success: false });
    }
});

// DELETE /api/auth/tokens/:id — PAT 폐기 (본인 소유만, 행 삭제)
router.delete('/tokens/:id', authMiddleware, async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) {
            return res.status(404).json({ error: '토큰을 찾을 수 없습니다.', success: false });
        }
        const deleted = await db.queryOne(
            'DELETE FROM personal_access_tokens WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );
        if (!deleted) {
            return res.status(404).json({ error: '토큰을 찾을 수 없습니다.', success: false });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('PAT revoke error:', error.message);
        res.status(500).json({ error: '토큰 폐기 중 오류가 발생했습니다.', success: false });
    }
});

module.exports = router;
