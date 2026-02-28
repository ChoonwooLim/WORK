// src/auth/userRegistry.js
// Manages authorized users for the RemoteAGT system
import db from '../../db/db.js';
import logger from '../utils/logger.js';

class UserRegistry {
    // Register or update a user from an SNS platform
    async registerUser(platform, platformUserId, username) {
        try {
            const existing = await db.queryOne(
                'SELECT * FROM ragt_users WHERE platform = $1 AND platform_user_id = $2',
                [platform, platformUserId]
            );

            if (existing) {
                await db.query(
                    'UPDATE ragt_users SET last_active_at = NOW(), username = $1 WHERE id = $2',
                    [username, existing.id]
                );
                return existing;
            }

            const user = await db.queryOne(
                `INSERT INTO ragt_users (username, platform, platform_user_id, auth_level, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING *`,
                [username, platform, platformUserId, 1]
            );
            logger.info('Auth', `New user registered: ${username} (${platform})`);
            return user;
        } catch (err) {
            logger.error('Auth', `Failed to register user: ${err.message}`);
            throw err;
        }
    }

    // Check if user is authorized
    async isAuthorized(platform, platformUserId) {
        const user = await db.queryOne(
            'SELECT * FROM ragt_users WHERE platform = $1 AND platform_user_id = $2 AND is_active = true',
            [platform, platformUserId]
        );
        return user;
    }

    // Check if user is admin (Telegram admin ID check)
    isAdmin(platformUserId) {
        const adminId = process.env.TELEGRAM_ADMIN_ID || '';
        return platformUserId === adminId;
    }

    // Update auth level
    async setAuthLevel(userId, level) {
        await db.query('UPDATE ragt_users SET auth_level = $1 WHERE id = $2', [level, userId]);
    }

    // Get all users
    async getAllUsers() {
        return db.queryAll('SELECT * FROM ragt_users ORDER BY created_at DESC');
    }

    // Log an audit entry
    async logAudit(userId, action, details = {}) {
        try {
            await db.query(
                'INSERT INTO ragt_audit_log (user_id, action, details) VALUES ($1, $2, $3)',
                [userId, action, JSON.stringify(details)]
            );
        } catch (err) {
            logger.error('Audit', `Failed to log audit: ${err.message}`);
        }
    }
}

export default new UserRegistry();
