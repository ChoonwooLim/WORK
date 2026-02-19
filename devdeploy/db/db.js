const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'devuser',
    password: process.env.DB_PASSWORD || 'devpass123',
    database: process.env.DB_NAME || 'devdb',
});

// Helper: run a query
const query = (text, params) => pool.query(text, params);

// Helper: get single row
const queryOne = async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
};

// Helper: get all rows
const queryAll = async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows;
};

module.exports = { pool, query, queryOne, queryAll };
