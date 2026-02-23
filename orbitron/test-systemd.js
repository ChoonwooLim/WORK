require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { deployProject } = require('./services/docker.js');

async function trigger() {
  const prisma = new PrismaClient();
  const proj = await prisma.project.findFirst({ where: { name: 'wra' }});
  if (proj) {
    console.log("Forcing build...");
    await deployProject(proj, null, true);
    console.log("Triggered.");
  }
}
trigger().catch(console.error).finally(() => process.exit(0));
