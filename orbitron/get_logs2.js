const db = require('./db/db');
async function test() {
  try {
    const res = await db.query('SELECT status, logs FROM deployments WHERE project_id IN (SELECT id FROM projects WHERE subdomain=\'sodamfn\') ORDER BY id DESC LIMIT 1');
    console.log('Status:', res.rows[0].status);
    console.log('------------------');
    console.log(res.rows[0].logs);
  } catch(e) { console.error('fail:', e.message); }
  process.exit(0);
}
test();
