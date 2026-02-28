// src/middleware/auth.js
// JWT authentication middleware for web dashboard
import jwt from 'jsonwebtoken';
import config from '../utils/config.js';
import db from '../../db/db.js';

// Verify JWT token and attach user to request
export function authRequired(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: '토큰이 만료되었거나 유효하지 않습니다.' });
    }
}

// Require superadmin role
export function superAdminRequired(req, res, next) {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ error: '최상위 관리자 권한이 필요합니다.' });
    }
    next();
}

// Require admin or superadmin role
export function adminRequired(req, res, next) {
    if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    next();
}

export default { authRequired, superAdminRequired, adminRequired };
