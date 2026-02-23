const { PrismaClient } = require('./node_modules/@prisma/client');
async function run() {
  const p = new PrismaClient();
  const w = await p.project.findFirst({ where: { name: 'wra' }});
  console.log("Found key for WRA:", w.deploymentKey);
}
run().then(() => process.exit(0));
