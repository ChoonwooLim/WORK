const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // For SSE Deploy stream, token might be passed as a query string since EventSource doesn't support custom headers
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'orbitron-secret-key');
            req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role };
            return next();
        } catch (e) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }

    return res.status(401).json({ error: 'Authentication required' });
};
