const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { exec, execFileSync } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const NGINX_CONF_DIR = path.resolve(path.join(__dirname, '..', '..', 'infrastructure', 'nginx', 'conf.d'));
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'twinverse.org';

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
    // Build the proxy_pass block shared by both HTTP and HTTPS server blocks
    _proxyPassBlock(upstreamHost, upstreamPort) {
        return `        proxy_pass http://${upstreamHost}:${upstreamPort};
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
        const config = this.generateConfig(project, targetContainer);
        await fsp.writeFile(configPath, config);
        await this.reload(project.subdomain);
    }

    // Remove nginx config for a project
    async removeProject(subdomain) {
        const configPath = confPathFor(subdomain);
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
