const jwt = require('jsonwebtoken');
const patRules = require('../services/patRules');

module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // For SSE Deploy stream, token might be passed as a query string since EventSource doesn't support custom headers
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (token) {
        // Personal Access Token (Task 3.2 — CLI). JWT 는 'eyJ' 로 시작하므로
        // 'opat_' 형식일 때만 이 분기를 타고, 아니면 기존 JWT 경로 그대로.
        if (patRules.isPatToken(token)) {
            try {
                const db = require('../db/db');
                const row = await db.queryOne(
                    `SELECT t.id AS token_id, u.id AS user_id, u.username, u.role
                     FROM personal_access_tokens t JOIN users u ON u.id = t.user_id
                     WHERE t.token_hash = $1`,
                    [patRules.hashPatToken(token)]
                );
                if (!row) {
                    return res.status(401).json({ error: 'Invalid or expired token' });
                }
                req.user = { userId: row.user_id, username: row.username, role: row.role };
                // best-effort — 응답을 막지 않는다
                db.query('UPDATE personal_access_tokens SET last_used_at = NOW() WHERE id = $1', [row.token_id]).catch(() => {});
                return next();
            } catch (e) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role };
            return next();
        } catch (e) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }

    return res.status(401).json({ error: 'Authentication required' });
};
