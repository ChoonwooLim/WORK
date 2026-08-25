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

// 라우트 초입에서 쓰는 사전 검사: 이 프로젝트의 conf가 수동 관리인가?
// cert 발급/폐기, DB 변경 같은 되돌릴 수 없는 부수효과가 생기기 전에 호출해야 한다.
// (addProject 내부 가드는 심층 방어로 계속 유지된다)
function isProjectConfProtected(subdomain) {
    return isManuallyManaged(confPathFor(subdomain));
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

// ── 정적 자산 캐시 헤더 ──────────────────────────────────────────────
// 생성된 conf의 static-assets location은 `add_header Cache-Control $orbitron_static_cc;`
// 를 내보낸다. 값은 infrastructure/nginx/conf.d/00-orbitron-cache.conf 의
// http-컨텍스트 map이 결정: 업스트림이 Cache-Control을 안 보낸 경우에만
// 기본값(public 1일)을 부여하고, 업스트림이 보낸 값(private/no-store/immutable 등)은
// 그대로 통과시킨다 — 빈 add_header 값이면 nginx가 헤더 자체를 생략하기 때문.
// Cache-Control은 브라우저와 Cloudflare 엣지 TTL 양쪽을 결정한다 (origin cache control).
// stale-while-revalidate는 브라우저 전용 — Cloudflare 엣지는 무시한다.
// html/htm/json/xml/txt는 절대 넣지 않는다 — SPA index.html이 캐시되면
// 재배포 후에도 유저가 옛 앱을 보게 된다 (배포 신선도 계약).
// 확장자 목록은 아래 상수, 기본 TTL 튜닝은 00-orbitron-cache.conf 가 유일한 지점.
const STATIC_ASSET_EXT_REGEX = String.raw`\.(js|mjs|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|map)$`;
const STATIC_CACHE_VAR = '$orbitron_static_cc';

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

// ── 컨테이너 리슨 포트 감지 (generateConfig + deployer 스모크 체크 공유) ──────
// /proc/net/tcp + /proc/net/tcp6 연결 텍스트에서 any-address 에 바인드된
// LISTEN(state 0A) 포트를 추출.
//   tcp  (8-hex):  " 0: 00000000:1F40 ... 0A" → 0.0.0.0:8000
//   tcp6 (32-hex): " 0: 00000000000000000000000000000000:1F90 ... 0A" → [::]:8080
// tcp6 가 필수인 이유: 기본 Node server.listen(port) 는 :: 에 바인드되어
// tcp6 에만 나타난다 — tcp 만 보면 이런 앱을 "리슨 없음"으로 오판한다.
// 루프백 바인딩(127.0.0.1 = 0100007F, ::1 = ...0001, ::ffff:127.0.0.1)은
// 전부-0 이 아니므로 자동 제외 — 다른 컨테이너(nginx 포함)에서 도달 불가.
// (pure — 테스트는 smokeCheck.test.js 에서 핀)
function parseListenPorts(procNetTcpText) {
    const ports = new Set();
    for (const line of String(procNetTcpText).split('\n')) {
        const m = line.match(/^\s*\d+:\s+(?:00000000|00000000000000000000000000000000):([0-9A-F]+)\s+[0-9A-F]+:[0-9A-F]+\s+0A\s/);
        if (m) {
            const p = parseInt(m[1], 16);
            if (p > 0 && p < 65536) ports.add(p);
        }
    }
    return ports;
}

// 감지된 포트 중 프록시/프로브 대상 선택: 기대 포트가 실제로 열려 있으면 그대로,
// 아니면 첫 감지 포트 (CMD 가 $PORT 를 무시하고 --port 를 하드코딩한 앱 구제 —
// 예: CMD ["uvicorn","main:app","--port","8000"]), 아무것도 없으면 null. (pure)
function selectListenPort(listenPorts, preferredPort) {
    if (listenPorts.has(preferredPort)) return preferredPort;
    if (listenPorts.size > 0) return [...listenPorts][0];
    return null;
}

// Poll /proc/net/tcp inside the container for up to budgetMs (default 12s).
// Python/Node apps with heavy imports (SQLAlchemy, large frameworks) can take
// several seconds to bind their listen socket — without this poll, callers
// would catch the container before the app is ready and see no listen ports.
//
// Reads /proc/net/tcp — always present in Linux containers, no dependency on
// ss/netstat (often absent in minimal images). Sync (execFileSync + external
// sleep): generateConfig is called from a sync context. Not unit-tested
// (docker exec side effect) — parseListenPorts/selectListenPort carry the pins.
function detectContainerListenPorts(targetContainer, { budgetMs = 12000 } = {}) {
    const deadline = Date.now() + budgetMs;
    let listenPorts = new Set();
    while (Date.now() < deadline) {
        try {
            // tcp + tcp6 모두 읽는다 (:: 바인딩 앱은 tcp6 에만 나타남).
            // sh -c + 2>/dev/null + || true: tcp6 가 없는(IPv6 비활성) 컨테이너
            // 에서 cat 이 exit 1 로 끝나도 exec 이 throw 하지 않고 이미 출력된
            // tcp 내용을 그대로 쓴다 (|| true 없이는 execFileSync 가 throw 해
            // stdout 을 버린다).
            const out = execFileSync('docker', [
                'exec', targetContainer, 'sh', '-c',
                'cat /proc/net/tcp /proc/net/tcp6 2>/dev/null || true',
            ], {
                encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
            });
            listenPorts = parseListenPorts(out);
            if (listenPorts.size > 0) break;  // app has started listening
        } catch { /* container not exec-able yet */ }
        // Sleep 500ms before retry — external sleep (sync, no CPU spin).
        try { execFileSync('sleep', ['0.5'], { stdio: 'ignore' }); } catch { /* keep going */ }
    }
    return listenPorts;
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
        proxy_set_header X-Forwarded-For $remote_addr;
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

    // Static-asset location: same proxy body as `location /` (resolver+$upstream
    // pattern — regression-guard compatible, DNS 재해석도 동일하게 동작) 위에
    // 캐시 헤더 한 줄만 얹는다. add_header는 ngx_http_headers_module 지시어라
    // proxy_* 지시어와 같은 location에서 문제없이 공존한다.
    // 값($orbitron_static_cc = STATIC_CACHE_VAR)은 00-orbitron-cache.conf의 map이 결정:
    // 업스트림이 침묵할 때만 기본값, 업스트림이 보낸 Cache-Control은 그대로 통과.
    // `location /` 앞 배치는 가독성 관례일 뿐 — 실제 우선순위는 nginx 매칭 규칙이
    // 결정한다 (~* 정규식이 일반 접두사 location보다 우선, `^~` ACME에는 진다).
    _staticAssetsBlock(upstreamHost, upstreamPort) {
        return `    # Static assets: browser + Cloudflare edge caching (HTML은 절대 캐시 금지)
    location ~* ${STATIC_ASSET_EXT_REGEX} {
${this._proxyPassBlock(upstreamHost, upstreamPort)}
        add_header Cache-Control ${STATIC_CACHE_VAR};
    }`;
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

${this._staticAssetsBlock(upstreamHost, upstreamPort)}

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
            // Detection extracted to detectContainerListenPorts (shared with the
            // deployer's pre-switch smoke check so both look at the same target).
            // Behavior unchanged: poll up to 12s, then keep project.port when the
            // app listens on it, otherwise route to the first detected port.
            const listenPorts = detectContainerListenPorts(targetContainer);
            const chosen = selectListenPort(listenPorts, upstreamPort);
            if (chosen !== null && chosen !== upstreamPort) {
                // App is NOT listening on project.port — pick first actual listen port
                console.log(`[nginx] ${project.subdomain}: app not listening on project.port=${upstreamPort}; detected actual listen on ${chosen} (likely hardcoded CMD ignoring $PORT)`);
                upstreamPort = chosen;
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

${this._staticAssetsBlock(upstreamHost, upstreamPort)}

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

${this._staticAssetsBlock(upstreamHost, upstreamPort)}

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
module.exports.isProjectConfProtected = isProjectConfProtected;
module.exports.ManualConfProtectedError = ManualConfProtectedError;
module.exports.STATIC_ASSET_EXT_REGEX = STATIC_ASSET_EXT_REGEX;
module.exports.STATIC_CACHE_VAR = STATIC_CACHE_VAR;
module.exports.parseListenPorts = parseListenPorts;
module.exports.selectListenPort = selectListenPort;
module.exports.detectContainerListenPorts = detectContainerListenPorts;
