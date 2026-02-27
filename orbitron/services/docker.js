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

        // --- Compose Check Bypass ---
        if (fs.existsSync(path.join(projectDir, 'docker-compose.yml')) || fs.existsSync(path.join(projectDir, 'docker-compose.yaml'))) {
            return new Promise((resolve, reject) => {
                exec(`cd ${projectDir} && docker compose pull && docker compose build`, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Compose Build failed: ${stderr}`));
                    } else {
                        resolve({ isCompose: true, logs: stdout + stderr });
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
            const dockerfile = this.generateDockerfile(project, projectDir);
            fs.writeFileSync(dockerfilePath, dockerfile);
        }

        return new Promise((resolve, reject) => {
            exec(`docker build --no-cache -t ${imageName} ${projectDir}`, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Build failed: ${stderr}`));
                } else {
                    resolve({ imageName, logs: stdout + stderr });
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

    // ── Fullstack auto-detection: find frontend + backend pair ──
    _detectFullstack(projectDir) {
        const frontendMarkers = ['package.json'];
        const backendMarkers = { python: 'requirements.txt', node: 'package.json' };
        const frontendHints = ['frontend', 'client', 'web', 'app'];
        const backendHints = ['backend', 'server', 'api'];

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

        // Scan: check 1-depth and 2-depth subdirectories
        const scanDirs = [projectDir];
        try {
            const topDirs = fs.readdirSync(projectDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== 'dist');
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
                    .filter(d => d.isDirectory() && !d.name.startsWith('.'));

                for (const child of children) {
                    const childPath = path.join(scanRoot, child.name);
                    const relPath = path.relative(projectDir, childPath);
                    const nameLower = child.name.toLowerCase();

                    // Detect frontend
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

                // If we found both frontend and backend, return fullstack
                if (frontendDir && backendDir) {
                    console.log(`🔍 Fullstack detected: frontend=${frontendRelPath} (${frontendFramework}), backend=${backendRelPath} (${backendInfo.runtime}/${backendInfo.framework})`);
                    return {
                        type: 'fullstack',
                        subdir: null,
                        frontend: { path: frontendRelPath, framework: frontendFramework },
                        backend: { path: backendRelPath, ...backendInfo }
                    };
                }
            } catch { }
        }

        return null; // No fullstack pattern found
    }

    // ── Generate SPA wrapper script for Python backends ──
    generateSpaWrapper(backendModule) {
        const [moduleName, appName] = backendModule.split(':');
        return `"""Auto-generated by Orbitron: SPA wrapper for fullstack deployment."""
import os
from ${moduleName} import ${appName} as app
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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
            not p.startswith("/uploads/") and
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

        // ── Fullstack: multi-stage build (frontend + backend) ──
        if (type === 'fullstack') {
            const fe = detected.frontend;
            const be = detected.backend;

            if (be.runtime === 'python') {
                const startModule = '_orbitron_spa:app';
                // Detect if backend needs postgres (libpq-dev)
                let reqContent = '';
                try { reqContent = fs.readFileSync(path.join(projectDir, be.path, 'requirements.txt'), 'utf-8'); } catch { }
                const needsPg = reqContent.includes('psycopg') || reqContent.includes('asyncpg');
                const pgInstall = needsPg ? 'RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*\n\n' : '';

                // Write SPA wrapper script
                const spaWrapper = this.generateSpaWrapper(be.module || 'main:app');
                fs.writeFileSync(path.join(projectDir, '_orbitron_spa.py'), spaWrapper);
                console.log(`📝 Auto-generated _orbitron_spa.py for ${project.name}`);

                return `# ===== AUTO-GENERATED by Orbitron (fullstack: ${fe.framework} + ${be.framework}) =====
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY ${fe.path}/package*.json ./
RUN npm ci
COPY ${fe.path}/ ./
ENV VITE_API_URL=""
RUN npm run build && \\
    find dist -name '*.js' -exec sed -i 's|http://localhost:[0-9]*||g' {} +

FROM python:3.11-slim
WORKDIR /app

${pgInstall}COPY ${be.path}/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY ${be.path}/ ./
COPY _orbitron_spa.py ./

COPY --from=frontend-build /build/dist /app/static

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
RUN npm run build && \\
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

        // Build env vars string (filter out internal Orbitron keys)
        const envVars = project.env_vars || {};
        const envFlags = Object.entries(envVars)
            .filter(([k]) => !k.startsWith('_ORBITRON_'))
            .map(([k, v]) => `-e ${k}="${v}"`)
            .join(' ');

        // ── Feature 1: Auto-mount persistent volumes ──
        const hostBaseDir = path.join(PROJECTS_DIR, project.subdomain || project.id, '_volumes');
        let volumeFlags = '';

        if (envVars.UPLOAD_DIR) {
            // Explicit UPLOAD_DIR from env
            const uploadPath = envVars.UPLOAD_DIR;
            try { await fs.promises.mkdir(uploadPath, { recursive: true }); } catch { }
            volumeFlags = `-v ${uploadPath}:${uploadPath}`;
        } else {
            // Auto-mount common upload/media/data directories
            const PERSIST_DIRS = ['/app/uploads', '/app/media', '/app/data', '/app/public/uploads'];
            const mounts = [];
            for (const dir of PERSIST_DIRS) {
                const dirName = dir.replace('/app/', '').replace(/\//g, '_');
                const hostDir = path.join(hostBaseDir, dirName);
                try { await fs.promises.mkdir(hostDir, { recursive: true }); } catch { }
                mounts.push(`-v ${hostDir}:${dir}`);
            }
            volumeFlags = mounts.join(' ');
        }

        // ── Feature 2: Port conflict auto-resolution ──
        const isWorker = project.type === 'worker';
        if (!isWorker) {
            const originalPort = port;
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
                console.log(`⚡ Port ${originalPort} in use → auto-assigned ${port} for ${project.name}`);
            }
        }
        const portFlags = isWorker ? '' : `-p ${port}:${port}`;

        // ── Feature 3: Log rotation (prevent disk fill) ──
        const logFlags = '--log-opt max-size=10m --log-opt max-file=3';

        return new Promise((resolve, reject) => {
            const cmd = `docker run -d --name ${containerName} --restart unless-stopped --network orbitron_internal ${logFlags} ${volumeFlags} ${envFlags} ${portFlags} ${imageName}`;
            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Start failed: ${stderr}`));
                } else {
                    resolve({ containerId: stdout.trim(), containerName, port });
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
