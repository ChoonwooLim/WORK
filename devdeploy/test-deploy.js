const db = require('./db/db');
const deployer = require('./services/deployer');

async function testDeploy() {
  const project = await db.queryOne('SELECT * FROM projects WHERE id = 2');
  console.log('Project loaded:', project.name);
  console.log('Env Vars:', project.env_vars);
  
  deployer.on('deploy-progress', (data) => console.log('Progress:', data.message));
  
  const result = await deployer.deploy(project);
  console.log('Deploy result:', result);
  process.exit(0);
}

testDeploy().catch(err => {
  console.error(err);
  process.exit(1);
});
