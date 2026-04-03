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
const aiAnalyzer = require('./aiAnalyzer');
const aiAutoRepair = require('./aiAutoRepair');
const cfPagesDeployer = require('./cfPagesDeployer');
const projectAnalyzer = require('./projectAnalyzer');
const notifier = require('./notifier');
const { encrypt, decrypt } = require('../db/crypto');
const yaml = require('js-yaml');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');

// Find orbitron.yaml regardless of case (Linux is case-sensitive)
function findOrbitronYaml(dir) {
    const candidates = ['orbitron.yaml', 'Orbitron.yaml', 'orbitron.yml', 'Orbitron.yml'];
    for (const name of candidates) {
        const fullPath = path.join(dir, name);
        if (fs.existsSync(fullPath)) return fullPath;
    }
    return null;
}

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
        this.latestProgress = new Map(); // Tracks the latest event per project for late-joining UI clients
    }

    // Emit a deploy progress event
    emitProgress(projectId, stepId, message, status = 'running') {
        const step = DEPLOY_STEPS.find(s => s.id === stepId);
        const eventPayload = {
            projectId,
            stepId,
            stepLabel: step?.label || stepId,
            progress: step?.progress || 0,
            message,
            status,  // 'running' | 'success' | 'failed'
            timestamp: new Date().toISOString(),
            steps: DEPLOY_STEPS,
        };
        // Cache the latest event so late SSE connections can instantly sync up
        this.latestProgress.set(projectId, eventPayload);
        this.emit('deploy-progress', eventPayload);
    }

    // Full deploy pipeline
    async deploy(project, commitHash = null, commitMessage = null) {
        if (this.activeDeployments.has(project.id)) {
            console.log(`⚠️ Deployment already in progress for ${project.name}`);
            return { success: false, error: 'Deployment already in progress' };
        }
        this.activeDeployments.add(project.id);

        const DEPLOY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`배포 타임아웃: ${DEPLOY_TIMEOUT_MS / 60000}분 초과`)), DEPLOY_TIMEOUT_MS)
        );

        return Promise.race([
            this._doDeploy(project, commitHash, commitMessage),
            timeoutPromise
        ]).catch(async (error) => {
            this.activeDeployments.delete(project.id);
            this.emitProgress(project.id, 'done', `배포 실패: ${error.message}`, 'failed');
            await db.query(`UPDATE projects SET status = 'failed' WHERE id = $1`, [project.id]);
            return { success: false, error: error.message };
        });
    }

    // Truncate log string to prevent unbounded DB growth
    _truncateLogs(logs, maxBytes = 512 * 1024) {
        if (Buffer.byteLength(logs, 'utf8') <= maxBytes) return logs;
        const truncated = Buffer.from(logs, 'utf8').subarray(0, maxBytes).toString('utf8');
        return truncated + '\n\n... [로그가 512KB를 초과하여 잘렸습니다] ...\n';
    }

    async _doDeploy(project, commitHash = null, commitMessage = null) {
        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        let deploymentId;
        let logs = '';
        const startTime = Date.now();

        // Helper: save logs to DB at intermediate points
        const saveLogs = async (status = 'building') => {
            if (!deploymentId) return;
            try {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const logWithTime = this._truncateLogs(logs + `\n⏱ 경과 시간: ${elapsed}초\n`);
                await db.query(
                    `UPDATE deployments SET logs = $1, status = $2 WHERE id = $3`,
                    [logWithTime, status, deploymentId]
                );
            } catch (e) { /* log save failure is non-critical */ }
        };

        try {
            // Create deployment record
            const deployment = await db.queryOne(
                `INSERT INTO deployments (project_id, commit_hash, commit_message, status)
         VALUES ($1, $2, $3, 'building') RETURNING id`,
                [project.id, commitHash, commitMessage]
            );
            deploymentId = deployment.id;
            logs += `📋 배포 시작: ${new Date().toLocaleString('ko-KR')}\n`;
            logs += `   프로젝트: ${project.name} (${project.subdomain})\n`;
            logs += `   커밋: ${commitHash || '최신'}\n`;
            logs += `   배포 ID: #${deploymentId}\n`;
            logs += '═'.repeat(50) + '\n';

            // Update project status
            await db.query(`UPDATE projects SET status = 'building' WHERE id = $1`, [project.id]);

            // Decrypt env_vars before further processing
            let envVars = {};
            if (project.env_vars && typeof project.env_vars === 'string') {
                try {
                    const decrypted = decrypt(project.env_vars);
                    envVars = decrypted ? JSON.parse(decrypted) : {};
                } catch (e) {
                    console.error(`Failed to decrypt env_vars for project ${project.id}`);
                }
            } else if (typeof project.env_vars === 'object' && project.env_vars !== null) {
                // Keep mostly for backward compatibility or if it's somehow already parsed
                envVars = project.env_vars;
            }
            project.env_vars = envVars; // Important: Update the project object so dockerService sees decrypted vars!

            let containerId = null;
            let containerName = null;
            let tunnelUrl = null;
            let isCompose = false;
            let isPixelStreaming = false;
            let isWorker = false;

            const isDatabase = project.type === 'db_postgres' || project.type === 'db_redis';

            if (isDatabase) {
                this.emitProgress(project.id, 'clone', '소스 코드 가져오기 건너뜀 (매니지드 DB)');
                this.emitProgress(project.id, 'build', 'Docker 이미지 빌드 건너뜀 (공식 DB 이미지 사용)');

                this.emitProgress(project.id, 'container', '데이터베이스 컨테이너 시작 중...');
                logs += '\nStarting Database container...\n';
                containerId = await dockerService.startDatabaseContainer(project);
                logs += `Database container started: ${containerId}\n`;
                this.emitProgress(project.id, 'container', '데이터베이스 컨테이너 시작 완료');

                this.emitProgress(project.id, 'nginx', '프록시 설정 건너뜀 (내부 네트워크 통신)');
                this.emitProgress(project.id, 'tunnel', '외부 접속 터널 생성 건너뜀 (프라이빗 네트워크)');
            } else {
                // Step 1: Clone or pull (skip for upload projects)
                if (project.source_type === 'upload') {
                    this.emitProgress(project.id, 'clone', '업로드된 소스 코드 사용 중...');
                    logs += '\n--- Using uploaded source code ---\n';
                    this.emitProgress(project.id, 'clone', '업로드된 소스 코드 준비 완료');
                } else {
                    this.emitProgress(project.id, 'clone', '소스 코드를 가져오는 중...');
                    logs += await this.cloneOrPull(project, projectDir, commitHash);
                    logs += '\n--- Clone/Pull complete ---\n';
                    // Add latest commit info for debugging
                    try {
                        const { stdout: commitInfo } = await execAsync(
                            `cd ${projectDir} && git log -1 --format='  커밋: %H%n  메시지: %s%n  작성자: %an%n  날짜: %ci%n  브랜치: '$(git branch --show-current)`,
                            { maxBuffer: 1024 * 1024 }
                        );
                        logs += `\n📋 현재 소스 코드 정보:\n${commitInfo}\n`;
                    } catch { }
                    this.emitProgress(project.id, 'clone', '소스 코드 가져오기 완료');
                    await saveLogs();
                }

                // ═══════════════════════════════════════════════════════════
                // Step 1.2: 🧠 Smart Project Analysis
                // Replaces legacy orbitron.yaml-only handling with full
                // project structure analysis. Works with or without yaml.
                // ═══════════════════════════════════════════════════════════
                this.emitProgress(project.id, 'clone', '🧠 프로젝트 구조 분석 중...');
                const manifest = projectAnalyzer.analyze(projectDir, project);
                logs += projectAnalyzer.formatManifestLog(manifest);

                // ── Apply overrides from manifest's web/backend service ──
                const mainWebService = manifest.services.find(s => s.type === 'web');
                if (mainWebService) {
                    // Handle fullstack type from orbitron.yaml (backward compat)
                    const yamlPath = findOrbitronYaml(projectDir);
                    if (yamlPath) {
                        try {
                            const parsedYaml = yaml.load(fs.readFileSync(yamlPath, 'utf8'));

                            // Legacy fullstack type support
                            if (parsedYaml && parsedYaml.type === 'fullstack' && parsedYaml.frontend && parsedYaml.backend) {
                                logs += '  📦 Fullstack configuration detected in orbitron.yaml\n';
                                project.env_vars = project.env_vars || {};
                                project.env_vars._ORBITRON_FULLSTACK = JSON.stringify({
                                    frontend: parsedYaml.frontend,
                                    backend: parsedYaml.backend,
                                    spa: parsedYaml.spa !== false
                                });
                                logs += `  - Frontend: ${parsedYaml.frontend.path} (build: ${parsedYaml.frontend.build || 'npm run build'})\n`;
                                logs += `  - Backend: ${parsedYaml.backend.path} (runtime: ${parsedYaml.backend.runtime || 'auto'})\n`;
                                if (parsedYaml.backend.port) {
                                    project.port = parsedYaml.backend.port;
                                }
                            }

                            // Legacy services.web override support
                            if (parsedYaml && parsedYaml.services && parsedYaml.services.web) {
                                const webService = parsedYaml.services.web;
                                let updates = [];
                                let params = [];
                                let valIndex = 1;

                                if (webService.build_command !== undefined) {
                                    project.build_command = webService.build_command;
                                    updates.push(`build_command = $${valIndex++}`);
                                    params.push(project.build_command);
                                    logs += `  - Override build_command: ${project.build_command}\n`;
                                }
                                if (webService.start_command !== undefined) {
                                    project.start_command = webService.start_command;
                                    updates.push(`start_command = $${valIndex++}`);
                                    params.push(project.start_command);
                                    logs += `  - Override start_command: ${project.start_command}\n`;
                                }
                                if (webService.port !== undefined) {
                                    project.port = webService.port;
                                    updates.push(`port = $${valIndex++}`);
                                    params.push(project.port);
                                    logs += `  - Override port: ${project.port}\n`;
                                }
                                if (webService.env) {
                                    const newEnv = { ...project.env_vars };
                                    webService.env.forEach(envStr => {
                                        const splitIdx = envStr.indexOf('=');
                                        if (splitIdx > 0) {
                                            const k = envStr.substring(0, splitIdx).trim();
                                            const v = envStr.substring(splitIdx + 1).trim();
                                            newEnv[k] = v;
                                        }
                                    });
                                    project.env_vars = newEnv;
                                    const encryptedEnvVars = '"' + encrypt(JSON.stringify(newEnv || {})) + '"';
                                    updates.push(`env_vars = $${valIndex++}`);
                                    params.push(encryptedEnvVars);
                                    logs += `  - Override env_vars: ${Object.keys(newEnv).length} keys securely applied\n`;
                                }

                                if (updates.length > 0) {
                                    params.push(project.id);
                                    await db.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${valIndex}`, params);
                                    logs += '  > Synced overrides to Dashboard Database.\n';
                                }
                            }
                        } catch (e) {
                            logs += `\n⚠️ Legacy orbitron.yaml processing error: ${e.message}\n`;
                        }
                    }

                    // Apply main web service port from manifest (if not already set)
                    if (!project.port && mainWebService.port) {
                        project.port = mainWebService.port;
                        logs += `  - Auto-detected port: ${project.port}\n`;
                    }
                }

                // ── Multi-Service: Deploy all static/sub-services ──
                const staticServices = manifest.services.filter(s => s.deployTarget === 'cf-pages');
                if (staticServices.length > 0) {
                    logs += `\n📄 Static 서비스 ${staticServices.length}개 감지 — Cloudflare Pages 자동 배포 시작\n`;
                    this.emitProgress(project.id, 'clone', `Static 서비스 ${staticServices.length}개 CF Pages 배포 중...`);

                    for (const svc of staticServices) {
                        const svcDir = path.join(projectDir, svc.rootDir);
                        if (!fs.existsSync(svcDir)) {
                            logs += `  ⚠️ 서비스 디렉토리 없음: ${svc.rootDir} — 건너김\n`;
                            continue;
                        }
                        try {
                            const result = await cfPagesDeployer.buildAndDeploy(svc, svcDir);
                            logs += result.logs;
                        } catch (cfErr) {
                            logs += `  ⚠️ CF Pages 배포 실패 (${svc.name}): ${cfErr.message}\n`;
                        }
                    }
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

                // ── Feature 4: Monorepo detection ──
                const monorepoFiles = ['turbo.json', 'nx.json', 'pnpm-workspace.yaml', 'lerna.json'];
                for (const mf of monorepoFiles) {
                    if (fs.existsSync(path.join(projectDir, mf))) {
                        logs += `\n📦 Monorepo 감지 (${mf}): 워크스페이스 빌드가 자동 적용됩니다.\n`;
                        break;
                    }
                }

                // ── Feature 6: Environment variable validation ──
                const envVars = project.env_vars || {};
                const reqFiles = {
                    'requirements.txt': ['DATABASE_URL'],
                    'package.json': ['DATABASE_URL'],
                    'prisma': ['DATABASE_URL'],
                };
                const warnings = [];
                for (const [marker, requiredVars] of Object.entries(reqFiles)) {
                    const markerPaths = [
                        path.join(projectDir, marker),
                        ...fs.readdirSync(projectDir, { withFileTypes: true })
                            .filter(d => d.isDirectory() && !d.name.startsWith('.'))
                            .flatMap(d => [path.join(projectDir, d.name, marker)])
                    ];
                    for (const mp of markerPaths) {
                        try {
                            if (fs.existsSync(mp)) {
                                const content = fs.statSync(mp).isDirectory() ? '' : fs.readFileSync(mp, 'utf-8');
                                if (marker === 'prisma' || content.includes('psycopg') || content.includes('asyncpg') || content.includes('prisma') || content.includes('sequelize') || content.includes('typeorm')) {
                                    for (const rv of requiredVars) {
                                        if (!envVars[rv]) {
                                            warnings.push(rv);
                                        }
                                    }
                                }
                            }
                        } catch { }
                    }
                }
                if (warnings.length > 0) {
                    const uniqueWarnings = [...new Set(warnings)];
                    logs += `\n⚠️ 환경변수 경고: ${uniqueWarnings.join(', ')} 미설정 — DB 연결에 필요할 수 있습니다.\n`;
                }

                // ── Feature 8: Save previous image for rollback ──
                let previousImageId = null;
                try {
                    const { stdout } = await execAsync(`docker images -q orbitron-${project.subdomain} 2>/dev/null`);
                    previousImageId = stdout.trim() || null;
                } catch { }

                // Step 2: Build Docker image (or Compose service)
                this.emitProgress(project.id, 'build', 'Docker 이미지(또는 Compose) 빌드 중...');
                logs += '\nBuilding Docker image (or pulling Compose)....\n';
                try {
                    const buildResult = await dockerService.buildImage(project);
                    logs += buildResult.logs;
                    if (buildResult.isCompose) {
                        isCompose = true;
                    }
                    logs += '\n--- Build complete ---\n';
                    this.emitProgress(project.id, 'build', 'Docker 빌드 완료');
                    await saveLogs();
                } catch (buildError) {
                    // ── Feature 8: Rollback to previous image on build failure ──
                    if (previousImageId) {
                        logs += `\n🔄 빌드 실패 — 이전 이미지(${previousImageId.substring(0, 12)})로 롤백 시도...\n`;
                        try {
                            await execAsync(`docker tag ${previousImageId} orbitron-${project.subdomain}`);
                            logs += `✅ 롤백 성공: 이전 이미지로 컨테이너를 시작합니다.\n`;
                        } catch (rollbackErr) {
                            logs += `❌ 롤백 실패: ${rollbackErr.message}\n`;
                            throw buildError;
                        }
                    } else {
                        throw buildError;
                    }
                }

                isPixelStreaming = project.env_vars && project.env_vars.PROJECT_TYPE === 'pixel_streaming';
                isWorker = project.type === 'worker';

                if (isPixelStreaming) {
                    // For Pixel Streaming, the Matchmaker handles dynamic containers and ports.
                    this.emitProgress(project.id, 'container', '매치메이커 시스템에 등록 준비 중...');
                    logs += '\nSkipping explicit container start, nginx, and tunnels (Pixel Streaming Project).\n';
                    this.emitProgress(project.id, 'container', '독립 실행형 컨테이너 생성을 건너뜀 (매치메이커가 관리)');
                    this.emitProgress(project.id, 'nginx', '프록시 설정 건너뜀 (매치메이커가 통신 관리)');
                    this.emitProgress(project.id, 'tunnel', '외부 접속 터널 지정됨 (매치메이커 게임 게이트웨이)');
                    // No containerId, No tunnelUrl -> Matchmaker handles web routing!
                } else if (isWorker) {
                    // Worker containers run natively, attached to network but no ports exposed
                    this.emitProgress(project.id, 'container', '백그라운드 워커 시작 중...');
                    logs += '\nStarting Background Worker container...\n';
                    const startRes = await dockerService.startContainer(project);
                    containerId = startRes.containerId;
                    containerName = startRes.containerName;
                    logs += `Container started: ${containerId} (${containerName})\n`;
                    this.emitProgress(project.id, 'container', '백그라운드 워커 시작 완료');

                    // Skip the public Nginx configs and Tunnels entirely
                    this.emitProgress(project.id, 'nginx', '프록시 설정 건너뜀 (백그라운드 워커)');
                    this.emitProgress(project.id, 'tunnel', '외부 접속 터널 생성 건너뜀 (백그라운드 워커)');
                } else {
                    // Step 3: Stop old containers to free up port before starting a new one
                    this.emitProgress(project.id, 'container', '이전 컨테이너 정리 중...');
                    logs += '\nCleaning up old containers...\n';
                    try {
                        // Stop all existing containers for this project (Blue-Green cleanup)
                        if (project.container_id && !project.container_id.startsWith('compose-')) {
                            await dockerService.stopContainer(project.container_id).catch(() => { });
                        }
                        await dockerService.cleanupOldContainers(project.subdomain, '__none__');
                        // Also try the legacy name just in case
                        await dockerService.stopContainer(`orbitron-${project.subdomain}`).catch(() => { });
                        logs += 'Old containers cleaned up.\n';
                    } catch (e) {
                        logs += `Warning: cleanup error: ${e.message}\n`;
                    }

                    // Start container (or Compose stack)
                    this.emitProgress(project.id, 'container', '컨테이너 시작 중...');
                    logs += '\nStarting container...\n';

                    let startRes;
                    if (isCompose) {
                        logs += 'Using docker compose up...\n';
                        startRes = await dockerService.startCompose(project);
                        if (startRes.logs) logs += startRes.logs + '\n';
                    } else {
                        startRes = await dockerService.startContainer(project);
                        if (startRes.startLogs) logs += startRes.startLogs;
                    }

                    containerId = startRes.containerId;
                    containerName = startRes.containerName;
                    logs += `Container started: ${containerId} (${containerName})\n`;
                    this.emitProgress(project.id, 'container', '컨테이너 시작 완료');

                    // Step 4: Update nginx config (Blue-Green Swap)
                    this.emitProgress(project.id, 'nginx', '프록시 설정(Blue-Green Swap) 중...');
                    logs += '\nUpdating nginx config for new container target...\n';
                    await nginxService.addProject(project, containerName);
                    logs += 'nginx reloaded to point to new container.\n';
                    this.emitProgress(project.id, 'nginx', '프록시 설정 완료');

                    // Step 5: Reuse existing tunnel or create new one
                    const tunnelKey = project.subdomain || project.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    tunnelUrl = tunnelService.getTunnelUrl(tunnelKey);
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
                }
            }

            // Step 6: Update DB
            await db.query(
                `UPDATE projects SET status = 'running', container_id = $1, tunnel_url = $2, updated_at = NOW() WHERE id = $3`,
                [isCompose ? containerId : containerName, tunnelUrl, project.id]
            );
            await saveLogs();

            // ── Feature 5: Auto DB migration ──
            if (containerId && containerName) {
                try {
                    // Detect and run Prisma migrations
                    const { stdout: hasPrisma } = await execAsync(`docker exec ${containerName} test -d /app/prisma 2>/dev/null && echo yes || true`);
                    if (hasPrisma.trim() === 'yes') {
                        logs += '\n🗄 Prisma DB 마이그레이션 실행 중...\n';
                        try {
                            const { stdout: migrateOut } = await execAsync(`docker exec ${containerName} npx prisma db push --skip-generate 2>&1`, { timeout: 30000 });
                            logs += `  ✅ Prisma: ${migrateOut.trim().split('\n').pop()}\n`;
                        } catch (e) {
                            logs += `  ⚠️ Prisma 마이그레이션 건너뜀: ${e.message.split('\n')[0]}\n`;
                        }
                    }

                    // Detect and run Alembic migrations
                    const { stdout: hasAlembic } = await execAsync(`docker exec ${containerName} test -d /app/alembic 2>/dev/null && echo yes || true`);
                    if (hasAlembic.trim() === 'yes') {
                        logs += '\n🗄 Alembic DB 마이그레이션 실행 중...\n';
                        try {
                            const { stdout: migrateOut } = await execAsync(`docker exec ${containerName} alembic upgrade head 2>&1`, { timeout: 30000 });
                            logs += `  ✅ Alembic: ${migrateOut.trim().split('\n').pop()}\n`;
                        } catch (e) {
                            logs += `  ⚠️ Alembic 마이그레이션 건너뜀: ${e.message.split('\n')[0]}\n`;
                        }
                    }

                    // Detect and run Django migrations
                    const { stdout: hasDjango } = await execAsync(`docker exec ${containerName} test -f /app/manage.py 2>/dev/null && echo yes || true`);
                    if (hasDjango.trim() === 'yes') {
                        logs += '\n🗄 Django DB 마이그레이션 실행 중...\n';
                        try {
                            const { stdout: migrateOut } = await execAsync(`docker exec ${containerName} python manage.py migrate --noinput 2>&1`, { timeout: 30000 });
                            logs += `  ✅ Django: 마이그레이션 완료\n`;
                        } catch (e) {
                            logs += `  ⚠️ Django 마이그레이션 건너뜀: ${e.message.split('\n')[0]}\n`;
                        }
                    }
                } catch { }
            }

            // ── Feature 7: Health check ──
            if (containerId && tunnelUrl) {
                logs += '\n🏥 Health check 실행 중...\n';
                let healthy = false;
                for (let i = 0; i < 6; i++) {
                    await new Promise(r => setTimeout(r, 5000)); // 5초 대기
                    try {
                        const port = project.port || 3000;
                        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${port}/ 2>/dev/null || echo 000`);
                        const code = parseInt(stdout.trim());
                        if (code >= 200 && code < 500) {
                            logs += `  ✅ Health check 통과 (HTTP ${code}, ${(i + 1) * 5}초 경과)\n`;
                            healthy = true;
                            break;
                        }
                    } catch { }
                }
                if (!healthy) {
                    logs += `  ⚠️ Health check 시간 초과 (30초) — 앱이 시작 중일 수 있습니다.\n`;
                }
            }

            // ── Feature 9: SSL status ──
            if (tunnelUrl && tunnelUrl.startsWith('https://')) {
                logs += `\n🔒 SSL: Cloudflare Edge 터널을 통한 자동 HTTPS 적용 완료\n`;
            }

            // Auto backup project to DATA drive
            try {
                const backupResult = projectBackup.backupProject(project);
                logs += `\n📦 프로젝트 백업: ${backupResult.copiedCount}개 파일 복사 (${backupResult.totalSizeFormatted}) → ${backupResult.backupDir}\n`;
            } catch (e) {
                logs += `\n⚠️ 프로젝트 백업 건너뜀: ${e.message}\n`;
            }

            // ── PostDeploy Hooks: run custom post-deployment commands ──
            const yamlPathForHooks = findOrbitronYaml(projectDir);
            if (yamlPathForHooks) {
                try {
                    const hookYaml = yaml.load(fs.readFileSync(yamlPathForHooks, 'utf8'));
                    if (hookYaml.postDeploy && Array.isArray(hookYaml.postDeploy)) {
                        logs += `\n🪝 PostDeploy 훅 ${hookYaml.postDeploy.length}개 실행 시작 (${path.basename(yamlPathForHooks)})\n`;
                        this.emitProgress(project.id, 'tunnel', `PostDeploy 훅 ${hookYaml.postDeploy.length}개 실행 중...`);

                        for (const hook of hookYaml.postDeploy) {
                            const hookName = hook.name || 'unnamed-hook';
                            const hookCmd = hook.command;
                            if (!hookCmd) {
                                logs += `  ⚠️ 훅 "${hookName}": 명령어 없음 — 건너뜀\n`;
                                continue;
                            }

                            logs += `\n  🔧 훅 실행: "${hookName}"\n`;

                            // Build env vars for this hook
                            const hookEnv = { ...process.env };
                            if (hook.env && Array.isArray(hook.env)) {
                                for (const envItem of hook.env) {
                                    if (envItem.key && envItem.value) {
                                        hookEnv[envItem.key] = envItem.value;
                                    }
                                }
                            }

                            try {
                                logs += `     📂 작업 디렉토리: ${projectDir}\n`;
                                logs += `     🔧 명령어:\n${hookCmd.split('\n').map(l => '        ' + l).join('\n')}\n`;
                                logs += `     ⏳ 실행 중...\n`;
                                await saveLogs();

                                const { stdout: hookOut, stderr: hookErr } = await execAsync(
                                    hookCmd,
                                    {
                                        cwd: projectDir,
                                        timeout: 300000, // 5분 타임아웃 (npm install + build + wrangler deploy)
                                        maxBuffer: 1024 * 1024 * 10,
                                        env: hookEnv,
                                        shell: '/bin/bash'
                                    }
                                );
                                // Show FULL output for transparency
                                if (hookOut && hookOut.trim()) {
                                    logs += `\n     ── stdout ──\n`;
                                    logs += hookOut.trim().split('\n').map(l => '     ' + l).join('\n') + '\n';
                                }
                                if (hookErr && hookErr.trim()) {
                                    logs += `\n     ── stderr ──\n`;
                                    logs += hookErr.trim().split('\n').map(l => '     ' + l).join('\n') + '\n';
                                }
                                logs += `  ✅ 훅 "${hookName}" 완료\n`;
                                await saveLogs();
                            } catch (hookErr) {
                                // Show last 20 lines of error for debugging
                                const errLines = (hookErr.stderr || hookErr.stdout || hookErr.message || '').trim().split('\n');
                                const errDetail = errLines.slice(-20).join('\n');
                                logs += `\n  ❌ 훅 "${hookName}" 실패:\n`;
                                logs += errDetail.split('\n').map(l => '     ' + l).join('\n') + '\n';
                                await saveLogs();
                            }
                        }
                    }
                } catch (e) {
                    logs += `\n⚠️ PostDeploy 훅 파싱 실패: ${e.message}\n`;
                }
            }

            logs += '\n═'.repeat(50) + '\n';
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            logs += `✅ 배포 성공! (총 소요 시간: ${elapsed}초)\n`;
            logs += `   완료 시간: ${new Date().toLocaleString('ko-KR')}\n`;

            // Final log save with 'success' status
            await db.query(
                `UPDATE deployments SET status = 'success', logs = $1, finished_at = NOW() WHERE id = $2`,
                [this._truncateLogs(logs), deploymentId]
            );

            // Clean up old Blue-Green containers AFTER successful routing
            if (containerName && !isWorker) {
                logs += '\n🧹 이전 버전 컨테이너 정리 중...\n';
                await dockerService.cleanupOldContainers(project.subdomain, containerName);
                logs += '  ✅ 이전 컨테이너 정리 완료\n';
            }

            this.emitProgress(project.id, 'done', '배포가 성공적으로 완료되었습니다!', 'success');

            if (project.webhook_url) {
                notifier.sendNotification(project.webhook_url, {
                    title: '🚀 배포 성공',
                    message: `프로젝트가 성공적으로 배포되었습니다. (소요 시간: ${elapsed}초)`,
                    project: project.name,
                    url: tunnelUrl || project.custom_domain,
                    status: 'success'
                });
            }

            return { success: true, logs, deploymentId, tunnelUrl };

        } catch (error) {
            logs += `\n❌ Error: ${error.message}\n`;

            // ── AI Auto-Repair Pipeline ──
            const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
            const isAutoRepairRetry = project._autoRepairAttempted;

            if (!isAutoRepairRetry && fs.existsSync(projectDir)) {
                this.emitProgress(project.id, 'done', '🤖 AI 자동 복구 시도 중...', 'running');
                logs += '\n🤖 [AI Auto-Repair] 자동 복구를 시도합니다...\n';

                try {
                    // Step 1: AI generates patches
                    const patchResult = await aiAutoRepair.analyzeAndGeneratePatch(
                        logs, projectDir, project.ai_model, project.env_vars || {}
                    );

                    if (patchResult && patchResult.canFix && patchResult.patches.length > 0) {
                        logs += `\n  📋 AI 분석: ${patchResult.summary}\n`;
                        logs += `  📝 ${patchResult.patches.length}개 패치 생성됨\n`;

                        // Step 2: Apply patches
                        const applyResult = aiAutoRepair.applyPatches(projectDir, patchResult.patches);
                        logs += `\n  패치 적용 결과: ${applyResult.applied}개 성공, ${applyResult.failed}개 실패\n`;
                        logs += applyResult.details;

                        if (applyResult.applied > 0) {
                            // Step 3: Retry build & deploy
                            logs += '\n  🔄 수정된 코드로 재빌드 시도...\n';
                            this.emitProgress(project.id, 'done', '🔄 AI 수정 코드로 재빌드 중...', 'running');

                            try {
                                // Mark as retry to prevent infinite loop
                                project._autoRepairAttempted = true;

                                const retryResult = await this.deploy(project);

                                if (retryResult.success) {
                                    logs += '\n  ✅ AI 자동 복구 성공! 수정된 코드로 배포 완료.\n';

                                    // Step 4: Create GitHub PR
                                    this.emitProgress(project.id, 'done', '📤 GitHub PR 생성 중...', 'running');
                                    const prResult = await aiAutoRepair.createGitHubPR(
                                        project, projectDir, patchResult.patches, patchResult.summary
                                    );

                                    if (prResult.success) {
                                        logs += `\n  📤 ${prResult.message}\n`;
                                        if (prResult.prUrl) {
                                            logs += `  🔗 PR: ${prResult.prUrl}\n`;
                                        }
                                        if (prResult.branch) {
                                            logs += `  🌿 브랜치: ${prResult.branch}\n`;
                                        }
                                    } else {
                                        logs += `\n  ⚠️ PR 생성 건너뜀: ${prResult.message}\n`;
                                    }

                                    // Save auto-repair info in deployment logs
                                    const autoRepairInfo = {
                                        summary: patchResult.summary,
                                        patches: patchResult.patches,
                                        prUrl: prResult.prUrl || null,
                                        branch: prResult.branch || null,
                                    };

                                    await db.query(
                                        `UPDATE deployments SET logs = $1, status = 'success' WHERE id = $2`,
                                        [this._truncateLogs(retryResult.logs + '\n\n🤖 [AI_AUTO_REPAIR_DATA]\n' + JSON.stringify(autoRepairInfo)), deploymentId]
                                    );

                                    this.emitProgress(project.id, 'done', '🤖 AI 자동 복구 성공! 배포 완료.', 'success');

                                    if (project.webhook_url) {
                                        notifier.sendNotification(project.webhook_url, {
                                            title: '🤖 AI 자동 복구 성공',
                                            message: `AI가 에러를 분석하고 코드를 수정하여 재배포에 성공했습니다.\n\n**내용:** ${patchResult.summary}`,
                                            project: project.name,
                                            url: prResult.prUrl || '',
                                            status: 'success'
                                        });
                                    }

                                    // Save to Error Knowledge DB for future reference
                                    try {
                                        const errorKnowledge = require('./errorKnowledge');
                                        await errorKnowledge.saveKnowledge({
                                            errorMessage: logs.substring(0, 5000),
                                            rootCause: patchResult.summary,
                                            solution: patchResult.patches.map(p => `${p.file}: ${p.explanation}`).join('\n'),
                                            patches: patchResult.patches,
                                            projectType: project.type || 'web',
                                            source: 'auto_repair',
                                            projectId: project.id
                                        });
                                    } catch (knowledgeErr) {
                                        console.error('[Deployer] Knowledge save failed:', knowledgeErr.message);
                                    }

                                    return retryResult;
                                } else {
                                    logs += '\n  ❌ AI 수정 후에도 빌드 실패 — 원본 복구 중...\n';
                                    await aiAutoRepair.revertPatches(projectDir, project.branch || 'main');
                                }
                            } catch (retryError) {
                                logs += `\n  ❌ 재빌드 에러: ${retryError.message}\n`;
                                await aiAutoRepair.revertPatches(projectDir, project.branch || 'main');
                            }
                        }
                    } else if (patchResult) {
                        logs += `\n  ℹ️ AI 판단: ${patchResult.summary || '자동 수정 불가한 에러'}\n`;
                    }
                } catch (repairError) {
                    logs += `\n  ⚠️ AI 자동 복구 중 오류: ${repairError.message}\n`;
                }
            }

            // Fallback: normal AI error analysis
            this.emitProgress(project.id, 'done', '오류 원인 분석 중...', 'running');
            const aiAnalysis = await aiAnalyzer.analyzeError(logs, project.ai_model, project.env_vars || {});
            if (aiAnalysis) {
                logs += `\n\n🤖 [AI Error Analysis]\n${aiAnalysis}\n`;
            }

            await db.query(`UPDATE projects SET status = 'failed' WHERE id = $1`, [project.id]);
            if (deploymentId) {
                await db.query(
                    `UPDATE deployments SET status = 'failed', logs = $1, finished_at = NOW() WHERE id = $2`,
                    [this._truncateLogs(logs), deploymentId]
                );
            }

            this.emitProgress(project.id, 'done', `배포 실패: ${error.message}`, 'failed');

            if (project.webhook_url) {
                notifier.sendNotification(project.webhook_url, {
                    title: '❌ 배포 실패',
                    message: `프로젝트 배포 과정 중 오류가 발생했습니다.\n\n\`\`\`\n${error.message}\n\`\`\``,
                    project: project.name,
                    status: 'error'
                });
            }

            return { success: false, logs, error: error.message };
        } finally {
            this.activeDeployments.delete(project.id);
            // Keep the final 'success' or 'failed' event in cache for 60 seconds so late clients see it
            setTimeout(() => {
                if (!this.activeDeployments.has(project.id)) {
                    this.latestProgress.delete(project.id);
                }
            }, 60000);
            // Run Docker image prune in background to prevent disk space exhaustion
            dockerService.pruneImages().catch(() => { });
        }
    }

    // Clone or pull repo (with optional commitHash for rollback)
    async cloneOrPull(project, projectDir, commitHash = null) {
        if (fs.existsSync(path.join(projectDir, '.git'))) {
            const resetTarget = commitHash || `origin/${project.branch}`;
            try {
                const { stdout, stderr } = await execAsync(`cd ${projectDir} && git fetch origin && git reset --hard ${resetTarget}`, { maxBuffer: 1024 * 1024 * 10 });
                return `Git pull${commitHash ? ` (rollback to ${commitHash.substring(0, 7)})` : ''}:\n${stdout}${stderr}`;
            } catch (error) {
                throw new Error(`Git pull failed: ${error.stderr || error.message}`);
            }
        } else {
            // Clone
            fs.mkdirSync(projectDir, { recursive: true });
            try {
                const { stdout, stderr } = await execAsync(`git clone -b ${project.branch} ${project.github_url} ${projectDir}`, { maxBuffer: 1024 * 1024 * 10 });
                return `Git clone:\n${stdout}${stderr}`;
            } catch (error) {
                throw new Error(`Git clone failed: ${error.stderr || error.message}`);
            }
        }
    }

    // Stop a project
    async stop(project) {
        const isPixelStreaming = project.env_vars && project.env_vars.PROJECT_TYPE === 'pixel_streaming';
        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);

        if (!isPixelStreaming) {
            // Check if this is a Docker Compose project
            const isCompose = project.container_id && project.container_id.startsWith('compose-');
            if (isCompose) {
                try {
                    await execAsync(`cd ${projectDir} && docker compose down`);
                } catch (e) { }
            }

            // Stop the known container (Blue-Green name from DB)
            if (project.container_id && !project.container_id.startsWith('compose-')) {
                await dockerService.stopContainer(project.container_id);
            }

            // Also clean up any leftover hash-suffixed containers
            await dockerService.cleanupOldContainers(project.subdomain, '__none__');

            // Legacy: also try the old-style name just in case
            await dockerService.stopContainer(`orbitron-${project.subdomain}`);

            await nginxService.removeProject(project.subdomain);
            await tunnelService.deleteTunnel(project.subdomain);
        }
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
