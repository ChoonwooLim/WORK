const { exec, execFile } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const db = require('../db/db');
const dockerService = require('./docker');
const buildQueue = require('./buildQueue');
const nginxService = require('./nginx');
const tunnelService = require('./tunnel');
const mediaBackup = require('./mediaBackup');
const projectBackup = require('./projectBackup');
const aiAnalyzer = require('./aiAnalyzer');
const aiAutoRepair = require('./aiAutoRepair');
const cfPagesDeployer = require('./cfPagesDeployer');
const projectAnalyzer = require('./projectAnalyzer');
const notifier = require('./notifier');
const { managedDatabaseUrl } = require('./envUtils');
const { decrypt, encryptForJsonb } = require('../db/crypto');
const { assessRollbackEligibility, formatRollbackCommitMessage, buildKeepTagList } = require('./rollbackRules');
const { smokeStep, resolveHealthPath, SMOKE_DEFAULTS } = require('./smokeCheck');
const previewRules = require('./previewRules');
const yaml = require('js-yaml');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');
// PR 프리뷰 클론 전용 디렉토리 (Task 3.1) — 일반 배포 트리와 물리적으로 분리
const PREVIEWS_DIR = path.join(DEPLOYMENTS_DIR, '_previews');

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

    // 배포/롤백 진행 중 여부 공개 조회 (Task 2.2 헬스 모니터가 사용 —
    // 배포 중인 프로젝트는 프로브/자동 재시작 대상에서 제외해야 함)
    isDeploying(projectId) {
        return this.activeDeployments.has(projectId);
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
    // options (Task 2.1 롤백): { rollbackImageTag, rollbackOfDeploymentId, deploymentId }
    // 롤백도 이 진입점을 통과하므로 per-project activeDeployments 락이 배포/롤백
    // 동시 실행을 동일하게 차단한다.
    async deploy(project, commitHash = null, commitMessage = null, options = {}) {
        if (this.activeDeployments.has(project.id)) {
            console.log(`⚠️ Deployment already in progress for ${project.name}`);
            // code 는 안정적 계약 (rollbackTo 락 레이스 감지, Task 2.2 자동 롤백이 의존)
            // — 사람용 error 메시지는 바뀌어도 code 는 유지할 것.
            return { success: false, code: 'DEPLOY_IN_PROGRESS', error: 'Deployment already in progress' };
        }
        this.activeDeployments.add(project.id);

        const DEPLOY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(`배포 타임아웃: ${DEPLOY_TIMEOUT_MS / 60000}분 초과`)), DEPLOY_TIMEOUT_MS);
        });

        return Promise.race([
            this._doDeploy(project, commitHash, commitMessage, options),
            timeoutPromise
        ]).then((result) => {
            clearTimeout(timeoutHandle);
            return result;
        }).catch(async (error) => {
            clearTimeout(timeoutHandle);
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

    async _doDeploy(project, commitHash = null, commitMessage = null, options = {}) {
        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        // ⏪ 롤백 모드 (Task 2.1): 저장된 배포 이미지 태그로 소스/빌드 단계 없이 배포.
        // 컨테이너 시작~nginx 스왑~정리 머신은 아래 기존 흐름을 그대로 재사용한다.
        const rollbackImageTag = options.rollbackImageTag || null;
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
            // Create deployment record (롤백은 rollbackTo() 가 202 응답용으로 미리 생성한 행 재사용)
            if (options.deploymentId) {
                deploymentId = options.deploymentId;
            } else {
                const deployment = await db.queryOne(
                    `INSERT INTO deployments (project_id, commit_hash, commit_message, status)
         VALUES ($1, $2, $3, 'building') RETURNING id`,
                    [project.id, commitHash, commitMessage]
                );
                deploymentId = deployment.id;
            }
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
            let actualPort = null;
            let isPixelStreaming = false;
            let isWorker = false;
            let deployImageTag = null; // orbitron-<sub>:d<deploymentId> — 빌드 성공 시에만 설정 (Task 1.2)

            const isDatabase = project.type === 'db_postgres' || project.type === 'db_redis';
            const isVps = project.type === 'vps';

            if (isVps) {
                // ── VPS Deploy: Build + Start lightweight Linux container ──
                this.emitProgress(project.id, 'clone', 'VPS 환경 구성 준비 중...');
                this.emitProgress(project.id, 'build', 'VPS 이미지 빌드 중...');
                logs += '\n🖥 Starting VPS container...\n';

                try {
                    const vpsResult = await dockerService.startVpsContainer(project);
                    containerId = vpsResult.containerId;
                    containerName = vpsResult.containerName;
                    logs += `VPS container started: ${containerId}\n`;
                    logs += `  OS: ${vpsResult.osImage}\n`;
                    logs += `  CPU: ${vpsResult.cpuLimit} cores\n`;
                    logs += `  RAM: ${vpsResult.memLimit}\n`;
                    if (vpsResult.sshEnabled) {
                        logs += `  SSH: port ${vpsResult.port} (user: ${vpsResult.sshUser})\n`;
                    }
                    this.emitProgress(project.id, 'container', 'VPS 컨테이너 시작 완료');

                    // Update port in DB if changed
                    if (vpsResult.port !== project.port) {
                        await db.query('UPDATE projects SET port = $1 WHERE id = $2', [vpsResult.port, project.id]);
                    }
                } catch (e) {
                    logs += `VPS Start failed: ${e.message}\n`;
                    throw e;
                }

                this.emitProgress(project.id, 'nginx', '프록시 설정 건너뜀 (VPS 직접 접속)');
                this.emitProgress(project.id, 'tunnel', '외부 접속 터널 생성 건너뜀 (SSH 포트 직접 노출)');

            } else if (isDatabase) {
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
                if (rollbackImageTag) {
                // ═══════════════════════════════════════════════════════════
                // ⏪ 원클릭 롤백 (Task 2.1): 소스 가져오기·분석·빌드 전체 생략.
                // 전략 (a) retag: 저장된 :d<id> 태그를 un-suffixed 프로덕션
                // 이미지(orbitron-<sub>)로 재지정한 뒤, 이 if/else 아래의
                // 공용 컨테이너 시작/nginx 스왑/정리 흐름을 그대로 태운다.
                // un-suffixed 이름을 유일한 실행 이미지로 가정하는 모든 기존
                // 경로(startContainer, Feature 8 previousImageId, 서버 복구,
                // 워커/픽셀스트리밍 시작)가 수정 없이 일관성을 유지한다.
                // ═══════════════════════════════════════════════════════════
                this.emitProgress(project.id, 'clone', '⏪ 롤백: 소스 가져오기 건너뜀 (저장된 이미지 재사용)');
                logs += `\n⏪ 롤백 모드: 배포 #${options.rollbackOfDeploymentId || '?'} 의 이미지(${rollbackImageTag})를 재사용합니다.\n`;
                this.emitProgress(project.id, 'build', '⏪ 롤백: 빌드 건너뜀 — 이미지 태그 전환 중...');
                await execFileAsync('docker', ['tag', rollbackImageTag, `orbitron-${project.subdomain}`]);
                logs += `🏷 docker tag ${rollbackImageTag} orbitron-${project.subdomain}\n`;
                // 새 배포 행의 image_tag = 실제로 실행되는 이미지의 d-태그
                deployImageTag = rollbackImageTag;
                this.emitProgress(project.id, 'build', '롤백 이미지 준비 완료');
                await saveLogs();
                } else {
                // ── 소스 기반 배포 경로 (기존 흐름 그대로 — 들여쓰기 의도적 유지) ──
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
                                    const encryptedEnvVars = encryptForJsonb(newEnv);
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

                // ── Resolve envRefs: auto-inject DATABASE_URL, service URLs, generated secrets ──
                const allServices = manifest.services || [];
                const allDatabases = manifest.databases || [];
                for (const svc of allServices) {
                    if (!svc.envRefs || Object.keys(svc.envRefs).length === 0) continue;

                    const resolvedEnv = { ...(project.env_vars || {}) };
                    let envChanged = false;

                    for (const [key, ref] of Object.entries(svc.envRefs)) {
                        let value = null;

                        // database.{name}.connectionString / host / port / username / password
                        const dbMatch = ref.match(/^database\.([^.]+)\.(.+)$/);
                        if (dbMatch) {
                            const dbName = dbMatch[1];
                            const dbField = dbMatch[2];
                            const dbDef = allDatabases.find(d => d.name === dbName);
                            const dbSubdomain = `${project.subdomain}-db`;
                            const dbHost = `orbitron-${dbSubdomain}`;
                            const dbUser = 'orbitron_user';
                            const dbPass = 'orbitron_db_pass';
                            const dbDatabase = 'orbitron_db';
                            const dbPort = (dbDef?.engine === 'redis') ? 6379 : 5432;

                            if (dbField === 'connectionString') {
                                value = (dbDef?.engine === 'redis')
                                    ? `redis://${dbHost}:${dbPort}`
                                    : `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbDatabase}`;
                            } else if (dbField === 'host') { value = dbHost; }
                            else if (dbField === 'port') { value = String(dbPort); }
                            else if (dbField === 'username') { value = dbUser; }
                            else if (dbField === 'password') { value = dbPass; }
                        }

                        // service.{name}.url / host
                        const svcMatch = ref.match(/^service\.([^.]+)\.(.+)$/);
                        if (svcMatch) {
                            const svcName = svcMatch[1];
                            const svcField = svcMatch[2];
                            const targetSvc = allServices.find(s => s.name === svcName);
                            const targetHost = `orbitron-${project.subdomain}`;
                            const targetPort = targetSvc?.port || 3000;

                            if (svcField === 'url') { value = `http://${targetHost}:${targetPort}`; }
                            else if (svcField === 'host') { value = targetHost; }
                        }

                        if (value) {
                            const currentValue = resolvedEnv[key];
                            const nextValue = key === 'DATABASE_URL'
                                ? managedDatabaseUrl(currentValue, value)
                                : ((!currentValue || String(currentValue).includes('localhost')) ? value : currentValue);

                            if (nextValue !== currentValue) {
                                resolvedEnv[key] = nextValue;
                                envChanged = true;
                                logs += `  📎 Auto-resolved: ${key} → ${nextValue}\n`;
                            }
                        }
                    }

                    // Handle generate: true
                    for (const envItem of (svc.env || [])) {
                        if (envItem.generate && envItem.key && !resolvedEnv[envItem.key]) {
                            resolvedEnv[envItem.key] = require('crypto').randomBytes(32).toString('hex');
                            envChanged = true;
                            logs += `  🔑 Auto-generated: ${envItem.key}\n`;
                        }
                    }

                    if (envChanged) {
                        project.env_vars = resolvedEnv;
                        const encryptedEnvVars = encryptForJsonb(resolvedEnv);
                        await db.query('UPDATE projects SET env_vars = $1 WHERE id = $2', [encryptedEnvVars, project.id]);
                        logs += `  ✅ Resolved ${Object.keys(svc.envRefs).length} env references\n`;
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
                    // ── 동시 빌드 제한 큐 (Task 1.3) ──
                    // 슬롯이 없으면 배포 레코드를 'queued' 로 두고 FIFO 대기.
                    // (per-project 락은 deploy() 진입 시 이미 확보된 상태 — 순서 유지)
                    const preStats = buildQueue.stats();
                    const mustWait = preStats.active >= preStats.limit;
                    if (mustWait) {
                        logs += `⏳ 빌드 슬롯 대기 중 (앞에 ${preStats.queued}건, 동시 빌드 제한 ${preStats.limit}건)...\n`;
                        this.emitProgress(project.id, 'build', `빌드 슬롯 대기 중 (앞에 ${preStats.queued}건)...`);
                        await saveLogs('queued');
                    }
                    // deploymentId 는 빌드 전에 이미 생성됨 (위 INSERT) — 배포별 태그에 사용
                    const buildResult = await buildQueue.withSlot(`${project.subdomain}#${deploymentId}`, async () => {
                        if (mustWait) {
                            logs += `🎫 빌드 슬롯 획득 — 빌드를 시작합니다.\n`;
                            this.emitProgress(project.id, 'build', 'Docker 이미지(또는 Compose) 빌드 중...');
                            await saveLogs('building'); // 대기 해제: 'queued' → 'building' 복원
                        }
                        return dockerService.buildImage(project, deploymentId);
                    });
                    logs += buildResult.logs;
                    if (buildResult.isCompose) {
                        isCompose = true;
                    }
                    if (buildResult.deployTag) {
                        deployImageTag = buildResult.deployTag;
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
                } // ── end 소스 기반 배포 경로 (rollbackImageTag ? retag : clone+build) ──

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

                        // CRITICAL: Force-kill any container still using the target port
                        // Prevents "port already allocated" errors on redeploy
                        if (project.port && project.type !== 'worker') {
                            try {
                                const { stdout: portOut } = await execAsync(
                                    `docker ps -a --format '{{.Names}}' --filter "publish=${project.port}" 2>/dev/null || true`
                                );
                                const stuckContainers = portOut.trim().split('\n').filter(Boolean);
                                for (const stuck of stuckContainers) {
                                    if (stuck.startsWith(`orbitron-${project.subdomain}`)) {
                                        logs += `🧹 Force-removing container holding port ${project.port}: ${stuck}\n`;
                                        await execAsync(`docker rm -f ${stuck} 2>/dev/null || true`);
                                    }
                                }
                            } catch { }
                        }

                        logs += 'Old containers cleaned up.\n';
                    } catch (e) {
                        logs += `Warning: cleanup error: ${e.message}\n`;
                    }

                    // Start container (or Compose stack)
                    this.emitProgress(project.id, 'container', '컨테이너 시작 중...');
                    logs += '\nStarting container...\n';

                    let startRes;
                    if (isCompose) {
                        // Auto-generate .env for compose projects to override conflicting ports
                        // This survives git pull since .env is gitignored by convention
                        try {
                            const composeEnvPath = path.join(projectDir, '.env');
                            const existingEnv = fs.existsSync(composeEnvPath) ? fs.readFileSync(composeEnvPath, 'utf-8') : '';
                            if (!existingEnv.includes('HTTP_PORT=')) {
                                const envLines = existingEnv.trim() ? existingEnv.trim().split('\n') : [];
                                envLines.push(`HTTP_PORT=${project.port || 3000}`);
                                fs.writeFileSync(composeEnvPath, envLines.join('\n') + '\n');
                                logs += `📝 Auto-set HTTP_PORT=${project.port} in .env\n`;
                            }
                        } catch (e) {
                            logs += `⚠️ .env auto-generation skipped: ${e.message}\n`;
                        }

                        logs += 'Using docker compose up...\n';
                        startRes = await dockerService.startCompose(project);
                        if (startRes.logs) logs += startRes.logs + '\n';
                    } else {
                        startRes = await dockerService.startContainer(project);
                        if (startRes.startLogs) logs += startRes.startLogs;
                    }

                    containerId = startRes.containerId;
                    containerName = startRes.containerName;
                    actualPort = startRes.port || project.port || 3000;
                    logs += `Container started: ${containerId} (${containerName})\n`;

                    // Post-deploy verification: ensure container is actually in Running state
                    // Not just "started" — verify it hasn't immediately crashed/exited
                    if (!isCompose && containerName) {
                        await new Promise(r => setTimeout(r, 2500)); // Give it 2.5s to stabilize
                        try {
                            const { stdout: stateOut } = await execAsync(
                                `docker inspect --format '{{.State.Status}}|{{.State.ExitCode}}|{{.State.Error}}' ${containerName} 2>/dev/null`
                            );
                            const [state, exitCode, stateError] = stateOut.trim().split('|');
                            if (state !== 'running') {
                                logs += `⚠️ 컨테이너 상태 이상: state=${state}, exitCode=${exitCode}\n`;
                                if (stateError) logs += `   Error: ${stateError}\n`;
                                // Get container logs for diagnosis
                                try {
                                    const { stdout: cLogs } = await execAsync(`docker logs ${containerName} --tail 30 2>&1`);
                                    logs += `\n--- 컨테이너 로그 (마지막 30줄) ---\n${cLogs}\n`;
                                } catch { }
                                throw new Error(`컨테이너가 시작 후 ${state} 상태 (exit: ${exitCode}). 로그를 확인하세요.`);
                            }
                            logs += `✅ 컨테이너 상태 검증 통과: running\n`;
                        } catch (verifyErr) {
                            if (verifyErr.message.includes('컨테이너가 시작 후')) throw verifyErr;
                            // docker inspect failed — container may have been removed
                            logs += `⚠️ 검증 실패: ${verifyErr.message}\n`;
                        }
                    }

                    this.emitProgress(project.id, 'container', '컨테이너 시작 완료');

                    // ── Task 4.2: HTTP 스모크 체크 — nginx 전환 전 앱-레벨 생존 확인 ──
                    // 컨테이너 running + 포트 LISTEN(프로세스 준비)만으로는 부족하다:
                    // 포트는 열었지만 모든 요청에 5xx 를 뱉는 앱이 nginx 로 전환되면
                    // 즉시 장애가 된다. 여기서 실패하면 throw 로 기존 실패 경로를 타고,
                    // addProject 를 호출하지 않으므로 nginx conf 는 그대로 유지된다.
                    //
                    // 대상: 단일 웹 컨테이너 경로만 (compose 는 단일 포트가 없어 제외;
                    // VPS/DB/worker/pixel-streaming 은 이 분기에 도달하지 않음).
                    // 롤백 배포(rollbackImageTag)도 같은 경로를 지나므로 동일하게 검사된다.
                    //
                    // 프로브 타깃 = nginx 가 프록시할 대상과 '정확히 동일': 컨테이너 IP
                    // + /proc/net/tcp 감지(nginx.js 와 같은 헬퍼)로 찾은 실제 리슨 포트.
                    // host-mapped 포트(127.0.0.1:<actualPort>)는 쓰지 않는다 — PORT env
                    // 를 무시하고 내부 포트에 하드코딩된 앱은 host 포트로 도달 불가지만
                    // nginx 감지가 구제하므로, host 포트 프로브는 멀쩡한 배포를 실패시킨다
                    // (monitor.js 를 같은 이유로 nginx 경유 프로브로 고친 실장애 참고).
                    if (!isCompose) {
                        // health_path: orbitron.yaml 오버라이드 (기본 '/').
                        // 롤백 모드에서도 projectDir 의 yaml 을 읽는다 — 소스와 이미지가
                        // 어긋나 옛 이미지에 경로가 없어도 404 는 PASS 라 무해하다.
                        let healthPath = '/';
                        const smokeYamlPath = findOrbitronYaml(projectDir);
                        if (smokeYamlPath) {
                            try {
                                const resolved = resolveHealthPath(yaml.load(fs.readFileSync(smokeYamlPath, 'utf8')));
                                if (resolved.warning) logs += `\n${resolved.warning}\n`;
                                healthPath = resolved.path;
                            } catch (e) {
                                logs += `\n⚠️ 스모크 체크용 orbitron.yaml 파싱 실패 — 기본 경로 '/' 사용: ${e.message}\n`;
                            }
                        }

                        // 1) 실제 리슨 포트 감지 (nginx generateConfig 와 동일 헬퍼/예산 12초)
                        this.emitProgress(project.id, 'container', '🩺 스모크 체크: 리슨 포트 감지 중...');
                        const listenPorts = nginxService.detectContainerListenPorts(containerName);
                        const smokePort = nginxService.selectListenPort(listenPorts, actualPort);
                        if (smokePort === null) {
                            // 하드 게이트 금지: 12초보다 늦게 바인딩하는 앱(무거운 모델
                            // 로딩 등)은 사전-스모크 시절에도 배포됐다. 기대 포트로
                            // 폴백 프로브 (smokeCheck 의 5×2초 재시도 예산이 추가 유예).
                            logs += `\n  ⚠️ 리슨 포트 미감지 (12초): 기대 포트 ${actualPort} 로 폴백 프로브합니다 (늦은 바인딩 앱 보호)\n`;
                        } else if (smokePort !== actualPort) {
                            logs += `\n  ℹ️ 리슨 포트 감지: 기대 포트 ${actualPort} 대신 ${smokePort} 에서 LISTEN 중 (하드코딩 CMD 가능성 — nginx 도 같은 포트로 프록시합니다)\n`;
                        }

                        // 2) 컨테이너 IP (Linux 호스트는 docker bridge IP 로 직접 라우팅 가능)
                        let containerIp = '';
                        try {
                            const { stdout: ipOut } = await execFileAsync('docker', [
                                'inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', containerName,
                            ]);
                            containerIp = ipOut.trim();
                        } catch { /* 아래 공통 실패 처리 */ }
                        if (!containerIp) {
                            logs += `\n❌ 스모크 체크 실패: 컨테이너 IP 를 확인할 수 없습니다 (네트워크 미연결?) — nginx 도 도달할 수 없는 상태입니다.\n`;
                            await saveLogs();
                            throw new Error(
                                '스모크 체크 실패: 컨테이너 IP 조회 실패 — nginx 전환을 중단했습니다. ' +
                                '/ Smoke check failed: could not resolve the container IP — nginx switch aborted.'
                            );
                        }

                        // 3) HTTP 프로브 (5xx/무응답 = 실패, 4xx = 통과) — 감지 실패 시
                        //    폴백 정책 포함 판정은 smokeStep (pure, 테스트 핀) 이 담당
                        this.emitProgress(project.id, 'container', `🩺 스모크 체크 중 (GET ${healthPath})...`);
                        const probePort = smokePort !== null ? smokePort : actualPort;
                        logs += `\n🩺 스모크 체크: http://${containerIp}:${probePort}${healthPath} (5xx/무응답 = 실패, 4xx = 통과)\n`;
                        const step = await smokeStep({
                            detectedPort: smokePort,
                            fallbackPort: actualPort,
                            host: containerIp,
                            path: healthPath,
                            options: {
                                onAttempt: ({ attempt, total, status, error }) => {
                                    logs += `🩺 스모크 체크: GET ${healthPath} → ${status !== null ? `HTTP ${status}` : error} (시도 ${attempt}/${total})\n`;
                                },
                            },
                        });
                        const smokeResult = step.result;

                        if (!step.ok) {
                            const detail = smokeResult.lastStatus !== null
                                ? `HTTP ${smokeResult.lastStatus}`
                                : (smokeResult.lastError || '응답 없음');
                            logs += `❌ 스모크 체크 실패 (${detail}) — nginx 전환을 중단합니다 (기존 프록시 설정 유지).\n`;
                            // Diagnosis aid: capture the failing container's recent logs
                            try {
                                const { stdout: cLogs } = await execAsync(`docker logs ${containerName} --tail 30 2>&1`);
                                logs += `\n--- 컨테이너 로그 (마지막 30줄) ---\n${cLogs}\n`;
                            } catch { }
                            await saveLogs();
                            throw new Error(step.usedFallback
                                ? `스모크 체크 실패: 리슨 포트 감지(12초)와 폴백 프로브(${smokeResult.attempts}회, ${detail}) 모두 실패했습니다 — nginx 전환을 중단했습니다. ` +
                                  `/ Smoke check failed: both listen-port detection (12s) and fallback probing (${smokeResult.attempts} attempts, ${detail}) failed — nginx switch aborted.`
                                : `스모크 체크 실패: 새 컨테이너가 ${smokeResult.attempts}회 시도 동안 정상 응답하지 않았습니다 (${detail}) — nginx 전환을 중단했습니다. ` +
                                  `/ Smoke check failed: new container did not return a healthy response after ${smokeResult.attempts} attempts (${detail}) — nginx switch aborted.`
                            );
                        }
                        if (smokeResult.ok) {
                            logs += `✅ 스모크 체크 통과 (HTTP ${smokeResult.lastStatus}, 시도 ${smokeResult.attempts}/${SMOKE_DEFAULTS.retries})\n`;
                        } else {
                            // 폴백 경로에서 5xx 응답 — 응답 자체가 리슨의 증거라 소프트
                            // 통과 (감지 불가 상태에서 오탐 중단 방지 — 사전 분기 패리티)
                            logs += `⚠️ 스모크 체크 소프트 통과: 폴백 프로브가 HTTP ${smokeResult.lastStatus} 응답 — 리슨 감지 불가 상태라 배포는 진행하나 앱 오류 가능성이 있습니다.\n`;
                        }
                        await saveLogs();
                    }

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
                        const hcPort = actualPort || project.port || 3000;
                        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${hcPort}/ 2>/dev/null || echo 000`);
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
            // (롤백 시 생략: 소스 트리는 롤백 대상 이미지보다 최신일 수 있어 무의미)
            if (!rollbackImageTag) {
                try {
                    const backupResult = projectBackup.backupProject(project);
                    logs += `\n📦 프로젝트 백업: ${backupResult.copiedCount}개 파일 복사 (${backupResult.totalSizeFormatted}) → ${backupResult.backupDir}\n`;
                } catch (e) {
                    logs += `\n⚠️ 프로젝트 백업 건너뜀: ${e.message}\n`;
                }
            }

            // ── PostDeploy Hooks: run custom post-deployment commands ──
            // (롤백 시 생략: 훅은 현재 체크아웃된 소스 기준으로 동작 — 롤백된
            //  이미지와 소스가 어긋난 상태에서 실행하면 오히려 해가 된다)
            if (rollbackImageTag) {
                logs += '\n🪝 PostDeploy 훅 건너뜀 (롤백 모드 — 소스와 이미지 버전 불일치 가능)\n';
            }
            const yamlPathForHooks = rollbackImageTag ? null : findOrbitronYaml(projectDir);
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

            // Final log save with 'success' status (+ 배포별 이미지 태그 기록 — 롤백용, Task 1.2)
            await db.query(
                `UPDATE deployments SET status = 'success', logs = $1, image_tag = $2, finished_at = NOW() WHERE id = $3`,
                [this._truncateLogs(logs), deployImageTag, deploymentId]
            );

            // Clean up old Blue-Green containers AFTER successful routing
            if (containerName && !isWorker) {
                logs += '\n🧹 이전 버전 컨테이너 정리 중...\n';
                await dockerService.cleanupOldContainers(project.subdomain, containerName);
                logs += '  ✅ 이전 컨테이너 정리 완료\n';
            }

            // Per-project deploy-tag retention (Task 1.2 → 2.1 keep-list 강화):
            // 보존 목록 = DB 기준 최신 N개 '성공' 배포의 image_tag + 방금 실행된 태그.
            // 목록 밖의 d-태그(실패 배포 잔여물, N 초과 옛 태그)만 해제된다.
            // 롤백 직후에도 안전: 방금 success 로 기록된 롤백 행이 OLD d-태그를
            // 가리키므로 keep-list 에 포함 → id 순 정렬에 밀려 삭제되지 않는다.
            if (deployImageTag) {
                this._pruneDeployImagesWithKeepList(project, deployImageTag).catch(() => { });
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

            // MANUAL_CONF_PROTECTED는 코드 결함이 아니라 의도된 보호 — AI가 고칠 수
            // 없는 에러이므로 자동 복구 재시도를 건너뛰고 바로 실패 처리한다.
            // 롤백 실패도 소스 코드 결함이 아님(이미지/컨테이너/인프라 문제) —
            // AI가 현재 소스를 패치해 재배포하면 롤백 의도 자체를 뒤집으므로 생략.
            if (!isAutoRepairRetry && !rollbackImageTag && error.code !== 'MANUAL_CONF_PROTECTED' && fs.existsSync(projectDir)) {
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
            // (MANUAL_CONF_PROTECTED는 의도된 가드 에러 — LLM 분석 호출도 건너뛴다)
            if (error.code !== 'MANUAL_CONF_PROTECTED') {
                this.emitProgress(project.id, 'done', '오류 원인 분석 중...', 'running');
                const aiAnalysis = await aiAnalyzer.analyzeError(logs, project.ai_model, project.env_vars || {});
                if (aiAnalysis) {
                    logs += `\n\n🤖 [AI Error Analysis]\n${aiAnalysis}\n`;
                }
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

            // Safety net: ensure status never stays 'building'. If the try/catch
            // above failed to update status (e.g. catch handler itself threw),
            // demote to 'failed' here so the project doesn't stay locked.
            try {
                const cur = await db.queryOne(`SELECT status FROM projects WHERE id = $1`, [project.id]);
                if (cur && cur.status === 'building') {
                    await db.query(`UPDATE projects SET status = 'failed' WHERE id = $1`, [project.id]);
                    console.warn(`⚠️ Project ${project.id} left in 'building' state — demoted to 'failed' by finally guard`);
                }
            } catch (e) { /* db unreachable in finally — best effort only */ }

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

    // ── Task 2.1: prune keep-list 조립 ──────────────────────────────────────
    // DB에서 이 프로젝트의 '성공' 배포가 참조하는 최신 N개 **서로 다른** image_tag
    // 를 뽑아 현재 태그와 합친 보존 목록을 만들어 pruneDeployImages 에 넘긴다.
    // DISTINCT ON: 롤백 행과 원본 배포 행이 같은 태그를 공유하므로, 단순
    // 최신-N-행 조회는 중복 태그로 인해 N개 미만의 이미지만 보호할 수 있다 —
    // 태그별 최신 출현 id 기준으로 중복을 접은 뒤 N개를 취한다.
    // keep-list 를 deployer 에서 조립하는 이유: docker.js 가 db 를 정식 의존하게
    // 만들지 않기 위해 (현재 cleanupOldContainers 의 lazy require 뿐) —
    // pruneDeployImages 는 docker 전용 + 순수 함수 조합으로 유지된다.
    async _pruneDeployImagesWithKeepList(project, currentTag) {
        let keepTags;
        try {
            const keepN = dockerService.deployImageRetention();
            const rows = await db.queryAll(
                `SELECT image_tag FROM (
                     SELECT DISTINCT ON (image_tag) image_tag, id
                     FROM deployments
                     WHERE project_id = $1 AND status = 'success' AND image_tag IS NOT NULL
                     ORDER BY image_tag, id DESC
                 ) t ORDER BY id DESC LIMIT $2`,
                [project.id, keepN]
            );
            keepTags = buildKeepTagList(rows, currentTag);
        } catch (e) {
            // DB 조회 실패 → prune 자체를 건너뛴다. 위치 기반(최신 N id) 폴백은
            // 롤백 이후 안전하지 않다: 프로덕션이 가리키는 OLD d-태그가 id 순
            // 정렬에 밀려 삭제될 수 있다. prune 은 다음 성공 배포에서 다시
            // 시도되므로 건너뛰어도 태그가 일시적으로 더 남을 뿐 손실이 없다.
            console.warn(`⚠️ Deploy-tag prune skipped for ${project.subdomain} (keep-list DB query failed): ${e.message}`);
            return { removed: 0, skipped: true };
        }
        return dockerService.pruneDeployImages(project.subdomain, keepTags);
    }

    // ── Task 2.1: 원클릭 롤백 진입점 ────────────────────────────────────────
    // 성공했던 배포의 저장 이미지(:d<id>)로 빌드 없이 재배포한다.
    // 검증(자격/이미지 실존/락)을 동기적으로 마친 뒤 새 배포 행을 만들어
    // 그 id 를 즉시 반환하고, 실제 배포는 백그라운드에서 deploy() 를 통해
    // 실행된다 (per-project 락 포함, 일반 배포와 동일한 흐름).
    // 반환: { success: true, deploymentId } 또는 { success: false, code, error }
    async rollbackTo(project, targetDeployment) {
        const eligibility = assessRollbackEligibility(project, targetDeployment);
        if (!eligibility.ok) return { success: false, code: eligibility.code, error: eligibility.error };

        // 이미지 실존 확인 — retention 이 태그를 이미 정리했을 수 있다
        try {
            await execFileAsync('docker', ['image', 'inspect', targetDeployment.image_tag]);
        } catch {
            return {
                success: false, code: 'IMAGE_GONE',
                error: `롤백 대상 이미지(${targetDeployment.image_tag})가 이미 정리되어 없습니다 (retention 은 최신 ${dockerService.deployImageRetention()}개만 보존). / The target image has been pruned and is no longer available.`,
            };
        }

        if (this.activeDeployments.has(project.id)) {
            return {
                success: false, code: 'DEPLOY_IN_PROGRESS',
                error: '이미 이 프로젝트의 배포가 진행 중입니다. 완료 후 다시 시도하세요. / A deployment is already in progress for this project.',
            };
        }

        const commitMessage = formatRollbackCommitMessage(targetDeployment);
        const row = await db.queryOne(
            `INSERT INTO deployments (project_id, commit_hash, commit_message, status)
             VALUES ($1, $2, $3, 'building') RETURNING id`,
            [project.id, targetDeployment.commit_hash, commitMessage]
        );

        this.deploy(project, targetDeployment.commit_hash, commitMessage, {
            rollbackImageTag: targetDeployment.image_tag,
            rollbackOfDeploymentId: targetDeployment.id,
            deploymentId: row.id,
        }).then((result) => {
            // 락 경쟁에서 밀린 경우(위 has() 체크와 deploy() 진입 사이 레이스):
            // deploy() 는 미리 만든 행을 만지지 않으므로 여기서 failed 처리
            if (result && !result.success && result.code === 'DEPLOY_IN_PROGRESS') {
                db.query(
                    `UPDATE deployments SET status = 'failed', logs = $1, finished_at = NOW() WHERE id = $2`,
                    ['⏪ 롤백 취소: 다른 배포가 먼저 시작되었습니다. / Rollback cancelled: another deployment started first.', row.id]
                ).catch(() => { });
            }
        }).catch((err) => {
            console.error(`Rollback deploy error for ${project.name}:`, err);
        });

        return { success: true, deploymentId: row.id };
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
                let extra = '';
                // 첫 클론에서도 요청된 커밋으로 고정: 클론은 브랜치 HEAD 를 받으므로
                // webhook 의 커밋 해시와 어긋날 수 있다 (해시는 호출부에서 이미
                // 화이트리스트 검증됨 — deployPreview 의 isSafeCommitHash / 롤백 경로).
                if (commitHash) {
                    const { stdout: rOut, stderr: rErr } = await execAsync(
                        `cd ${projectDir} && git reset --hard ${commitHash}`, { maxBuffer: 1024 * 1024 * 10 }
                    );
                    extra = `\nGit reset to ${commitHash.substring(0, 7)}:\n${rOut}${rErr}`;
                }
                return `Git clone:\n${stdout}${stderr}${extra}`;
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

    // ═══════════════════════════════════════════════════════════════════════
    // Task 3.1: PR 프리뷰 배포
    //
    // 설계 원칙:
    //   - projects 테이블은 절대 건드리지 않는다. 프리뷰 상태는 전부
    //     preview_deployments 행 + synthetic project 객체(메모리)로만 관리.
    //   - 이미지/컨테이너 이름은 프리뷰 서브도메인에서 파생:
    //     orbitron-pr-<n>-<sub>(-<hash>) — 부모의 orbitron-<sub>-* 프리픽스와
    //     겹치지 않아 cleanupOldContainers 가 서로를 건드리지 않는다.
    //   - v1 제약: same-repo PR 만(fork 차단은 webhook 계층), compose 프로젝트
    //     프리뷰 미지원, DB 는 부모 프로젝트와 공유(아래 env 복사 주석 참조).
    // ═══════════════════════════════════════════════════════════════════════

    // 프리뷰 배포 진입점. 반환: { success, code?, error?, subdomain? }
    async deployPreview(project, prNumber, branch, commitHash = null) {
        // webhook payload 에서 온 값이 셸 보간(cloneOrPull)으로 흘러가기 전 검증.
        // 브랜치명이 화이트리스트 밖이면 배포 자체를 거부, 커밋 해시가 이상하면
        // 해시 없이 origin/<branch> HEAD 로 폴백한다.
        if (!previewRules.isSafeBranchName(branch)) {
            console.log(`⏭️ Preview skipped: unsafe branch name ${JSON.stringify(branch)} (PR #${prNumber})`);
            return { success: false, code: 'UNSAFE_BRANCH', error: 'Unsafe branch name' };
        }
        if (commitHash && !previewRules.isSafeCommitHash(commitHash)) {
            console.log(`⚠️ Preview: ignoring malformed commit hash ${JSON.stringify(commitHash)} — using branch HEAD`);
            commitHash = null;
        }
        const previewSubdomain = previewRules.buildPreviewSubdomain(project.subdomain, prNumber);
        // per-preview 락: activeDeployments 재사용 (키는 'preview:<sub>' 문자열 —
        // 숫자 project.id 키와 충돌하지 않으므로 isDeploying() 의미는 그대로)
        const lockKey = `preview:${previewSubdomain}`;
        if (this.activeDeployments.has(lockKey)) {
            console.log(`⚠️ Preview deployment already in progress: ${previewSubdomain}`);
            return { success: false, code: 'DEPLOY_IN_PROGRESS', error: 'Preview deployment already in progress' };
        }
        this.activeDeployments.add(lockKey);

        let rowId = null;
        try {
            // ── 심층 방어: 계산된 프리뷰 서브도메인을 실 프로젝트가 소유하면 중단 ──
            // 1차 방어는 routes/projects.js 의 pr-<n>- 네임스페이스 예약(생성/수정
            // 시 400)이지만, 마이그레이션 이전에 만들어진 프로젝트가 남아있을 수
            // 있으므로 여기서도 확인한다 — 실 서비스의 nginx conf 덮어쓰기/컨테이너
            // 정리를 프리뷰 흐름이 절대 트리거하지 않게.
            const collision = await db.queryOne(
                `SELECT id, name FROM projects WHERE subdomain = $1`, [previewSubdomain]
            );
            if (collision) {
                console.error(`🚫 Preview aborted: subdomain ${previewSubdomain} is owned by real project #${collision.id} (${collision.name})`);
                return { success: false, code: 'SUBDOMAIN_OWNED', error: `프리뷰 서브도메인이 실 프로젝트와 충돌합니다: ${previewSubdomain}` };
            }

            // ── max-3 활성 프리뷰 게이트 (기존 PR 재배포는 통과) ──
            // (알려진 폭 좁은 레이스: 거의 동시에 도착한 서로 다른 PR webhook 이
            //  둘 다 게이트를 통과해 잠깐 4개가 될 수 있다 — 락은 per-preview 키라
            //  서로를 막지 않는다. 수용된 트레이드오프: 초과분은 7일 TTL 스윕이
            //  회수하고, 실제 트리거 조건(동시 다PR push)이 드물다.)
            const existing = await db.queryAll(
                `SELECT pr_number FROM preview_deployments WHERE project_id = $1`, [project.id]
            );
            if (!previewRules.canCreatePreview(existing, prNumber)) {
                console.log(`⏭️ Preview limit reached for ${project.subdomain} (max ${previewRules.MAX_ACTIVE_PREVIEWS}) — skipping PR #${prNumber}`);
                return { success: false, code: 'PREVIEW_LIMIT', error: `프로젝트당 활성 프리뷰는 최대 ${previewRules.MAX_ACTIVE_PREVIEWS}개입니다.` };
            }

            // ── 프리뷰 행 upsert (subdomain UNIQUE 가 잘린 이름 충돌의 최종 방어 —
            //    truncate+hash 가 이론상 충돌하면 여기서 23505 로 throw 되고 아래
            //    catch 가 실패 처리한다. 수용된 우아한 실패: 확률이 무시 가능하고
            //    잘못된 대상을 덮어쓰는 일은 구조적으로 불가능하다) ──
            const row = await db.queryOne(
                `INSERT INTO preview_deployments (project_id, pr_number, branch, subdomain, status, last_commit)
                 VALUES ($1, $2, $3, $4, 'building', $5)
                 ON CONFLICT (project_id, pr_number)
                 DO UPDATE SET branch = $3, status = 'building', last_commit = $5, updated_at = NOW()
                 RETURNING id`,
                [project.id, prNumber, branch, previewSubdomain, commitHash]
            );
            rowId = row.id;

            // ── 부모 env 복호화 → 복사 (projects 행은 읽기만) ──
            let parentEnv = {};
            if (project.env_vars && typeof project.env_vars === 'string') {
                try {
                    const decrypted = decrypt(project.env_vars);
                    parentEnv = decrypted ? JSON.parse(decrypted) : {};
                } catch {
                    console.error(`Preview: failed to decrypt env_vars for project ${project.id}`);
                }
            } else if (typeof project.env_vars === 'object' && project.env_vars !== null) {
                parentEnv = project.env_vars;
            }

            // ⚠️ v1 캐비앳: 프리뷰는 부모 프로젝트의 DATABASE_URL 등을 그대로
            // 물려받는다 — 프리뷰 컨테이너의 쓰기가 부모의 "실제" DB 에 반영된다.
            // (프리뷰별 DB 클론은 v2 과제)
            // PORT 는 여기서 미리 넣지 않는다: docker.startContainer 의 자동 주입이
            // (Task 3.1 리뷰에서) lsof 충돌 해소 루프 "이후"로 이동해, 주입되는
            // PORT == 최종 호스트 매핑 포트가 보장된다. 미리 basePort 를 박으면
            // 그 정렬을 다시 깨뜨린다. (알려진 코너: 부모 env 에 PORT 가 명시된
            // 경우 자동 주입이 건너뛰어져 부모의 값이 그대로 쓰인다 — 부모와 동일
            // 동작이며, nginx/스모크는 감지된 실제 리슨 포트로 라우팅하므로 무해)
            const basePort = previewRules.previewBasePort(prNumber);
            const previewEnv = { ...parentEnv };

            // synthetic project: 배포 기계(빌드/컨테이너/nginx)가 요구하는 필드만
            // 부모에서 복사. id 를 지워 어떤 경로도 projects 행을 UPDATE 못 하게 한다.
            const synth = {
                ...project,
                id: undefined,
                name: `${project.name} (PR #${prNumber})`,
                subdomain: previewSubdomain,
                branch: branch || project.branch,
                port: basePort,
                env_vars: previewEnv,
                container_id: null,
                custom_domain: null,
                redirect_to_custom_domain: false,
                webhook_url: null,
                tunnel_url: null,
            };

            const previewDir = path.join(PREVIEWS_DIR, previewSubdomain);
            fs.mkdirSync(PREVIEWS_DIR, { recursive: true });

            // ── 1. Clone/pull (cloneOrPull 재사용 — synth.branch 가 PR 브랜치) ──
            console.log(`🔍 Preview deploy: ${previewSubdomain} (branch ${synth.branch}, commit ${commitHash ? commitHash.substring(0, 7) : 'HEAD'})`);
            await this.cloneOrPull(synth, previewDir, commitHash);

            // ── 2. Build (공유 buildQueue 슬롯 — 일반 배포와 같은 동시성 한도) ──
            const buildResult = await buildQueue.withSlot(`preview:${previewSubdomain}`, async () => {
                return dockerService.buildImage(synth, null, previewDir);
            });
            if (buildResult.isCompose) {
                throw new Error('Compose 프로젝트의 PR 프리뷰는 v1 에서 지원하지 않습니다. / Compose previews are not supported in v1.');
            }

            // ── 3. Start container (블루-그린: 새 컨테이너 먼저, 옛것은 뒤에 정리) ──
            const startRes = await dockerService.startContainer(synth);
            const containerName = startRes.containerName;
            const actualPort = startRes.port || basePort;
            synth.port = actualPort;

            // 시작 직후 상태 검증 (즉사 감지)
            await new Promise(r => setTimeout(r, 2500));
            const { stdout: stateOut } = await execFileAsync('docker', [
                'inspect', '--format', '{{.State.Status}}|{{.State.ExitCode}}', containerName,
            ]);
            const [state, exitCode] = stateOut.trim().split('|');
            if (state !== 'running') {
                throw new Error(`프리뷰 컨테이너가 시작 후 ${state} 상태 (exit: ${exitCode})`);
            }

            // ── 4. 스모크 체크 (본 배포와 동일한 감지/판정 헬퍼 재사용) ──
            const listenPorts = nginxService.detectContainerListenPorts(containerName);
            const smokePort = nginxService.selectListenPort(listenPorts, actualPort);
            let containerIp = '';
            try {
                const { stdout: ipOut } = await execFileAsync('docker', [
                    'inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', containerName,
                ]);
                containerIp = ipOut.trim();
            } catch { /* fall through */ }
            if (!containerIp) {
                throw new Error('프리뷰 스모크 체크 실패: 컨테이너 IP 조회 실패');
            }
            const step = await smokeStep({
                detectedPort: smokePort,
                fallbackPort: actualPort,
                host: containerIp,
                path: '/',
            });
            if (!step.ok) {
                const detail = step.result.lastStatus !== null ? `HTTP ${step.result.lastStatus}` : (step.result.lastError || '응답 없음');
                throw new Error(`프리뷰 스모크 체크 실패 (${detail}) — nginx 전환을 중단합니다.`);
            }

            // ── 5. nginx conf (synthetic project 로 addProject 재사용) ──
            // 프리뷰 conf 는 항상 Orbitron 생성물 — 수동 관리 가드는 addProject
            // 내부 검사를 그대로 통과시킨다 (마커가 있으면 예외 → 프리뷰 실패).
            await nginxService.addProject(synth, containerName);

            // ── 6. 옛 프리뷰 컨테이너 정리 (synchronize 재배포의 블루-그린 꼬리) ──
            await dockerService.cleanupOldContainers(previewSubdomain, containerName);

            // 최종 상태 UPDATE 는 행 실존을 확인한다 (RETURNING): destroyPreview 는
            // 프리뷰 락을 존중하지 않으므로 빌드→시작 사이 갭에서 destroy 가 먼저
            // 완료되면 행이 이미 없다 — 그대로 성공 처리하면 방금 띄운 컨테이너와
            // nginx conf 가 DB 에 보이지 않는 채(= TTL 스윕 대상도 아님) 영구
            // 누수된다. 0행이면 지금 만든 리소스를 즉시 걷어낸다.
            const updated = await db.queryOne(
                `UPDATE preview_deployments SET status = 'running', container_id = $1, last_commit = $2, updated_at = NOW() WHERE id = $3 RETURNING id`,
                [containerName, commitHash, rowId]
            );
            if (!updated) {
                console.warn(`⚠️ Preview ${previewSubdomain} was destroyed mid-deploy — tearing down freshly started resources`);
                await this._teardownPreview(previewSubdomain);
                return { success: false, code: 'DESTROYED_MID_DEPLOY', error: 'Preview was destroyed while deploying', subdomain: previewSubdomain };
            }
            console.log(`✅ Preview ready: ${previewSubdomain} (container ${containerName}, port ${actualPort})`);

            // ── 7. GitHub PR 코멘트 (best-effort — 실패해도 배포는 성공) ──
            // project 원본의 env_vars 는 암호화 문자열이므로 토큰 탐색이 복호화된
            // parentEnv 를 보도록 env_vars 만 치환해서 넘긴다.
            this._postPreviewComment({ ...project, env_vars: parentEnv }, prNumber, previewSubdomain).catch(e => {
                console.log(`⚠️ Preview PR comment skipped: ${e.message}`);
            });

            return { success: true, subdomain: previewSubdomain, containerName };
        } catch (error) {
            console.error(`❌ Preview deploy failed for ${previewSubdomain}:`, error.message);
            if (rowId) {
                await db.query(
                    `UPDATE preview_deployments SET status = 'failed', updated_at = NOW() WHERE id = $1`, [rowId]
                ).catch(() => { });
            }
            return { success: false, error: error.message, subdomain: previewSubdomain };
        } finally {
            this.activeDeployments.delete(lockKey);
        }
    }

    // 프리뷰 파괴 (PR closed / TTL / 대시보드 삭제). 멱등 — 행이 이미 없어도
    // (double-close webhook) 컨테이너/nginx/디렉토리 잔여물 정리를 시도한다.
    async destroyPreview(project, prNumber) {
        const row = await db.queryOne(
            `SELECT * FROM preview_deployments WHERE project_id = $1 AND pr_number = $2`,
            [project.id, prNumber]
        );
        let previewSubdomain = row?.subdomain;
        if (!previewSubdomain) {
            try {
                previewSubdomain = previewRules.buildPreviewSubdomain(project.subdomain, prNumber);
            } catch {
                return { success: true, destroyed: false }; // 유효하지 않은 입력 — 정리할 것 없음
            }
        }
        await this._teardownPreview(previewSubdomain);
        if (row) {
            await db.query(`DELETE FROM preview_deployments WHERE id = $1`, [row.id]);
        }
        console.log(`🗑️ Preview destroyed: ${previewSubdomain} (PR #${prNumber})`);
        return { success: true, destroyed: !!row, subdomain: previewSubdomain };
    }

    // 프리뷰 리소스 물리 정리 (컨테이너 → 이미지 → nginx → 디렉토리). best-effort.
    async _teardownPreview(previewSubdomain) {
        // rm -rf 전 최종 안전 가드: pr-<n>- 프리픽스가 아닌 이름은 절대 정리하지
        // 않는다 (실 프로젝트 서브도메인이 흘러들어오는 사고 차단).
        if (!previewRules.isPreviewSubdomain(previewSubdomain)) {
            console.warn(`⚠️ _teardownPreview: not a preview subdomain, refusing: ${previewSubdomain}`);
            return;
        }
        await dockerService.cleanupOldContainers(previewSubdomain, '__none__').catch(() => { });
        await dockerService.stopContainer(`orbitron-${previewSubdomain}`).catch(() => { });
        await dockerService.removeImage(previewSubdomain).catch(() => { });
        // removeProject 는 수동 관리 conf 를 스스로 보호한다 (프리뷰는 해당 없음)
        await nginxService.removeProject(previewSubdomain).catch(() => { });
        const previewDir = path.join(PREVIEWS_DIR, previewSubdomain);
        if (fs.existsSync(previewDir)) {
            fs.rmSync(previewDir, { recursive: true, force: true });
        }
        // startContainer 가 deployments/<sub>/_volumes 를 자동 생성한다 —
        // 프리뷰 서브도메인 프리픽스 가드 통과가 확인된 이름만 정리
        const strayDir = path.join(DEPLOYMENTS_DIR, previewSubdomain);
        if (fs.existsSync(strayDir)) {
            fs.rmSync(strayDir, { recursive: true, force: true });
        }
    }

    // TTL 스윕: updated_at 기준 7일 지난 프리뷰 파괴. server.js 의 시간별
    // 정리 루프에서 호출된다. 배포 중(락 보유)인 프리뷰는 건너뛴다.
    async sweepExpiredPreviews(now = Date.now()) {
        let rows;
        try {
            rows = await db.queryAll(`SELECT * FROM preview_deployments`);
        } catch (e) {
            console.error('Preview TTL sweep query failed:', e.message);
            return 0;
        }
        const expired = previewRules.selectExpiredPreviews(rows, now);
        let swept = 0;
        for (const row of expired) {
            if (this.activeDeployments.has(`preview:${row.subdomain}`)) continue;
            try {
                await this._teardownPreview(row.subdomain);
                await db.query(`DELETE FROM preview_deployments WHERE id = $1`, [row.id]);
                console.log(`🧹 Preview TTL sweep: destroyed ${row.subdomain} (PR #${row.pr_number}, last update ${row.updated_at})`);
                swept++;
            } catch (e) {
                console.error(`Preview TTL sweep failed for ${row.subdomain}:`, e.message);
            }
        }
        return swept;
    }

    // 프리뷰 성공 후 GitHub PR 코멘트 (best-effort, 10초 타임아웃).
    // 토큰 탐색: previewRules.discoverGithubToken (project env → github_url
    // 삽입 자격증명 → 서버 env). 없으면 로그만 남기고 조용히 스킵.
    async _postPreviewComment(project, prNumber, previewSubdomain) {
        const found = previewRules.discoverGithubToken(project);
        if (!found) {
            console.log(`ℹ️ Preview comment skipped for PR #${prNumber}: no GitHub token discoverable`);
            return;
        }
        const ownerRepo = previewRules.parseOwnerRepo(project.github_url);
        if (!ownerRepo) {
            console.log(`ℹ️ Preview comment skipped for PR #${prNumber}: cannot parse owner/repo from github_url`);
            return;
        }
        // 수용된 v1 제약: 터널은 프로젝트별 systemd 유닛 + 명시적 hostname ingress
        // 라 pr-N 서브도메인은 아직 외부에서 도달 불가(내부 Host 헤더 라우팅만).
        // 와일드카드 *.{TUNNEL_DOMAIN} DNS/ingress 가 추가되면 이 URL 이 그대로
        // 살아나므로 코멘트 형식은 정식 URL 로 유지한다.
        const body = `🔍 Preview: ${previewRules.previewUrl(previewSubdomain, process.env.TUNNEL_DOMAIN)}`;
        const res = await fetch(`https://api.github.com/repos/${ownerRepo}/issues/${prNumber}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${found.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'orbitron-preview',
            },
            body: JSON.stringify({ body }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
            throw new Error(`GitHub comment API ${res.status} (token source: ${found.source})`);
        }
        console.log(`💬 Preview comment posted on PR #${prNumber} (${ownerRepo})`);
    }

    // Delete a project completely
    async deleteProject(project) {
        // 활성 프리뷰 정리 (행은 FK CASCADE 로 지워지지만 컨테이너/nginx/디렉토리는
        // 여기서 직접 걷어야 잔여물이 남지 않는다)
        try {
            const previews = await db.queryAll(
                `SELECT subdomain FROM preview_deployments WHERE project_id = $1`, [project.id]
            );
            for (const p of previews) {
                // per-preview 격리: 한 프리뷰의 실패(EACCES 등)가 나머지 정리를
                // 건너뛰게 하면 안 된다
                try {
                    await this._teardownPreview(p.subdomain);
                } catch (e) {
                    console.error(`Preview teardown failed for ${p.subdomain}: ${e.message}`);
                }
            }
        } catch (e) {
            console.error(`Preview cleanup during project delete failed: ${e.message}`);
        }

        await this.stop(project);
        await dockerService.removeImage(project.subdomain);

        const projectDir = path.join(DEPLOYMENTS_DIR, project.subdomain);
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
    }
}

module.exports = new Deployer();
