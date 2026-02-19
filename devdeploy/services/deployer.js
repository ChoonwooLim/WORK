const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const dockerService = require('./docker');
const nginxService = require('./nginx');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');

class Deployer {
    // Full deploy pipeline
    async deploy(project, commitHash = null, commitMessage = null) {
        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        let deploymentId;
        let logs = '';

        try {
            // Create deployment record
            const deployment = await db.queryOne(
                `INSERT INTO deployments (project_id, commit_hash, commit_message, status)
         VALUES ($1, $2, $3, 'building') RETURNING id`,
                [project.id, commitHash, commitMessage]
            );
            deploymentId = deployment.id;

            // Update project status
            await db.query(`UPDATE projects SET status = 'building' WHERE id = $1`, [project.id]);

            // Step 1: Clone or pull
            logs += await this.cloneOrPull(project, projectDir);
            logs += '\n--- Clone/Pull complete ---\n';

            // Step 2: Build Docker image
            logs += '\nBuilding Docker image...\n';
            const buildResult = await dockerService.buildImage(project);
            logs += buildResult.logs;
            logs += '\n--- Build complete ---\n';

            // Step 3: Start container
            logs += '\nStarting container...\n';
            const containerId = await dockerService.startContainer(project);
            logs += `Container started: ${containerId}\n`;

            // Step 4: Update nginx config
            logs += '\nUpdating nginx config...\n';
            nginxService.addProject(project);
            logs += 'nginx reloaded.\n';

            // Step 5: Update DB
            await db.query(
                `UPDATE projects SET status = 'running', container_id = $1, updated_at = NOW() WHERE id = $2`,
                [containerId, project.id]
            );
            await db.query(
                `UPDATE deployments SET status = 'success', logs = $1, finished_at = NOW() WHERE id = $2`,
                [logs, deploymentId]
            );

            logs += '\n✅ Deployment successful!\n';
            return { success: true, logs, deploymentId };

        } catch (error) {
            logs += `\n❌ Error: ${error.message}\n`;

            await db.query(`UPDATE projects SET status = 'failed' WHERE id = $1`, [project.id]);
            if (deploymentId) {
                await db.query(
                    `UPDATE deployments SET status = 'failed', logs = $1, finished_at = NOW() WHERE id = $2`,
                    [logs, deploymentId]
                );
            }

            return { success: false, logs, error: error.message };
        }
    }

    // Clone or pull repo
    async cloneOrPull(project, projectDir) {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(path.join(projectDir, '.git'))) {
                // Pull latest
                exec(`cd ${projectDir} && git fetch origin && git reset --hard origin/${project.branch}`, (error, stdout, stderr) => {
                    if (error) reject(new Error(`Git pull failed: ${stderr}`));
                    else resolve(`Git pull:\n${stdout}${stderr}`);
                });
            } else {
                // Clone
                fs.mkdirSync(projectDir, { recursive: true });
                exec(`git clone -b ${project.branch} ${project.github_url} ${projectDir}`, (error, stdout, stderr) => {
                    if (error) reject(new Error(`Git clone failed: ${stderr}`));
                    else resolve(`Git clone:\n${stdout}${stderr}`);
                });
            }
        });
    }

    // Stop a project
    async stop(project) {
        await dockerService.stopContainer(`devdeploy-${project.subdomain}`);
        nginxService.removeProject(project.subdomain);
        await db.query(`UPDATE projects SET status = 'stopped', container_id = NULL WHERE id = $1`, [project.id]);
    }

    // Delete a project completely
    async deleteProject(project) {
        await this.stop(project);
        await dockerService.removeImage(project.subdomain);

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
    }
}

module.exports = new Deployer();
