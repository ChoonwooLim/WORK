/**
 * Cloudflare Pages Deployer Service
 * 
 * Automatically deploys static services defined in orbitron.yaml
 * to Cloudflare Pages using Wrangler CLI.
 */
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs');

class CfPagesDeployer {
    /**
     * List all existing Cloudflare Pages projects
     * @returns {Promise<string[]>} Array of project names
     */
    async listProjects() {
        try {
            const { stdout } = await execAsync(
                'npx -y wrangler pages project list 2>/dev/null',
                { timeout: 30000 }
            );
            // Parse the table output — project names are in the first column
            const lines = stdout.split('\n');
            const projects = [];
            let inTable = false;
            for (const line of lines) {
                if (line.includes('Project Name')) { inTable = true; continue; }
                if (!inTable) continue;
                if (line.startsWith('├') || line.startsWith('└') || line.startsWith('┌') || !line.trim()) continue;
                const match = line.match(/│\s*([^\s│]+)\s*│/);
                if (match) projects.push(match[1]);
            }
            return projects;
        } catch (e) {
            console.error('[CfPages] Failed to list projects:', e.message);
            return [];
        }
    }

    /**
     * Create a new Cloudflare Pages project
     * @param {string} projectName
     * @returns {Promise<boolean>} success
     */
    async createProject(projectName) {
        try {
            await execAsync(
                `npx -y wrangler pages project create ${projectName} --production-branch main 2>&1`,
                { timeout: 30000 }
            );
            console.log(`[CfPages] Created project: ${projectName}`);
            return true;
        } catch (e) {
            // Project may already exist — check for duplicate error
            if (e.message && e.message.includes('already exists')) {
                console.log(`[CfPages] Project already exists: ${projectName}`);
                return true;
            }
            console.error(`[CfPages] Failed to create project ${projectName}:`, e.message);
            return false;
        }
    }

    /**
     * Deploy a dist directory to Cloudflare Pages
     * @param {string} projectName
     * @param {string} distDir - Absolute path to the dist directory
     * @returns {Promise<{success: boolean, url: string|null, logs: string}>}
     */
    async deploy(projectName, distDir) {
        try {
            const { stdout, stderr } = await execAsync(
                `npx -y wrangler pages deploy ${distDir} --project-name ${projectName} --commit-dirty=true 2>&1`,
                { timeout: 120000 }
            );
            const output = stdout + stderr;
            // Extract deployment URL from output
            const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/);
            console.log(`[CfPages] Deployed ${projectName}: ${urlMatch ? urlMatch[0] : 'URL not found'}`);
            return {
                success: true,
                url: urlMatch ? urlMatch[0] : `https://${projectName}.pages.dev`,
                logs: output
            };
        } catch (e) {
            console.error(`[CfPages] Deploy failed for ${projectName}:`, e.message);
            return { success: false, url: null, logs: e.message };
        }
    }

    /**
     * Build and deploy a static service from orbitron.yaml
     * This is the main entry point called from deployer.js
     * 
     * @param {Object} service - Service definition from orbitron.yaml
     * @param {string} service.name - Service name (used as CF Pages project name)
     * @param {string} service.type - Service type (should be 'static')
     * @param {string} service.rootDir - Relative path to the service root
     * @param {Object} service.build - Build configuration
     * @param {string} service.publish - Publish directory (default: ./dist)
     * @param {string} serviceDir - Absolute path to the service directory
     * @returns {Promise<{success: boolean, url: string|null, logs: string}>}
     */
    async buildAndDeploy(service, serviceDir) {
        let logs = '';
        const projectName = service.name;
        const buildCmd = service.build?.command || 'npm install && npm run build';
        const publishDir = service.publish || './dist';
        const distDir = path.join(serviceDir, publishDir);

        logs += `\n  📄 Static 서비스 발견: ${projectName} (${service.rootDir})\n`;

        // Step 1: Check if Cloudflare Pages project exists, create if not
        const existingProjects = await this.listProjects();
        if (!existingProjects.includes(projectName)) {
            logs += `  📦 CF Pages 프로젝트 "${projectName}" 자동 생성 중...\n`;
            const created = await this.createProject(projectName);
            if (!created) {
                logs += `  ❌ CF Pages 프로젝트 생성 실패\n`;
                return { success: false, url: null, logs };
            }
            logs += `  ✅ CF Pages 프로젝트 생성 완료\n`;
        } else {
            logs += `  ✅ CF Pages 프로젝트 "${projectName}" 이미 존재\n`;
        }

        // Step 2: Build the static site
        logs += `  🔨 빌드 중: ${buildCmd}\n`;
        try {
            // Check if node_modules exists, skip npm install if so
            const hasNodeModules = fs.existsSync(path.join(serviceDir, 'node_modules'));
            const effectiveBuildCmd = hasNodeModules
                ? buildCmd.replace('npm install && ', '').replace('npm install &&', '')
                : buildCmd;

            const { stdout: buildOut, stderr: buildErr } = await execAsync(
                effectiveBuildCmd,
                { cwd: serviceDir, timeout: 120000, maxBuffer: 1024 * 1024 * 10 }
            );
            logs += `  ✅ 빌드 완료\n`;
        } catch (e) {
            // If build failed and we skipped install, retry with full command
            try {
                const { stdout: retryOut } = await execAsync(
                    buildCmd,
                    { cwd: serviceDir, timeout: 120000, maxBuffer: 1024 * 1024 * 10 }
                );
                logs += `  ✅ 빌드 완료 (재시도)\n`;
            } catch (e2) {
                logs += `  ❌ 빌드 실패: ${e2.message.split('\n')[0]}\n`;
                return { success: false, url: null, logs };
            }
        }

        // Step 3: Deploy to Cloudflare Pages
        if (!fs.existsSync(distDir)) {
            logs += `  ❌ 빌드 출력 디렉토리를 찾을 수 없습니다: ${publishDir}\n`;
            return { success: false, url: null, logs };
        }

        logs += `  🚀 CF Pages 배포 중...\n`;
        const deployResult = await this.deploy(projectName, distDir);
        if (deployResult.success) {
            logs += `  ✅ 배포 완료: ${deployResult.url}\n`;
        } else {
            logs += `  ❌ 배포 실패: ${deployResult.logs.split('\n')[0]}\n`;
        }

        return {
            success: deployResult.success,
            url: deployResult.url,
            logs
        };
    }
}

module.exports = new CfPagesDeployer();
