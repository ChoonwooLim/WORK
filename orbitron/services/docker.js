const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs');

const PROJECTS_DIR = path.join(__dirname, '..', 'deployments');

// Ensure deployments directory exists
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

class DockerService {
    // Build a Docker image for a project (or skip if Compose)
    async buildImage(project) {
        const projectDir = path.join(PROJECTS_DIR, project.subdomain);
        const buildStart = Date.now();
        let detailLogs = '';

        detailLogs += `\n${'═'.repeat(60)}\n`;
        detailLogs += `🔨 Docker 빌드 시작 — ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`;
        detailLogs += `  프로젝트: ${project.name} (${project.subdomain})\n`;
        detailLogs += `  소스 경로: ${projectDir}\n`;

        // --- Compose Check Bypass ---
        if (fs.existsSync(path.join(projectDir, 'docker-compose.yml')) || fs.existsSync(path.join(projectDir, 'docker-compose.yaml'))) {
            detailLogs += `  빌드 방식: Docker Compose\n`;
            const cmd = `cd ${projectDir} && docker compose pull && docker compose build`;
            detailLogs += `  실행 명령: ${cmd}\n`;
            detailLogs += `${'─'.repeat(60)}\n`;
            return new Promise((resolve, reject) => {
                exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                    const elapsed = ((Date.now() - buildStart) / 1000).toFixed(1);
                    if (error) {
                        detailLogs += stdout + stderr;
                        detailLogs += `\n❌ Compose 빌드 실패 (${elapsed}초 경과)\n`;
                        reject(new Error(`Compose Build failed:\n${detailLogs}\n${stderr}`));
                    } else {
                        detailLogs += stdout + stderr;
                        detailLogs += `\n✅ Compose 빌드 완료 (${elapsed}초 소요)\n`;
                        resolve({ isCompose: true, logs: detailLogs });
                    }
                });
            });
        }

        const imageName = `orbitron-${project.subdomain}`;

        // Check if a custom Dockerfile exists (marked with "# CUSTOM" on first line)
        const dockerfilePath = path.join(projectDir, 'Dockerfile');
        let useCustom = false;
        if (fs.existsSync(dockerfilePath)) {
            const firstLine = fs.readFileSync(dockerfilePath, 'utf-8').split('\n')[0].trim();
            if (firstLine.startsWith('# CUSTOM')) {
                useCustom = true;
            }
        }
        if (!useCustom) {
            const detected = this.detectProjectType(projectDir, project);
            detailLogs += `  자동 감지 타입: ${detected.type}${detected.subdir ? ` (서브디렉토리: ${detected.subdir})` : ''}\n`;
            if (detected.frontend) detailLogs += `  프론트엔드: ${detected.frontend.path} (${detected.frontend.framework})\n`;
            if (detected.backend) detailLogs += `  백엔드: ${detected.backend.path} (${detected.backend.runtime}/${detected.backend.framework})\n`;
            const dockerfile = this.generateDockerfile(project, projectDir);
            fs.writeFileSync(dockerfilePath, dockerfile);
            detailLogs += `  빌드 방식: 자동 생성 Dockerfile\n`;
        } else {
            // Log custom Dockerfile info
            const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
            const stageCount = (dockerfileContent.match(/^FROM /gm) || []).length;
            const exposeMatch = dockerfileContent.match(/EXPOSE\s+(\S+)/m);
            detailLogs += `  빌드 방식: 사용자 정의 Dockerfile (# CUSTOM)\n`;
            detailLogs += `  빌드 스테이지 수: ${stageCount}\n`;
            if (exposeMatch) detailLogs += `  노출 포트: ${exposeMatch[1]}\n`;
        }

        detailLogs += `  이미지 이름: ${imageName}\n`;
        const buildCmd = `docker build --no-cache -t ${imageName} ${projectDir}`;
        detailLogs += `  실행 명령: ${buildCmd}\n`;
        detailLogs += `${'─'.repeat(60)}\n`;

        return new Promise((resolve, reject) => {
            exec(buildCmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                const elapsed = ((Date.now() - buildStart) / 1000).toFixed(1);
                if (error) {
                    detailLogs += stdout + stderr;
                    detailLogs += `\n❌ 빌드 실패 (${elapsed}초 경과)\n`;
                    detailLogs += `${'═'.repeat(60)}\n`;
                    reject(new Error(`Build failed:\n${detailLogs}\n${stderr}`));
                } else {
                    detailLogs += stdout + stderr;
                    // Log image size
                    exec(`docker images ${imageName} --format '{{.Size}}'`, (e, sizeOut) => {
                        if (!e && sizeOut.trim()) detailLogs += `\n📦 이미지 크기: ${sizeOut.trim()}`;
                        detailLogs += `\n✅ 빌드 완료 (${elapsed}초 소요)\n`;
                        detailLogs += `${'═'.repeat(60)}\n`;
                        resolve({ imageName, logs: detailLogs });
                    });
                }
            });
        });
    }

    // Detect project type and generate appropriate Dockerfile
    detectProjectType(projectDir, project = null) {
        // Quick override for specialized project types
        if (project && project.env_vars) {
            if (project.env_vars.PROJECT_TYPE === 'pixel_streaming') {
                return { type: 'pixel_streaming', subdir: null };
            }
            if (project.env_vars.PROJECT_TYPE === 'unity_webgl') {
                return { type: 'unity_webgl', subdir: null };
            }
        }

        // ── Fullstack detection: scan for frontend + backend in subdirectories ──
        const fullstack = this._detectFullstack(projectDir);
        if (fullstack) return fullstack;

        // Check root directory first
        if (fs.existsSync(path.join(projectDir, 'package.json'))) {
            const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
            if (pkg.dependencies?.next || pkg.devDependencies?.next) {
                return { type: 'nextjs', subdir: null };
            }
            return { type: 'node', subdir: null };
        }

        // Check immediate subdirectories for package.json (monorepo pattern)
        const subdirs = fs.readdirSync(projectDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules');
        for (const dir of subdirs) {
            const pkgPath = path.join(projectDir, dir.name, 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                if (pkg.dependencies?.next || pkg.devDependencies?.next) {
                    return { type: 'nextjs', subdir: dir.name };
                }
                return { type: 'node', subdir: dir.name };
            }
        }

        if (fs.existsSync(path.join(projectDir, 'requirements.txt')) ||
            fs.existsSync(path.join(projectDir, 'manage.py'))) {
            return { type: 'python', subdir: null };
        }
        if (fs.existsSync(path.join(projectDir, 'index.html')) ||
            fs.existsSync(path.join(projectDir, 'index.htm'))) {
            return { type: 'static', subdir: null };
        }
        return { type: 'static', subdir: null };
    }

    // ── Fullstack auto-detection: find frontend + backend pair + extra frontend apps ──
    _detectFullstack(projectDir) {
        const frontendMarkers = ['package.json'];
        const backendMarkers = { python: 'requirements.txt', node: 'package.json' };
        const frontendHints = ['frontend', 'client', 'web', 'app'];
        const backendHints = ['backend', 'server', 'api'];
        // Directories with package.json + build script that are NOT backend are candidate extra frontend apps
        const extraAppExcludes = ['node_modules', 'dist', 'build', '.git', '_volumes', '__pycache__'];

        // Helper: detect frontend framework from package.json
        const detectFrontendFramework = (pkgPath) => {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (deps['vite'] || deps['@vitejs/plugin-react']) return 'vite';
                if (deps['react-scripts']) return 'cra';
                if (deps['vue']) return 'vue';
                if (deps['next']) return 'next';
                // Check if it has a build script producing static files
                if (pkg.scripts?.build) return 'generic';
                return null;
            } catch { return null; }
        };

        // Helper: detect Python backend entry point
        const detectPythonEntry = (backendDir) => {
            // FastAPI / Uvicorn
            if (fs.existsSync(path.join(backendDir, 'main.py'))) {
                try {
                    const src = fs.readFileSync(path.join(backendDir, 'main.py'), 'utf-8');
                    if (src.includes('FastAPI')) return { framework: 'fastapi', module: 'main:app' };
                    if (src.includes('Flask')) return { framework: 'flask', module: 'main:app' };
                } catch { }
                return { framework: 'python', module: 'main:app' };
            }
            if (fs.existsSync(path.join(backendDir, 'app.py'))) {
                return { framework: 'python', module: 'app:app' };
            }
            if (fs.existsSync(path.join(backendDir, 'manage.py'))) {
                return { framework: 'django', module: null };
            }
            return null;
        };

        // Helper: check if a directory is a buildable frontend app
        const isBuildableApp = (dirPath) => {
            const pkgPath = path.join(dirPath, 'package.json');
            if (!fs.existsSync(pkgPath)) return null;
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                if (!pkg.scripts?.build) return null;
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                // Must look like a frontend app (has a UI framework or build tool)
                if (deps['react'] || deps['vue'] || deps['svelte'] || deps['@angular/core'] ||
                    deps['vite'] || deps['react-scripts'] || deps['@vitejs/plugin-react']) {
                    return detectFrontendFramework(pkgPath);
                }
                return null;
            } catch { return null; }
        };

        // Scan: check 1-depth and 2-depth subdirectories
        const scanDirs = [projectDir];
        try {
            const topDirs = fs.readdirSync(projectDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && !d.name.startsWith('.') && !extraAppExcludes.includes(d.name));
            for (const d of topDirs) {
                scanDirs.push(path.join(projectDir, d.name));
            }
        } catch { }

        for (const scanRoot of scanDirs) {
            let frontendDir = null, backendDir = null;
            let frontendRelPath = null, backendRelPath = null;
            let frontendFramework = null, backendInfo = null;

            try {
                const children = fs.readdirSync(scanRoot, { withFileTypes: true })
                    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !extraAppExcludes.includes(d.name));

                for (const child of children) {
                    const childPath = path.join(scanRoot, child.name);
                    const relPath = path.relative(projectDir, childPath);
                    const nameLower = child.name.toLowerCase();

                    // Detect primary frontend
                    if (frontendHints.some(h => nameLower.includes(h))) {
                        const pkgPath = path.join(childPath, 'package.json');
                        if (fs.existsSync(pkgPath)) {
                            const fw = detectFrontendFramework(pkgPath);
                            if (fw) {
                                frontendDir = childPath;
                                frontendRelPath = relPath;
                                frontendFramework = fw;
                            }
                        }
                    }

                    // Detect backend
                    if (backendHints.some(h => nameLower.includes(h))) {
                        const reqPath = path.join(childPath, 'requirements.txt');
                        const pkgPath = path.join(childPath, 'package.json');

                        if (fs.existsSync(reqPath)) {
                            backendDir = childPath;
                            backendRelPath = relPath;
                            backendInfo = detectPythonEntry(childPath) || { framework: 'python', module: 'main:app' };
                            backendInfo.runtime = 'python';
                        } else if (fs.existsSync(pkgPath) && !frontendDir) {
                            backendDir = childPath;
                            backendRelPath = relPath;
                            backendInfo = { runtime: 'node', framework: 'express', module: null };
                        }
                    }
                }

                // If we found both frontend and backend, detect extra frontend apps
                if (frontendDir && backendDir) {
                    const extraFrontends = [];

                    // Scan all directories in scanRoot for additional buildable frontend apps
                    for (const child of children) {
                        const childPath = path.join(scanRoot, child.name);
                        const relPath = path.relative(projectDir, childPath);

                        // Skip the primary frontend and backend directories
                        if (childPath === frontendDir || childPath === backendDir) continue;

                        // Check if this directory is a buildable frontend app
                        const fw = isBuildableApp(childPath);
                        if (fw) {
                            // Derive a short serve path from the directory name
                            const servePath = child.name.toLowerCase()
                                .replace(/[^a-z0-9-]/g, '-')
                                .replace(/-+/g, '-')
                                .replace(/^-|-$/g, '');
                            extraFrontends.push({
                                path: relPath,
                                framework: fw,
                                servePath,  // Will be served at /{servePath}/
                                name: child.name,
                            });
                            console.log(`🔍 Extra frontend app detected: ${relPath} (${fw}) → /${servePath}/`);
                        }
                    }

                    console.log(`🔍 Fullstack detected: frontend=${frontendRelPath} (${frontendFramework}), backend=${backendRelPath} (${backendInfo.runtime}/${backendInfo.framework})${extraFrontends.length ? `, +${extraFrontends.length} extra app(s)` : ''}`);
                    return {
                        type: 'fullstack',
                        subdir: null,
                        frontend: { path: frontendRelPath, framework: frontendFramework },
                        backend: { path: backendRelPath, ...backendInfo },
                        extraFrontends,  // Additional frontend apps to build and serve
                    };
                }
            } catch { }
        }

        return null; // No fullstack pattern found
    }

    // ── Generate SPA wrapper script for Python backends (with multi-app support) ──
    generateSpaWrapper(backendModule, extraFrontends = []) {
        const [moduleName, appName] = backendModule.split(':');

        // Generate extra-app serving blocks
        let extraAppBlocks = '';
        let extraExcludes = '';
        if (extraFrontends.length > 0) {
            for (const app of extraFrontends) {
                const staticDir = `${app.servePath.replace(/-/g, '_')}_static`;
                extraAppBlocks += `
# ── Extra App: ${app.name} (served at /${app.servePath}/) ──
_EXTRA_DIR_${staticDir.toUpperCase()} = "/app/${staticDir}"
if os.path.isdir(_EXTRA_DIR_${staticDir.toUpperCase()}) and os.path.isfile(os.path.join(_EXTRA_DIR_${staticDir.toUpperCase()}, "index.html")):
    for d in os.listdir(_EXTRA_DIR_${staticDir.toUpperCase()}):
        dp = os.path.join(_EXTRA_DIR_${staticDir.toUpperCase()}, d)
        if os.path.isdir(dp):
            app.mount(f"/${app.servePath}/{d}", StaticFiles(directory=dp), name=f"extra-${app.servePath}-{d}")

    for fname in ["manifest.json", "sw.js", "vite.svg"]:
        fpath = os.path.join(_EXTRA_DIR_${staticDir.toUpperCase()}, fname)
        if os.path.isfile(fpath):
            def _make_h(p, sn="${app.servePath}"):
                def h(): return FileResponse(p)
                h.__name__ = f"serve_{sn}_{os.path.basename(p).replace('.','_')}"
                return h
            app.get(f"/${app.servePath}/{fname}")(_make_h(fpath))

    @app.get("/${app.servePath}")
    @app.get("/${app.servePath}/")
    def _serve_${staticDir}_root():
        return FileResponse(os.path.join(_EXTRA_DIR_${staticDir.toUpperCase()}, "index.html"))

    @app.get("/${app.servePath}/{path:path}")
    def _serve_${staticDir}_spa(path: str):
        sf = os.path.join(_EXTRA_DIR_${staticDir.toUpperCase()}, path)
        if os.path.isfile(sf): return FileResponse(sf)
        return FileResponse(os.path.join(_EXTRA_DIR_${staticDir.toUpperCase()}, "index.html"))
`;
                extraExcludes += `
            not p.startswith("/${app.servePath}/") and`;
            }
        }

        return `"""Auto-generated by Orbitron: SPA wrapper for fullstack deployment (multi-app support)."""
import os
from ${moduleName} import ${appName} as app
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
${extraAppBlocks}
STATIC = "/app/static"

if os.path.isdir(STATIC) and os.path.isfile(os.path.join(STATIC, "index.html")):
    # Mount known static subdirectories
    for d in os.listdir(STATIC):
        dp = os.path.join(STATIC, d)
        if os.path.isdir(dp):
            app.mount(f"/{d}", StaticFiles(directory=dp), name=f"static-{d}")

    # Remove conflicting root route from original app
    app.routes[:] = [
        r for r in app.routes
        if not (hasattr(r, 'path') and r.path == '/' and hasattr(r, 'methods') and 'GET' in r.methods)
    ]

    # Serve index.html at root
    @app.get("/")
    def _orbitron_serve_root():
        return FileResponse(os.path.join(STATIC, "index.html"))

    # 404 handler: serve static files or SPA fallback
    @app.exception_handler(404)
    async def _orbitron_spa_handler(request: Request, exc):
        p = request.url.path
        if (request.method == "GET" and
            not p.startswith("/api/") and
            not p.startswith("/uploads/") and${extraExcludes}
            not p.startswith("/docs") and
            not p.startswith("/openapi") and
            not p.startswith("/redoc")):
            static_file = os.path.join(STATIC, p.lstrip("/"))
            if os.path.isfile(static_file):
                return FileResponse(static_file)
            return FileResponse(os.path.join(STATIC, "index.html"))
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
`;
    }

    generateDockerfile(project, projectDir) {
        const detected = this.detectProjectType(projectDir, project);
        const port = project.port || 3000;
        const { type, subdir } = detected;
        const copyFrom = subdir ? `${subdir}/` : '.';

        // ── Fullstack: multi-stage build (frontend + backend + extra apps) ──
        if (type === 'fullstack') {
            const fe = detected.frontend;
            const be = detected.backend;
            const extras = detected.extraFrontends || [];

            if (be.runtime === 'python') {
                const startModule = '_orbitron_spa:app';
                // Detect if backend needs postgres (libpq-dev)
                let reqContent = '';
                try { reqContent = fs.readFileSync(path.join(projectDir, be.path, 'requirements.txt'), 'utf-8'); } catch { }
                const needsPg = reqContent.includes('psycopg') || reqContent.includes('asyncpg');
                const pgInstall = needsPg ? 'RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*\n\n' : '';

                // Write SPA wrapper script (with extra app support)
                const spaWrapper = this.generateSpaWrapper(be.module || 'main:app', extras);
                fs.writeFileSync(path.join(projectDir, '_orbitron_spa.py'), spaWrapper);
                console.log(`📝 Auto-generated _orbitron_spa.py for ${project.name} (${1 + extras.length} app(s))`);

                // Build extra frontend stages
                let extraStages = '';
                let extraCopies = '';
                for (let i = 0; i < extras.length; i++) {
                    const ex = extras[i];
                    const stageName = `extra-app-${i}`;
                    const staticDir = `${ex.servePath.replace(/-/g, '_')}_static`;
                    extraStages += `
# Stage ${i + 2}: Build extra app "${ex.name}" → /${ex.servePath}/
FROM node:20-slim AS ${stageName}
WORKDIR /build
COPY ${ex.path}/package*.json ./
RUN npm ci
COPY ${ex.path}/ ./
ENV VITE_API_URL=""
RUN npm run build && \\\\
    find dist -name '*.js' -exec sed -i 's|http://localhost:[0-9]*||g' {} +
`;
                    extraCopies += `COPY --from=${stageName} /build/dist /app/${staticDir}\n`;
                }

                const totalStages = 2 + extras.length;
                const extraLabels = extras.map(e => e.name).join(', ');

                return `# ===== AUTO-GENERATED by Orbitron (fullstack: ${fe.framework} + ${be.framework}${extras.length ? ` + ${extras.length} extra app(s): ${extraLabels}` : ''}) =====
# Stage 1: Build primary frontend
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY ${fe.path}/package*.json ./
RUN npm ci
COPY ${fe.path}/ ./
ENV VITE_API_URL=""
RUN npm run build && \\\\
    find dist -name '*.js' -exec sed -i 's|http://localhost:[0-9]*||g' {} +
${extraStages}
# Stage ${totalStages}: Production image
FROM python:3.11-slim
WORKDIR /app

${pgInstall}COPY ${be.path}/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY ${be.path}/ ./
COPY _orbitron_spa.py ./

COPY --from=frontend-build /build/dist /app/static
${extraCopies}
EXPOSE \${PORT:-${port}}

CMD ["sh", "-c", "uvicorn ${startModule} --host 0.0.0.0 --port \${PORT:-${port}}"]
`;
            }

            // Node.js backend (Express etc.)
            return `# ===== AUTO-GENERATED by Orbitron (fullstack: ${fe.framework} + node) =====
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY ${fe.path}/package*.json ./
RUN npm ci
COPY ${fe.path}/ ./
RUN npm run build && \\\\
    find dist -name '*.js' -exec sed -i 's|http://localhost:[0-9]*||g' {} +

FROM node:20-slim
WORKDIR /app
COPY ${be.path}/package*.json ./
RUN npm install --production
COPY ${be.path}/ ./
COPY --from=frontend-build /build/dist /app/public

EXPOSE \${PORT:-${port}}
CMD ["node", "${be.module ? be.module.split(':')[0] + '.js' : 'server.js'}"]
`;
        }

        if (type === 'pixel_streaming') {
            // Find the executable script (.sh file containing "Server" or just grabbing the first .sh)
            let startScript = 'start_server.sh'; // fallback
            try {
                const files = fs.readdirSync(projectDir);
                const shFiles = files.filter(f => f.endsWith('.sh') && !!(fs.statSync(path.join(projectDir, f)).mode & 0o111));
                if (shFiles.length > 0) {
                    const serverSh = shFiles.find(f => f.toLowerCase().includes('server')) || shFiles[0];
                    startScript = serverSh;
                }
            } catch (e) {
                console.warn(`Could not detect start script for ${project.name}: ${e.message}`);
            }

            return `FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

RUN apt-get update && apt-get install -y \\
    xserver-xorg-core \\
    xserver-xorg-video-dummy \\
    pulseaudio \\
    vulkan-tools \\
    libvulkan1 \\
    sudo \\
    wget \\
    curl \\
    jq \\
    dbus-x11 \\
    pciutils \\
    kmod \\
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash unreal && \\
    echo "unreal ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

WORKDIR /home/unreal/project
COPY --chown=unreal:unreal . .

# Ensure scripts are executable
RUN chmod +x *.sh || true

USER unreal

EXPOSE 80 8888 8889 8890 8891 8892 8893 19302/udp 19303/udp

CMD [ "bash", "-c", "./${startScript} -RenderOffscreen -PixelStreamingURL=ws://127.0.0.1:8888" ]
`;
        }

        if (type === 'nextjs') {
            // Multi-stage Next.js build
            return `FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl openssl-dev
COPY ${copyFrom}package*.json ./
RUN npm install --legacy-peer-deps
COPY ${copyFrom} ./
RUN npx prisma generate 2>/dev/null || true
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBOPACK=0
RUN npx next build
RUN mkdir -p public prisma

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=${port}
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate 2>/dev/null || true
EXPOSE ${port}
CMD sh -c "npx prisma db push --skip-generate 2>/dev/null || true; npx next start -p ${port}"
`;
        }

        if (type === 'node') {
            const workdirCopy = subdir ? `COPY ${subdir}/package*.json ./\nRUN ${project.build_command || 'npm install'}\nCOPY ${subdir}/ .` : `COPY package*.json ./\nRUN ${project.build_command || 'npm install'}\nCOPY . .`;
            return `FROM node:20-alpine
WORKDIR /app
${workdirCopy}
EXPOSE ${port}
CMD ${JSON.stringify((project.start_command || 'npm start').split(' '))}
`;
        }

        if (type === 'unity_webgl') {
            // Unity WebGL needs specific MIME types for WASM and gzip support
            return `FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Create custom nginx config for Unity WebGL
RUN echo 'server { \\
    listen ${port}; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files $uri $uri/ /index.html; \\
    } \\
    # Unity WebGL specific MIME types \\
    location ~ \\.wasm$ { \\
        add_header Content-Type application/wasm; \\
    } \\
    location ~ \\.wasm\\.gz$ { \\
        add_header Content-Type application/wasm; \\
        add_header Content-Encoding gzip; \\
    } \\
    location ~ \\.js\\.gz$ { \\
        add_header Content-Type application/javascript; \\
        add_header Content-Encoding gzip; \\
    } \\
    location ~ \\.data\\.gz$ { \\
        add_header Content-Type application/octet-stream; \\
        add_header Content-Encoding gzip; \\
    } \\
    location ~ \\.wasm\\.br$ { \\
        add_header Content-Type application/wasm; \\
        add_header Content-Encoding br; \\
    } \\
    location ~ \\.js\\.br$ { \\
        add_header Content-Type application/javascript; \\
        add_header Content-Encoding br; \\
    } \\
    location ~ \\.data\\.br$ { \\
        add_header Content-Type application/octet-stream; \\
        add_header Content-Encoding br; \\
    } \\
}' > /etc/nginx/conf.d/unity.conf

COPY ${copyFrom} /usr/share/nginx/html
EXPOSE ${port}
`;
        }

        // Static site - serve with nginx
        return `FROM nginx:alpine
COPY ${copyFrom} /usr/share/nginx/html
RUN echo 'server { listen ${port}; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE ${port}
`;
    }

    // Start a container for a project (creates a new uniquely named container for Blue-Green deployment)
    async startContainer(project) {
        const imageName = `orbitron-${project.subdomain}`;
        // Generate a unique suffix for Zero-Downtime Blue-Green deployment
        const deployHash = Date.now().toString(36);
        const containerName = `orbitron-${project.subdomain}-${deployHash}`;
        let port = project.port || 3000;

        let startLogs = '';
        startLogs += `\n${'═'.repeat(60)}\n`;
        startLogs += `🚀 컨테이너 시작 — ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`;
        startLogs += `  이미지: ${imageName}\n`;
        startLogs += `  컨테이너명: ${containerName}\n`;

        // Build env vars string (filter out internal Orbitron keys)
        const envVars = project.env_vars || {};
        const envKeys = Object.keys(envVars).filter(k => !k.startsWith('_ORBITRON_'));
        const envFlags = envKeys
            .map(k => {
                const escapedVal = String(envVars[k]).replace(/'/g, "'\\''");
                return `-e ${k}='${escapedVal}'`;
            })
            .join(' ');
        startLogs += `  환경변수: ${envKeys.length}개 (${envKeys.join(', ') || '없음'})\n`;

        // ── Feature 1: Auto-mount persistent volumes ──
        const hostBaseDir = path.join(PROJECTS_DIR, project.subdomain || project.id, '_volumes');
        let volumeFlags = '';
        const mountList = [];

        if (envVars.UPLOAD_DIR) {
            // Explicit UPLOAD_DIR from env
            const uploadPath = envVars.UPLOAD_DIR;
            try { await fs.promises.mkdir(uploadPath, { recursive: true }); } catch { }
            volumeFlags = `-v ${uploadPath}:${uploadPath}`;
            mountList.push(`${uploadPath} → ${uploadPath}`);
        } else {
            // Auto-mount common upload/media/data directories
            const PERSIST_DIRS = ['/app/uploads', '/app/media', '/app/data', '/app/public/uploads'];
            const mounts = [];
            for (const dir of PERSIST_DIRS) {
                const dirName = dir.replace('/app/', '').replace(/\//g, '_');
                const hostDir = path.join(hostBaseDir, dirName);
                try { await fs.promises.mkdir(hostDir, { recursive: true }); } catch { }
                mounts.push(`-v ${hostDir}:${dir}`);
                mountList.push(`${hostDir} → ${dir}`);
            }
            volumeFlags = mounts.join(' ');
        }
        startLogs += `  볼륨 마운트: ${mountList.length}개\n`;
        mountList.forEach(m => { startLogs += `    📁 ${m}\n`; });

        // ── Feature 2: Port conflict auto-resolution ──
        const isWorker = project.type === 'worker';
        const originalPort = port;
        if (!isWorker) {
            let attempts = 0;
            while (attempts < 20) {
                try {
                    const { stdout } = await execAsync(`lsof -i :${port} -t 2>/dev/null || true`);
                    if (!stdout.trim()) break;
                    port++;
                    attempts++;
                } catch { break; }
            }
            if (port !== originalPort) {
                startLogs += `  ⚡ 포트 충돌 감지: ${originalPort} → ${port} (자동 변경)\n`;
                console.log(`⚡ Port ${originalPort} in use → auto-assigned ${port} for ${project.name}`);
            } else {
                startLogs += `  포트: ${port}\n`;
            }
        } else {
            startLogs += `  포트: 없음 (백그라운드 워커)\n`;
        }
        const portFlags = isWorker ? '' : `-p ${port}:${port}`;

        // ── Feature 3: Log rotation (prevent disk fill) ──
        const logFlags = '--log-opt max-size=10m --log-opt max-file=3';

        const cmd = `docker run -d --name ${containerName} --restart unless-stopped --network orbitron_internal ${logFlags} ${volumeFlags} ${envFlags} ${portFlags} ${imageName}`;
        startLogs += `  네트워크: orbitron_internal\n`;
        startLogs += `  재시작 정책: unless-stopped\n`;
        startLogs += `  로그 로테이션: max-size=10m, max-file=3\n`;
        startLogs += `${'─'.repeat(60)}\n`;
        startLogs += `  실행 명령:\n  ${cmd}\n`;
        startLogs += `${'─'.repeat(60)}\n`;

        return new Promise((resolve, reject) => {
            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    startLogs += `\n❌ 컨테이너 시작 실패\n  오류: ${stderr}\n`;
                    startLogs += `${'═'.repeat(60)}\n`;
                    reject(new Error(`Start failed:\n${startLogs}\n${stderr}`));
                } else {
                    const containerId = stdout.trim();
                    startLogs += `\n✅ 컨테이너 시작 성공\n`;
                    startLogs += `  Container ID: ${containerId.substring(0, 12)}\n`;
                    startLogs += `${'═'.repeat(60)}\n`;
                    resolve({ containerId, containerName, port, startLogs });
                }
            });
        });
    }

    // Start a Docker Compose project
    async startCompose(project) {
        const projectDir = path.join(PROJECTS_DIR, project.subdomain);

        // Down exact compose group first to avoid orphans
        try {
            await execAsync(`cd ${projectDir} && docker compose down`);
        } catch (e) { }

        const deployHash = Date.now().toString(36);

        // Map Orbitron network to compose (optional, user defined in compose overrides usually)
        // Here we just let standard compose up happen. We assume the web service exposes ports to host.
        return new Promise((resolve, reject) => {
            exec(`cd ${projectDir} && docker compose up -d`, { maxBuffer: 1024 * 1024 * 50 }, async (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Compose Start failed: ${stderr}`));
                } else {
                    // Try to guess the main web container name using docker compose ps
                    let mainContainer = `orbitron-${project.subdomain}-compose-${deployHash}`;
                    try {
                        const { stdout: psOut } = await execAsync(`cd ${projectDir} && docker compose ps --services`);
                        const services = psOut.trim().split('\n');
                        const webService = services.find(s => s.includes('web') || s.includes('app') || s.includes('api')) || services[0];
                        if (webService) {
                            const { stdout: nameOut } = await execAsync(`cd ${projectDir} && docker compose ps -q ${webService} | xargs docker inspect -f '{{.Name}}' | sed 's|^/||'`);
                            if (nameOut.trim()) {
                                mainContainer = nameOut.trim();
                                // Attach main compose container to Orbitron internal network to allow Nginx Proxy to hit it
                                await execAsync(`docker network connect orbitron_internal ${mainContainer}`).catch(() => { });
                            }
                        }
                    } catch (e) { }

                    resolve({ containerId: 'compose-' + deployHash, containerName: mainContainer, port: project.port || 3000, logs: stdout + stderr });
                }
            });
        });
    }

    // Start an official Database Container
    async startDatabaseContainer(project) {
        const containerName = `orbitron-${project.subdomain}`;
        let imageName = '';
        let port = project.port;
        const envVars = project.env_vars || {};

        let volumeName = `${containerName}_data`;
        let volumePath = '';

        if (project.type === 'db_postgres') {
            imageName = 'postgres:15-alpine';
            port = port || 5432;
            volumePath = '/var/lib/postgresql/data';
            envVars.POSTGRES_PASSWORD = envVars.POSTGRES_PASSWORD || 'orbitron_db_pass';
            envVars.POSTGRES_USER = envVars.POSTGRES_USER || 'orbitron_user';
            envVars.POSTGRES_DB = envVars.POSTGRES_DB || 'orbitron_db';
        } else if (project.type === 'db_redis') {
            imageName = 'redis:7-alpine';
            port = port || 6379;
            volumePath = '/data';
        } else {
            throw new Error(`Unsupported database type: ${project.type}`);
        }

        await this.stopContainer(containerName);

        // Create persistent docker volume natively to avoid permission issues
        try {
            await execAsync(`docker volume create ${volumeName}`);
        } catch (e) { /* ignore */ }

        const envFlags = Object.entries(envVars)
            .map(([k, v]) => `-e ${k}="${v}"`)
            .join(' ');

        const volumeFlags = `-v ${volumeName}:${volumePath}`;

        // We do not map the port to the host machine for internal private networking
        // However, if the user explicitly provided a port or we want mapping, we can uncomment below:
        // const portFlags = port ? `-p ${port}:${port}` : '';
        const portFlags = '';

        return new Promise((resolve, reject) => {
            const cmd = `docker run -d --name ${containerName} --restart unless-stopped --network orbitron_internal ${volumeFlags} ${envFlags} ${portFlags} ${imageName}`;
            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) reject(new Error(`Start failed: ${stderr}`));
                else resolve(stdout.trim());
            });
        });
    }

    // Stop and remove a container asynchronously
    async stopContainer(containerName) {
        try {
            await execAsync(`docker stop ${containerName} 2>/dev/null && docker rm ${containerName} 2>/dev/null`);
        } catch (e) {
            // Container doesn't exist or already stopped, that's fine
        }
    }

    // Clean up old containers belonging to this project (except the active one)
    async cleanupOldContainers(subdomain, keepContainerName) {
        try {
            // Find all containers starting with orbitron-subdomain
            const { stdout } = await execAsync(`docker ps -a --format '{{.Names}}' | grep '^orbitron-${subdomain}-' || true`);
            const containers = stdout.trim().split('\n').filter(Boolean);

            for (const name of containers) {
                if (name !== keepContainerName) {
                    console.log(`🧹 Cleaning up old container: ${name}`);
                    await this.stopContainer(name);
                }
            }
        } catch (e) {
            console.error(`Failed to cleanup old containers for ${subdomain}:`, e);
        }
    }

    // Get container status asynchronously
    async getContainerStatus(containerName) {
        try {
            const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`);
            return stdout.trim();
        } catch (e) {
            return 'stopped';
        }
    }

    // Get container logs asynchronously
    async getContainerLogs(containerName, lines = 100) {
        try {
            const { stdout, stderr } = await execAsync(`docker logs --tail ${lines} ${containerName} 2>&1`);
            return stdout || stderr;
        } catch (e) {
            return 'No logs available';
        }
    }

    // Remove image asynchronously
    async removeImage(subdomain) {
        try {
            await execAsync(`docker rmi orbitron-${subdomain} 2>/dev/null`);
        } catch (e) {
            // Image doesn't exist
        }
    }

    // Prune dangling images to free up space asynchronously
    async pruneImages() {
        try {
            await execAsync('docker image prune -f');
            console.log('🧹 Cleaned up unused Docker images');
        } catch (e) {
            // ignore
        }
    }
}

module.exports = new DockerService();
