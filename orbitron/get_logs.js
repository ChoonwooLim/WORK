require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();
async function run() {
  const res = await pool.query("SELECT id, status, logs FROM deployments ORDER BY id DESC LIMIT 1");
  console.log("ID:", res.rows[0].id);
  console.log("Status:", res.rows[0].status);
  console.log("Logs:\n", res.rows[0].logs);
  process.exit(0);
}
run();
