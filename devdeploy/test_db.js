const db = require('./db/db');
async function test() {
  try {
    const res = await db.query('UPDATE projects SET env_vars = $1 WHERE id = 1 RETURNING env_vars', ['"TEST_STRING"']);
    console.log('success:', res.rows[0].env_vars, typeof res.rows[0].env_vars);
  } catch(e) { console.error('fail:', e.message); }
  process.exit(0);
}
test();
