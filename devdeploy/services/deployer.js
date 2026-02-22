const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const db = require('../db/db');
const dockerService = require('./docker');
const nginxService = require('./nginx');
const tunnelService = require('./tunnel');
const mediaBackup = require('./mediaBackup');
const projectBackup = require('./projectBackup');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');

const DEPLOY_STEPS = [
    { id: 'clone', label: '📥 소스 코드 가져오기', progress: 15 },
    { id: 'build', label: '🔨 Docker 이미지 빌드', progress: 45 },
    { id: 'container', label: '🚀 컨테이너 시작', progress: 65 },
    { id: 'nginx', label: '🌐 프록시 설정', progress: 75 },
    { id: 'tunnel', label: '🔗 외부 접속 터널 생성', progress: 90 },
    { id: 'done', label: '✅ 배포 완료', progress: 100 },
];

class Deployer extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
        this.activeDeployments = new Set();
    }

    // Emit a deploy progress event
    emitProgress(projectId, stepId, message, status = 'running') {
        const step = DEPLOY_STEPS.find(s => s.id === stepId);
        this.emit('deploy-progress', {
            projectId,
            stepId,
            stepLabel: step?.label || stepId,
            progress: step?.progress || 0,
            message,
            status,  // 'running' | 'success' | 'failed'
            timestamp: new Date().toISOString(),
            steps: DEPLOY_STEPS,
        });
    }

    // Full deploy pipeline
    async deploy(project, commitHash = null, commitMessage = null) {
        if (this.activeDeployments.has(project.id)) {
            console.log(`⚠️ Deployment already in progress for ${project.name}`);
            return { success: false, error: 'Deployment already in progress' };
        }
        this.activeDeployments.add(project.id);

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

            // Step 1: Clone or pull (skip for upload projects)
            if (project.source_type === 'upload') {
                this.emitProgress(project.id, 'clone', '업로드된 소스 코드 사용 중...');
                logs += '\n--- Using uploaded source code ---\n';
                this.emitProgress(project.id, 'clone', '업로드된 소스 코드 준비 완료');
            } else {
                this.emitProgress(project.id, 'clone', '소스 코드를 가져오는 중...');
                logs += await this.cloneOrPull(project, projectDir, commitHash);
                logs += '\n--- Clone/Pull complete ---\n';
                this.emitProgress(project.id, 'clone', '소스 코드 가져오기 완료');
            }

            // Step 1.5: Auto media backup to DATA drive
            try {
                const backupResult = mediaBackup.backupMedia(project);
                logs += `\n📁 미디어 백업: ${backupResult.fileCount}개 파일 (${backupResult.totalSizeFormatted}) → ${backupResult.backupDir}\n`;
                if (backupResult.copiedCount > 0) {
                    logs += `   새로/변경된 파일 ${backupResult.copiedCount}개 복사, ${backupResult.skippedCount}개 스킵\n`;
                }
            } catch (e) {
                logs += `\n⚠️ 미디어 백업 건너뜀: ${e.message}\n`;
            }

            // Step 2: Build Docker image
            this.emitProgress(project.id, 'build', 'Docker 이미지 빌드 중...');
            logs += '\nBuilding Docker image...\n';
            const buildResult = await dockerService.buildImage(project);
            logs += buildResult.logs;
            logs += '\n--- Build complete ---\n';
            this.emitProgress(project.id, 'build', 'Docker 이미지 빌드 완료');

            // Step 3: Start container
            this.emitProgress(project.id, 'container', '컨테이너 시작 중...');
            logs += '\nStarting container...\n';
            const containerId = await dockerService.startContainer(project);
            logs += `Container started: ${containerId}\n`;
            this.emitProgress(project.id, 'container', '컨테이너 시작 완료');

            // Step 4: Update nginx config
            this.emitProgress(project.id, 'nginx', '프록시 설정 중...');
            logs += '\nUpdating nginx config...\n';
            nginxService.addProject(project);
            logs += 'nginx reloaded.\n';
            this.emitProgress(project.id, 'nginx', '프록시 설정 완료');

            // Step 5: Reuse existing tunnel or create new one
            const tunnelKey = project.subdomain || project.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            let tunnelUrl = tunnelService.getTunnelUrl(tunnelKey);
            if (tunnelUrl) {
                logs += `\n🌐 Reusing existing tunnel: ${tunnelUrl}\n`;
                this.emitProgress(project.id, 'tunnel', `기존 터널 유지: ${tunnelUrl}`);
            } else {
                this.emitProgress(project.id, 'tunnel', '외부 접속 터널 생성 중...');
                logs += '\nCreating tunnel for external access...\n';
                tunnelUrl = await tunnelService.startTunnel(project);
                if (tunnelUrl) {
                    logs += `🌐 Tunnel URL: ${tunnelUrl}\n`;
                    this.emitProgress(project.id, 'tunnel', `터널 생성 완료: ${tunnelUrl}`);
                } else {
                    logs += '⚠️ Tunnel creation skipped or failed\n';
                    this.emitProgress(project.id, 'tunnel', '터널 생성 건너뜀');
                }
            }

            // Step 6: Update DB
            await db.query(
                `UPDATE projects SET status = 'running', container_id = $1, tunnel_url = $2, updated_at = NOW() WHERE id = $3`,
                [containerId, tunnelUrl, project.id]
            );
            await db.query(
                `UPDATE deployments SET status = 'success', logs = $1, finished_at = NOW() WHERE id = $2`,
                [logs, deploymentId]
            );

            // Auto backup project to DATA drive
            try {
                const backupResult = projectBackup.backupProject(project);
                logs += `\n📦 프로젝트 백업: ${backupResult.copiedCount}개 파일 복사 (${backupResult.totalSizeFormatted}) → ${backupResult.backupDir}\n`;
            } catch (e) {
                logs += `\n⚠️ 프로젝트 백업 건너뜀: ${e.message}\n`;
            }

            logs += '\n✅ Deployment successful!\n';
            this.emitProgress(project.id, 'done', '배포가 성공적으로 완료되었습니다!', 'success');
            return { success: true, logs, deploymentId, tunnelUrl };

        } catch (error) {
            logs += `\n❌ Error: ${error.message}\n`;

            await db.query(`UPDATE projects SET status = 'failed' WHERE id = $1`, [project.id]);
            if (deploymentId) {
                await db.query(
                    `UPDATE deployments SET status = 'failed', logs = $1, finished_at = NOW() WHERE id = $2`,
                    [logs, deploymentId]
                );
            }

            this.emitProgress(project.id, 'done', `배포 실패: ${error.message}`, 'failed');
            return { success: false, logs, error: error.message };
        } finally {
            this.activeDeployments.delete(project.id);
            // Run Docker image prune in background to prevent disk space exhaustion
            dockerService.pruneImages().catch(() => { });
        }
    }

    // Clone or pull repo (with optional commitHash for rollback)
    async cloneOrPull(project, projectDir, commitHash = null) {
        if (fs.existsSync(path.join(projectDir, '.git'))) {
            const resetTarget = commitHash || `origin/${project.branch}`;
            try {
                const { stdout, stderr } = await execAsync(`cd ${projectDir} && git fetch origin && git reset --hard ${resetTarget}`, { maxBuffer: 1024 * 1024 * 50 });
                return `Git pull${commitHash ? ` (rollback to ${commitHash.substring(0, 7)})` : ''}:\n${stdout}${stderr}`;
            } catch (error) {
                throw new Error(`Git pull failed: ${error.stderr || error.message}`);
            }
        } else {
            // Clone
            fs.mkdirSync(projectDir, { recursive: true });
            try {
                const { stdout, stderr } = await execAsync(`git clone -b ${project.branch} ${project.github_url} ${projectDir}`, { maxBuffer: 1024 * 1024 * 50 });
                return `Git clone:\n${stdout}${stderr}`;
            } catch (error) {
                throw new Error(`Git clone failed: ${error.stderr || error.message}`);
            }
        }
    }

    // Stop a project
    async stop(project) {
        await dockerService.stopContainer(`orbitron-${project.subdomain}`);
        await nginxService.removeProject(project.subdomain);
        await tunnelService.deleteTunnel(project.subdomain);
        await db.query(`UPDATE projects SET status = 'stopped', container_id = NULL, tunnel_url = NULL WHERE id = $1`, [project.id]);
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
