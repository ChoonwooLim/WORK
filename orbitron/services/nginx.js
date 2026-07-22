const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { exec, execFileSync } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// NGINX_CONF_DIR env override는 테스트 격리용 — 미설정 시 기존 하드코딩 경로 사용.
const NGINX_CONF_DIR = path.resolve(process.env.NGINX_CONF_DIR || path.join(__dirname, '..', '..', 'infrastructure', 'nginx', 'conf.d'));
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'twinverse.org';

// ── 수동 관리 conf 보호 ──────────────────────────────────────────────
// 손으로 작성한 conf(TLS passthrough 등)를 Orbitron이 덮어쓰면 서비스가 502로
// 죽는다. 파일의 "첫 512바이트" 안에 `# orbitron:manual` 문자열이 있으면
// 수동 관리 파일로 간주하고 절대 덮어쓰기/삭제하지 않는다.
// (512바이트 이후의 마커는 인정하지 않는다 — 검사를 싸게 유지하는 명문화된 계약)
const MANUAL_MARKER = '# orbitron:manual';
const MANUAL_MARKER_SCAN_BYTES = 512;

function isManuallyManaged(configPath) {
    let fd;
    try {
        fd = fs.openSync(configPath, 'r');
    } catch (e) {
        if (e.code === 'ENOENT') return false; // 파일 없음 → 보호 대상 아님
        throw e; // 그 외 read 오류는 전파 (권한 문제 등을 조용히 삼키지 않는다)
    }
    try {
        const buf = Buffer.alloc(MANUAL_MARKER_SCAN_BYTES);
        const bytesRead = fs.readSync(fd, buf, 0, MANUAL_MARKER_SCAN_BYTES, 0);
        return buf.toString('utf-8', 0, bytesRead).includes(MANUAL_MARKER);
    } finally {
        fs.closeSync(fd);
    }
}

class ManualConfProtectedError extends Error {
    constructor(subdomain) {
        super(
            `nginx config for "${subdomain}" is manually managed (${MANUAL_MARKER}) — refusing to overwrite. ` +
            `이 프로젝트의 nginx 설정은 수동 관리 중입니다.`
        );
        this.name = 'ManualConfProtectedError';
        this.code = 'MANUAL_CONF_PROTECTED';
    }
}

// Subdomain must be DNS-label-safe: used as filename + Docker name + shell cwd.
// Anything outside [a-z0-9-] could enable path traversal or shell metachars.
const SAFE_SUBDOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
function assertSafeSubdomain(sub) {
    if (typeof sub !== 'string' || !SAFE_SUBDOMAIN.test(sub)) {
        throw new Error(`Unsafe subdomain: ${JSON.stringify(sub)}`);
    }
}
function confPathFor(subdomain) {
    assertSafeSubdomain(subdomain);
    const p = path.resolve(path.join(NGINX_CONF_DIR, `${subdomain}.conf`));
    // Escape check: resolved path must remain under NGINX_CONF_DIR
    if (p !== path.join(NGINX_CONF_DIR, `${subdomain}.conf`)) {
        throw new Error(`Path traversal blocked: ${subdomain}`);
    }
    return p;
}

class NginxService {
    // Build the proxy_pass block shared by both HTTP and HTTPS server blocks.
    //
    // CRITICAL: We use `set $upstream <host>:<port>` + `proxy_pass http://$upstream`
    // pattern. Without a variable, nginx resolves the hostname ONCE at config-load
    // time and caches the IP forever. When a project is redeployed, the new
    // container gets a different docker network IP — nginx keeps trying the old
    // (now-dead) IP → 502 Bad Gateway until nginx is reloaded.
    //
    // Using a variable forces nginx to re-resolve through the configured `resolver`
    // on each request (with valid=10s TTL), so redeploys are zero-downtime.
    //
    // The Docker embedded DNS server is at 127.0.0.11 inside containers.
    _proxyPassBlock(upstreamHost, upstreamPort) {
        return `        resolver 127.0.0.11 valid=10s ipv6=off;
        set $upstream ${upstreamHost}:${upstreamPort};
        proxy_pass http://$upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Tuning for large Next.js Image Streams
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;`;
    }

    // Parse project.custom_domain into an array of hostnames. Supports a single domain
    // string ("app.example.com") OR a comma/space/newline-separated list for projects
    // that want multiple hostnames served by the same cert + server block
    // ("example.com,www.example.com"). First entry is the primary (cert-name directory).
    _parseCustomDomains(project) {
        const raw = (project && project.custom_domain) || '';
        return raw.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    }

    // Generate an HTTPS server block for one or more Let's Encrypt-secured custom domains
    // served from a single SAN certificate. Paths are the ones visible inside dev-nginx.
    _httpsBlock(domains, upstreamHost, upstreamPort) {
        const list = Array.isArray(domains) ? domains : [domains];
        const primary = list[0];
        const certDir = `/etc/letsencrypt/live/${primary}`;
        return `
# HTTPS (Let's Encrypt) for custom domain(s): ${list.join(', ')}
server {
    listen 443 ssl;
    http2 on;
    server_name ${list.join(' ')};

    ssl_certificate ${certDir}/fullchain.pem;
    ssl_certificate_key ${certDir}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;

    client_max_body_size 50M;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
${this._proxyPassBlock(upstreamHost, upstreamPort)}
    }
}
`;
    }

    // Generate nginx config for a project
    generateConfig(project, targetContainer) {
        // Nginx will match these domains explicitly, mapping Cloudflare traffic correctly
        const serverNames = [`${project.subdomain}.localhost`, `${project.subdomain}.${TUNNEL_DOMAIN}`, `localhost`, `127.0.0.1`];
        const customDomains = this._parseCustomDomains(project);
        for (const d of customDomains) serverNames.push(d);

        // Use provided targetContainer or fallback to legacy standard name
        let upstreamHost = targetContainer || `orbitron-${project.subdomain}`;
        let upstreamPort = project.port || 3000;

        // Auto-detect actual container listen port (handles Dockerfiles that
        // hardcode --port instead of honoring $PORT env var). Verify by
        // checking the container's actual TCP listening sockets — not just
        // ExposedPorts metadata, since `-p` mappings auto-add to ExposedPorts
        // and would mask the real listen port.
        //
        // This rescues common user error: CMD ["uvicorn", "main:app", "--port", "8000"]
        // (hardcoded) — Orbitron injects PORT=3576 but app ignores it.
        if (targetContainer && !project.container_id?.startsWith('compose-')) {
            // Poll /proc/net/tcp inside the container for up to 12s. Python/Node
            // apps with heavy imports (SQLAlchemy, large frameworks) can take
            // several seconds to bind their listen socket — without this poll,
            // deployer would catch the container before the app is ready,
            // see no listen ports, and fall back to project.port (which may
            // be the wrong port if the app hardcodes --port).
            //
            // Reads /proc/net/tcp — always present in Linux containers, no
            // dependency on ss/netstat (often absent in minimal images).
            const deadline = Date.now() + 12000;
            let listenPorts = new Set();
            while (Date.now() < deadline) {
                try {
                    const out = execFileSync('docker', ['exec', targetContainer, 'cat', '/proc/net/tcp'], {
                        encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
                    });
                    listenPorts = new Set();
                    for (const line of out.split('\n')) {
                        // " 0: 00000000:1F40 00000000:0000 0A ..."
                        // Match LISTEN (state 0A) AND bound to 0.0.0.0 (00000000).
                        // Bindings to 127.0.0.1 (0100007F) etc. are not reachable
                        // from another container — skip them.
                        const m = line.match(/^\s*\d+:\s+00000000:([0-9A-F]+)\s+[0-9A-F]+:[0-9A-F]+\s+0A\s/);
                        if (m) {
                            const p = parseInt(m[1], 16);
                            if (p > 0 && p < 65536) listenPorts.add(p);
                        }
                    }
                    if (listenPorts.size > 0) break;  // app has started listening
                } catch (e) { /* container not exec-able yet */ }
                // Sleep 500ms before retry — use external sleep (sync, no CPU spin).
                // generateConfig is called from sync context so we cannot use async/await here.
                try { execFileSync('sleep', ['0.5'], { stdio: 'ignore' }); } catch { /* keep going */ }
            }
            if (listenPorts.size > 0 && !listenPorts.has(upstreamPort)) {
                // App is NOT listening on project.port — pick first actual listen port
                const detected = [...listenPorts][0];
                console.log(`[nginx] ${project.subdomain}: app not listening on project.port=${upstreamPort}; detected actual listen on ${detected} (likely hardcoded CMD ignoring $PORT)`);
                upstreamPort = detected;
            }
        }

        // For Docker Compose projects: if the compose stack has its own nginx/proxy container,
        // route to that container's internal port (80) instead of the host-mapped port
        if (project.container_id && project.container_id.startsWith('compose-')) {
            try {
                assertSafeSubdomain(project.subdomain);
                const projectDir = path.join(__dirname, '..', 'deployments', project.subdomain);
                // execFileSync w/ array args + cwd: no shell, no interpolation, no injection surface.
                const services = execFileSync('docker', ['compose', 'ps', '--services'], {
                    cwd: projectDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
                }).trim().split('\n');
                const nginxSvc = services.find(s => s === 'nginx' || s === 'proxy' || s === 'gateway' || s === 'traefik');
                if (nginxSvc) {
                    const containerId = execFileSync('docker', ['compose', 'ps', '-q', nginxSvc], {
                        cwd: projectDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
                    }).trim();
                    if (containerId) {
                        const raw = execFileSync('docker', ['inspect', '-f', '{{.Name}}', containerId], {
                            encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
                        }).trim();
                        const containerName = raw.replace(/^\//, '');
                        if (containerName) {
                            upstreamHost = containerName;
                            upstreamPort = 80; // Compose nginx listens on 80 internally
                            console.log(`📡 Compose nginx detected: routing to ${upstreamHost}:${upstreamPort}`);
                        }
                    }
                }
            } catch (e) { /* Not a compose project or no nginx service — use default */ }
        }

        // Check whether we can add an HTTPS block for the custom domain(s). The cert must
        // be at /etc/letsencrypt/live/<primary>/ and must cover every hostname (SAN).
        let httpsBlock = '';
        if (customDomains.length > 0) {
            try {
                const le = require('./letsencrypt');
                if (le.hasCert(customDomains[0])) {
                    httpsBlock = this._httpsBlock(customDomains, upstreamHost, upstreamPort);
                }
            } catch (e) { /* letsencrypt service may not exist yet — safe to ignore */ }
        }

        // Canonical-hostname enforcement: when the project opted in, redirect the tunnel
        // subdomain (and `localhost`, `127.0.0.1`) to the primary custom domain over HTTPS.
        // Keeps ACME challenge location at the top so certbot renewals don't get redirected.
        const wantsRedirect = !!(project.redirect_to_custom_domain && customDomains.length > 0 && httpsBlock);
        const primaryCustom = customDomains[0];
        const tunnelServerNames = [`${project.subdomain}.localhost`, `${project.subdomain}.${TUNNEL_DOMAIN}`, `localhost`, `127.0.0.1`];

        if (wantsRedirect) {
            // Two HTTP server blocks: one that redirects the tunnel names, another that actually
            // serves the custom domain on port 80 so Let's Encrypt HTTP-01 continues to work.
            return `# Auto-generated by Orbitron for: ${project.name}
# Canonical-hostname mode: tunnel subdomain → https://${primaryCustom} (301)
server {
    listen 80;
    server_name ${tunnelServerNames.join(' ')};

    # Let's Encrypt HTTP-01 challenge — must remain reachable during renewals even when
    # the rest of the traffic is being redirected. ACME comes before the redirect.
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        try_files $uri =404;
    }

    # Everything else: permanent redirect to the canonical custom domain over HTTPS.
    return 301 https://${primaryCustom}$request_uri;
}

# Port 80 for the custom domain(s) — passes ACME through and proxies the app
server {
    listen 80;
    server_name ${customDomains.join(' ')};

    client_max_body_size 50M;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
${this._proxyPassBlock(upstreamHost, upstreamPort)}
    }
}
${httpsBlock}`;
        }

        return `# Auto-generated by Orbitron for: ${project.name}
server {
    listen 80;
    server_name ${serverNames.join(' ')};

    client_max_body_size 50M;

    # Let's Encrypt HTTP-01 challenge — served from shared webroot
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
${this._proxyPassBlock(upstreamHost, upstreamPort)}
    }
}
${httpsBlock}`;
    }

    // Add nginx config for a project
    async addProject(project, targetContainer) {
        const configPath = confPathFor(project.subdomain);

        // 수동 관리 conf 보호: config 생성(도커 포트 감지 등 부수효과 포함) 전에
        // 가장 먼저 검사한다. 마커가 있으면 어떤 경우에도 파일을 건드리지 않는다.
        if (isManuallyManaged(configPath)) {
            throw new ManualConfProtectedError(project.subdomain);
        }

        const config = this.generateConfig(project, targetContainer);

        // Regression guard: generated config must use resolver+variable pattern.
        // If somebody refactors _proxyPassBlock and forgets this, redeploys
        // start returning 502 (nginx DNS caching). Fail loud at config-write
        // time instead of letting it slip into production.
        if (!config.includes('resolver 127.0.0.11')) {
            throw new Error(
                `[nginx] generated config for "${project.subdomain}" is missing the docker DNS resolver. ` +
                `proxy_pass with a literal hostname caches the IP forever and breaks on redeploy. ` +
                `Use 'resolver 127.0.0.11 valid=10s' + 'set $upstream ...' + 'proxy_pass http://$upstream;'.`
            );
        }
        if (!config.includes('proxy_pass http://$upstream')) {
            throw new Error(
                `[nginx] generated config for "${project.subdomain}" does not use a variable in proxy_pass. ` +
                `Literal hostnames in proxy_pass cause IP caching → 502 on redeploy.`
            );
        }

        await fsp.writeFile(configPath, config);
        await this.reload(project.subdomain);
    }

    // Remove nginx config for a project
    async removeProject(subdomain) {
        const configPath = confPathFor(subdomain);

        // 수동 관리 conf는 프로젝트 삭제 후에도 살아남아야 한다.
        // 대시보드의 프로젝트 삭제 자체는 성공해야 하므로 throw하지 않고 경고만 남긴다.
        if (isManuallyManaged(configPath)) {
            console.warn(`⚠️ nginx conf for "${subdomain}" is manually managed — leaving file in place`);
            return;
        }

        try {
            await fsp.unlink(configPath);
            await this.reload(subdomain);
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }
    }

    // Reload Nginx container
    async reload(subdomain = 'unknown') {
        try {
            await execAsync('docker exec dev-nginx nginx -s reload 2>/dev/null');
            console.log(`✅ nginx reloaded for ${subdomain}`);
        } catch (e) {
            console.error('⚠️ nginx reload failed:', e.message);
        }
    }
}

module.exports = new NginxService();
module.exports.isManuallyManaged = isManuallyManaged;
module.exports.ManualConfProtectedError = ManualConfProtectedError;
