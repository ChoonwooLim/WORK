const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db/db');

const JWT_SECRET = process.env.JWT_SECRET || 'orbitron-secret-key';
const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
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

module.exports = router;
