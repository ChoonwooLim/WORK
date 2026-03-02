/**
 * Smart Project Analyzer
 * 
 * Scans a project repository and produces a comprehensive manifest
 * describing all services, their types, dependencies, and deployment targets.
 * 
 * This enables Orbitron to replicate the dev environment 100% in production.
 */
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

// ── Known patterns for detection ──

const FRONTEND_HINTS = ['frontend', 'client', 'web', 'app', 'ui', 'admin', 'staff', 'dashboard', 'portal'];
const BACKEND_HINTS = ['backend', 'server', 'api', 'service', 'gateway'];
const WORKER_HINTS = ['worker', 'cron', 'job', 'queue', 'scheduler', 'consumer'];
const IGNORE_DIRS = new Set([
    'node_modules', 'dist', 'build', '.git', '__pycache__', '_volumes',
    '.next', '.nuxt', '.vite', '.cache', 'coverage', 'test', 'tests',
    '.github', '.vscode', '.idea', 'vendor', 'venv', '.venv', 'env',
    'static', 'public', 'assets', 'docs', 'doc', 'scripts', 'migrations',
    'alembic', '.wrangler', 'icons', 'images', 'fonts'
]);

class ProjectAnalyzer {
    /**
     * Analyze a project directory and return a comprehensive manifest.
     * If orbitron.yaml exists, parse it as the authoritative source.
     * Otherwise, auto-detect the project structure.
     * 
     * @param {string} projectDir - Absolute path to the project root
     * @param {Object} project - Orbitron project record from DB (optional)
     * @returns {Object} ProjectManifest
     */
    analyze(projectDir, project = null) {
        // Priority 1: Use orbitron.yaml if it exists (human-defined = authoritative)
        const yamlPath = path.join(projectDir, 'orbitron.yaml');
        if (fs.existsSync(yamlPath)) {
            try {
                const manifest = this._parseOrbitronYaml(yamlPath, projectDir);
                manifest._source = 'orbitron.yaml';
                return manifest;
            } catch (e) {
                console.error('[Analyzer] Failed to parse orbitron.yaml, falling back to auto-detect:', e.message);
            }
        }

        // Priority 2: Auto-detect from project structure
        const manifest = this._autoDetect(projectDir, project);
        manifest._source = 'auto-detect';
        return manifest;
    }

    // ═══════════════════════════════════════════════════════
    //  ORBITRON.YAML PARSER (Authoritative Source)
    // ═══════════════════════════════════════════════════════

    /**
     * Parse orbitron.yaml into a standardized ProjectManifest
     */
    _parseOrbitronYaml(yamlPath, projectDir) {
        const raw = fs.readFileSync(yamlPath, 'utf8');
        const parsed = yaml.load(raw);

        const manifest = {
            projectName: parsed.project?.name || path.basename(projectDir),
            services: [],
            databases: [],
        };

        // Parse services
        if (parsed.services && Array.isArray(parsed.services)) {
            for (const svc of parsed.services) {
                const service = {
                    name: svc.name,
                    type: svc.type || 'web',
                    runtime: svc.runtime || this._detectRuntime(path.join(projectDir, svc.rootDir || '.')),
                    rootDir: svc.rootDir || '.',
                    framework: null,
                    buildCommand: svc.build?.command || null,
                    startCommand: svc.start?.command || null,
                    port: svc.port || null,
                    publishDir: svc.publish || null,
                    deployTarget: svc.type === 'static' ? 'cf-pages' : 'docker',
                    dependencies: [],
                    envRefs: {},
                    pwa: svc.pwa || false,
                    healthCheck: svc.healthCheck || null,
                    routes: svc.routes || null,
                };

                // Detect framework from rootDir
                const svcDir = path.join(projectDir, service.rootDir);
                if (fs.existsSync(svcDir)) {
                    service.framework = this._detectFramework(svcDir, service.runtime);
                    if (!service.port && service.type === 'web') {
                        service.port = this._detectPort(svcDir, service.runtime, service.framework);
                    }
                }

                // Parse environment variable references
                if (svc.env && Array.isArray(svc.env)) {
                    for (const envItem of svc.env) {
                        if (envItem.from) {
                            service.envRefs[envItem.key] = envItem.from;
                            // Extract dependency from reference
                            const depMatch = envItem.from.match(/(?:service|database)\.([^.]+)/);
                            if (depMatch && !service.dependencies.includes(depMatch[1])) {
                                service.dependencies.push(depMatch[1]);
                            }
                        }
                    }
                }

                manifest.services.push(service);
            }
        }

        // Parse databases
        if (parsed.databases && Array.isArray(parsed.databases)) {
            for (const db of parsed.databases) {
                manifest.databases.push({
                    name: db.name,
                    engine: db.engine || 'postgres',
                    region: db.region || null,
                    plan: db.plan || 'starter',
                });
            }
        }

        return manifest;
    }

    // ═══════════════════════════════════════════════════════
    //  AUTO-DETECTION ENGINE
    // ═══════════════════════════════════════════════════════

    /**
     * Auto-detect project structure when no orbitron.yaml exists
     */
    _autoDetect(projectDir, project = null) {
        const manifest = {
            projectName: project?.name || path.basename(projectDir),
            services: [],
            databases: [],
        };

        // Scan all candidate directories (root + 1 depth + 2 depth)
        const candidates = this._findServiceCandidates(projectDir);

        if (candidates.length === 0) {
            // Single service project at root
            const rootService = this._analyzeServiceDir(projectDir, projectDir, project);
            if (rootService) manifest.services.push(rootService);
            return manifest;
        }

        // If root itself is a service, add it
        const rootHasApp = this._hasAppMarker(projectDir);
        if (rootHasApp && candidates.length === 0) {
            const rootService = this._analyzeServiceDir(projectDir, projectDir, project);
            if (rootService) manifest.services.push(rootService);
        }

        // Analyze each candidate
        for (const candidateDir of candidates) {
            const service = this._analyzeServiceDir(candidateDir, projectDir, project);
            if (service) manifest.services.push(service);
        }

        // If no services found, treat root as single service
        if (manifest.services.length === 0) {
            const rootService = this._analyzeServiceDir(projectDir, projectDir, project);
            if (rootService) manifest.services.push(rootService);
        }

        // Detect database dependencies from env vars and code
        this._inferDatabaseDeps(manifest, projectDir, project);

        // Infer inter-service dependencies
        this._inferServiceDeps(manifest);

        return manifest;
    }

    /**
     * Find directories that look like independent services/apps
     * Searches 1-depth and 2-depth subdirectories
     */
    _findServiceCandidates(projectDir) {
        const candidates = [];

        const scanDir = (dir, depth) => {
            if (depth > 2) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

                    const fullPath = path.join(dir, entry.name);

                    if (this._hasAppMarker(fullPath)) {
                        candidates.push(fullPath);
                    } else if (depth < 2) {
                        // Go one level deeper
                        scanDir(fullPath, depth + 1);
                    }
                }
            } catch { }
        };

        scanDir(projectDir, 1);
        return candidates;
    }

    /**
     * Check if a directory contains markers indicating it's an app/service
     */
    _hasAppMarker(dir) {
        const markers = [
            'package.json', 'requirements.txt', 'go.mod', 'Cargo.toml',
            'manage.py', 'Gemfile', 'composer.json', 'pom.xml', 'build.gradle'
        ];
        return markers.some(m => fs.existsSync(path.join(dir, m)));
    }

    /**
     * Analyze a single service directory and return a service object
     */
    _analyzeServiceDir(serviceDir, projectDir, project = null) {
        const relDir = path.relative(projectDir, serviceDir) || '.';
        const dirName = path.basename(serviceDir);
        const nameLower = dirName.toLowerCase();

        const runtime = this._detectRuntime(serviceDir);
        if (!runtime) return null;

        const framework = this._detectFramework(serviceDir, runtime);
        const type = this._classifyServiceType(serviceDir, nameLower, runtime, framework);
        const port = this._detectPort(serviceDir, runtime, framework);
        const buildCmd = this._detectBuildCommand(serviceDir, runtime, framework);
        const startCmd = this._detectStartCommand(serviceDir, runtime, framework);

        // Generate a reasonable service name
        let serviceName;
        if (relDir === '.') {
            serviceName = project?.subdomain || project?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || dirName;
        } else {
            serviceName = `${project?.subdomain || 'app'}-${dirName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        }

        return {
            name: serviceName,
            type,
            runtime,
            rootDir: relDir,
            framework,
            buildCommand: buildCmd,
            startCommand: startCmd,
            port,
            publishDir: type === 'static' ? './dist' : null,
            deployTarget: type === 'static' ? 'cf-pages' : 'docker',
            dependencies: [],
            envRefs: {},
            pwa: false,
        };
    }

    // ═══════════════════════════════════════════════════════
    //  DETECTION HELPERS
    // ═══════════════════════════════════════════════════════

    /**
     * Detect the runtime/language of a directory
     */
    _detectRuntime(dir) {
        if (!fs.existsSync(dir)) return null;

        if (fs.existsSync(path.join(dir, 'package.json'))) return 'node';
        if (fs.existsSync(path.join(dir, 'requirements.txt'))) return 'python';
        if (fs.existsSync(path.join(dir, 'manage.py'))) return 'python';
        if (fs.existsSync(path.join(dir, 'go.mod'))) return 'go';
        if (fs.existsSync(path.join(dir, 'Cargo.toml'))) return 'rust';
        if (fs.existsSync(path.join(dir, 'Gemfile'))) return 'ruby';
        if (fs.existsSync(path.join(dir, 'composer.json'))) return 'php';
        if (fs.existsSync(path.join(dir, 'pom.xml')) || fs.existsSync(path.join(dir, 'build.gradle'))) return 'java';

        // Check for static site (index.html at root)
        if (fs.existsSync(path.join(dir, 'index.html'))) return 'static';

        return null;
    }

    /**
     * Detect the framework used in a directory
     */
    _detectFramework(dir, runtime) {
        if (runtime === 'node') {
            const pkgPath = path.join(dir, 'package.json');
            if (!fs.existsSync(pkgPath)) return null;
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

                if (allDeps['next']) return 'nextjs';
                if (allDeps['nuxt'] || allDeps['nuxt3']) return 'nuxt';
                if (allDeps['@vitejs/plugin-react'] || allDeps['vite']) {
                    if (allDeps['react']) return 'vite-react';
                    if (allDeps['vue']) return 'vite-vue';
                    if (allDeps['svelte']) return 'vite-svelte';
                    return 'vite';
                }
                if (allDeps['react-scripts']) return 'cra';
                if (allDeps['express']) return 'express';
                if (allDeps['fastify']) return 'fastify';
                if (allDeps['koa']) return 'koa';
                if (allDeps['nest'] || allDeps['@nestjs/core']) return 'nestjs';
                if (allDeps['react']) return 'react';
                if (allDeps['vue']) return 'vue';
                if (allDeps['svelte']) return 'svelte';
                if (allDeps['angular'] || allDeps['@angular/core']) return 'angular';

                return pkg.scripts?.build ? 'generic-node' : 'node';
            } catch { return null; }
        }

        if (runtime === 'python') {
            // Check for main.py with FastAPI/Flask
            const mainPy = path.join(dir, 'main.py');
            const appPy = path.join(dir, 'app.py');
            const managePy = path.join(dir, 'manage.py');

            if (fs.existsSync(managePy)) return 'django';

            for (const pyFile of [mainPy, appPy]) {
                if (fs.existsSync(pyFile)) {
                    try {
                        const src = fs.readFileSync(pyFile, 'utf8');
                        if (src.includes('FastAPI')) return 'fastapi';
                        if (src.includes('Flask')) return 'flask';
                    } catch { }
                }
            }

            // Check requirements.txt
            const reqPath = path.join(dir, 'requirements.txt');
            if (fs.existsSync(reqPath)) {
                try {
                    const reqs = fs.readFileSync(reqPath, 'utf8').toLowerCase();
                    if (reqs.includes('fastapi')) return 'fastapi';
                    if (reqs.includes('flask')) return 'flask';
                    if (reqs.includes('django')) return 'django';
                } catch { }
            }

            return 'python';
        }

        if (runtime === 'go') {
            const mainGo = path.join(dir, 'main.go');
            if (fs.existsSync(mainGo)) {
                try {
                    const src = fs.readFileSync(mainGo, 'utf8');
                    if (src.includes('gin-gonic')) return 'gin';
                    if (src.includes('echo')) return 'echo';
                    if (src.includes('fiber')) return 'fiber';
                } catch { }
            }
            return 'go';
        }

        return runtime;
    }

    /**
     * Classify a service as web, static, worker, or database
     */
    _classifyServiceType(dir, dirName, runtime, framework) {
        // Worker detection
        if (WORKER_HINTS.some(h => dirName.includes(h))) return 'worker';

        // Static site detection: has build but no server-side framework
        if (runtime === 'node') {
            const staticFrameworks = ['vite', 'vite-react', 'vite-vue', 'vite-svelte', 'cra', 'react', 'vue', 'svelte', 'angular'];
            if (staticFrameworks.includes(framework)) {
                // But if it also has a server, it's web
                const pkgPath = path.join(dir, 'package.json');
                if (fs.existsSync(pkgPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
                        // If it has express/fastify/etc alongside, it's web (SSR or fullstack)
                        if (allDeps['express'] || allDeps['fastify'] || allDeps['@nestjs/core'] || allDeps['koa']) {
                            return 'web';
                        }
                    } catch { }
                }
                // Pure frontend → static
                if (FRONTEND_HINTS.some(h => dirName.includes(h))) return 'static';
                // If name doesn't hint, check for build script
                if (fs.existsSync(pkgPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                        if (pkg.scripts?.build && !pkg.scripts?.start?.includes('node')) return 'static';
                    } catch { }
                }
            }

            // NextJS is server-rendered → web
            if (framework === 'nextjs' || framework === 'nuxt') return 'web';
        }

        if (runtime === 'static') return 'static';

        // Default to web for anything with a server
        return 'web';
    }

    /**
     * Detect the port a service listens on
     */
    _detectPort(dir, runtime, framework) {
        if (runtime === 'node') {
            // Check package.json scripts
            const pkgPath = path.join(dir, 'package.json');
            if (fs.existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    const startScript = pkg.scripts?.start || pkg.scripts?.dev || '';
                    const portMatch = startScript.match(/--port\s+(\d+)|PORT[=:]\s*(\d+)|-p\s+(\d+)/);
                    if (portMatch) return parseInt(portMatch[1] || portMatch[2] || portMatch[3]);
                } catch { }
            }
        }

        if (runtime === 'python') {
            // Check main.py for uvicorn port
            for (const f of ['main.py', 'app.py', 'run.py']) {
                const fp = path.join(dir, f);
                if (fs.existsSync(fp)) {
                    try {
                        const src = fs.readFileSync(fp, 'utf8');
                        const portMatch = src.match(/port[=:]\s*(\d+)/i);
                        if (portMatch) return parseInt(portMatch[1]);
                    } catch { }
                }
            }
        }

        // Framework defaults
        const defaultPorts = {
            'nextjs': 3000, 'nuxt': 3000, 'express': 3000, 'fastify': 3000,
            'nestjs': 3000, 'koa': 3000, 'vite': 5173, 'vite-react': 5173,
            'cra': 3000, 'fastapi': 8000, 'flask': 5000, 'django': 8000,
            'gin': 8080, 'echo': 8080, 'fiber': 3000,
        };
        return defaultPorts[framework] || (runtime === 'python' ? 8000 : 3000);
    }

    /**
     * Detect the build command
     */
    _detectBuildCommand(dir, runtime, framework) {
        if (runtime === 'node') {
            const pkgPath = path.join(dir, 'package.json');
            if (fs.existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    if (pkg.scripts?.build) return 'npm install && npm run build';
                    return 'npm install';
                } catch { }
            }
        }
        if (runtime === 'python') return 'pip install -r requirements.txt';
        if (runtime === 'go') return 'go build -o app .';
        if (runtime === 'rust') return 'cargo build --release';
        return null;
    }

    /**
     * Detect the start command
     */
    _detectStartCommand(dir, runtime, framework) {
        if (runtime === 'node') {
            const pkgPath = path.join(dir, 'package.json');
            if (fs.existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    if (pkg.scripts?.start) return 'npm start';
                    if (pkg.main) return `node ${pkg.main}`;
                } catch { }
            }
            return 'npm start';
        }

        if (runtime === 'python') {
            if (framework === 'fastapi') return 'uvicorn main:app --host 0.0.0.0 --port 8000';
            if (framework === 'flask') return 'flask run --host 0.0.0.0 --port 5000';
            if (framework === 'django') return 'python manage.py runserver 0.0.0.0:8000';
            return 'python main.py';
        }

        if (runtime === 'go') return './app';
        if (runtime === 'rust') return './target/release/app';

        return null;
    }

    // ═══════════════════════════════════════════════════════
    //  DEPENDENCY INFERENCE
    // ═══════════════════════════════════════════════════════

    /**
     * Infer database dependencies from env vars and code patterns
     */
    _inferDatabaseDeps(manifest, projectDir, project = null) {
        const envVars = project?.env_vars || {};

        // Check for DATABASE_URL
        if (envVars.DATABASE_URL || envVars.POSTGRES_URL || envVars.DB_URL) {
            const existing = manifest.databases.find(d => d.engine === 'postgres');
            if (!existing) {
                manifest.databases.push({
                    name: `${manifest.projectName}-db`,
                    engine: 'postgres',
                    region: null,
                    plan: 'starter',
                });
            }
        }

        // Check for Redis
        if (envVars.REDIS_URL || envVars.REDIS_HOST) {
            manifest.databases.push({
                name: `${manifest.projectName}-redis`,
                engine: 'redis',
                region: null,
                plan: 'starter',
            });
        }
    }

    /**
     * Infer inter-service dependencies from env var naming patterns
     */
    _inferServiceDeps(manifest) {
        for (const svc of manifest.services) {
            // Frontend services typically depend on backend/API services
            if (svc.type === 'static') {
                const backendSvc = manifest.services.find(s =>
                    s.type === 'web' && BACKEND_HINTS.some(h => s.name.includes(h))
                );
                if (backendSvc && !svc.dependencies.includes(backendSvc.name)) {
                    svc.dependencies.push(backendSvc.name);
                    // Auto-inject API URL env ref
                    const envKey = svc.framework?.includes('vite') ? 'VITE_API_URL' : 'REACT_APP_API_URL';
                    svc.envRefs[envKey] = `service.${backendSvc.name}.url`;
                }
            }

            // Backend services typically depend on databases
            if (svc.type === 'web' && BACKEND_HINTS.some(h => svc.name.includes(h))) {
                for (const db of manifest.databases) {
                    if (!svc.dependencies.includes(db.name)) {
                        svc.dependencies.push(db.name);
                        svc.envRefs['DATABASE_URL'] = `database.${db.name}.connectionString`;
                    }
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  DEPLOYMENT ORDERING
    // ═══════════════════════════════════════════════════════

    /**
     * Return services in dependency order (databases first, then backends, then frontends)
     */
    getDeploymentOrder(manifest) {
        const resolved = [];
        const pending = [...manifest.services];
        const resolvedNames = new Set(manifest.databases.map(d => d.name));

        // Topo sort
        let maxIterations = pending.length * 2;
        while (pending.length > 0 && maxIterations-- > 0) {
            for (let i = pending.length - 1; i >= 0; i--) {
                const svc = pending[i];
                const depsResolved = svc.dependencies.every(d => resolvedNames.has(d));
                if (depsResolved) {
                    resolved.push(svc);
                    resolvedNames.add(svc.name);
                    pending.splice(i, 1);
                }
            }
        }

        // Add any remaining (circular deps — just append)
        resolved.push(...pending);

        return resolved;
    }

    /**
     * Format manifest as human-readable log output
     */
    formatManifestLog(manifest) {
        let log = `\n📊 프로젝트 구조 분석 결과 (소스: ${manifest._source || 'unknown'})\n`;
        log += `   프로젝트: ${manifest.projectName}\n`;
        log += `   서비스: ${manifest.services.length}개\n`;
        log += `   데이터베이스: ${manifest.databases.length}개\n`;

        for (const svc of manifest.services) {
            const icon = svc.type === 'static' ? '📄' : svc.type === 'worker' ? '⚙️' : '🌐';
            const target = svc.deployTarget === 'cf-pages' ? 'CF Pages' : 'Docker';
            log += `\n   ${icon} ${svc.name}\n`;
            log += `      타입: ${svc.type} | 런타임: ${svc.runtime} | 프레임워크: ${svc.framework || 'N/A'}\n`;
            log += `      배포: ${target} | 디렉토리: ${svc.rootDir}\n`;
            if (svc.port) log += `      포트: ${svc.port}\n`;
            if (svc.dependencies.length > 0) log += `      의존: ${svc.dependencies.join(', ')}\n`;
        }

        for (const db of manifest.databases) {
            log += `\n   🗄️ ${db.name} (${db.engine})\n`;
        }

        return log;
    }
}

module.exports = new ProjectAnalyzer();
