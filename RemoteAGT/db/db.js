// db/db.js
// PostgreSQL connection pool (shared with Orbitron)
import pg from 'pg';
import config from '../src/utils/config.js';
import logger from '../src/utils/logger.js';

const { Pool } = pg;

// Parse TIMESTAMP WITHOUT TIMEZONE as UTC (consistent with Orbitron)
pg.types.setTypeParser(1114, (stringValue) => new Date(stringValue + 'Z'));

const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    max: 10,
    idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    logger.error('DB', 'Unexpected pool error', { error: err.message });
});

// Run a query
export const query = (text, params) => pool.query(text, params);

// Get single row
export const queryOne = async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
};

// Get all rows
export const queryAll = async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows;
};

// Test connection
export const testConnection = async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        logger.info('DB', `Connected to PostgreSQL at ${config.db.host}:${config.db.port}/${config.db.database}`);
        return true;
    } catch (err) {
        logger.error('DB', `Connection failed: ${err.message}`);
        return false;
    }
};

export default { pool, query, queryOne, queryAll, testConnection };
