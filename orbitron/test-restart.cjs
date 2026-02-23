const { PrismaClient } = require('@prisma/client');
const { deployProject } = require('./services/docker.js');

async function test() {
  const prisma = new PrismaClient();
  const proj = await prisma.project.findFirst({ where: { name: 'wra' }});
  if (proj) {
    console.log("Triggering rebuild for", proj.name);
    await deployProject(proj, null, true);
    console.log("Rebuild request successful.");
  }
  process.exit(0);
}
test();
