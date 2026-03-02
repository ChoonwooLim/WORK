// Viewer Guard middleware
// Blocks write operations (POST, PUT, PATCH, DELETE) for users with 'viewer' role
// Viewers can only perform GET requests (read-only access)

module.exports = (req, res, next) => {
    // Allow all GET requests (read-only)
    if (req.method === 'GET') {
        return next();
    }

    // Block write operations for viewer role
    if (req.user && req.user.role === 'viewer') {
        return res.status(403).json({
            error: '읽기 전용 계정입니다. 관리자에게 권한 승격을 요청하세요.',
            code: 'VIEWER_READONLY'
        });
    }

    next();
};
