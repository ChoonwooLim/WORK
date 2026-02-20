const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { password } = req.body;

    // Default password is 'admin' if not set in environment
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (password === adminPassword) {
        const token = jwt.sign(
            { role: 'admin' },
            process.env.JWT_SECRET || 'devdeploy-secret-key',
            { expiresIn: '7d' }
        );
        res.json({ token, success: true });
    } else {
        res.status(401).json({ error: 'Invalid password', success: false });
    }
});

module.exports = router;
