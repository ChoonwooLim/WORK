const { exec, execSync, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs');
const os = require('os');

const TUNNEL_PROCS = {}; // key -> { proc, url, tunnelId, retryTimer }
const CLOUDFLARED_DIR = path.join(__dirname, '..', 'bin');
const CLOUDFLARED_PATH = path.join(CLOUDFLARED_DIR, 'cloudflared');
const CF_CONFIG_DIR = path.join(require('os').homedir(), '.cloudflared');
const TUNNEL_DOMAIN = 'twinverse.org'; // Fixed domain for all tunnels

class TunnelService {
    // Ensure cloudflared binary exists
    async ensureCloudflared() {
        if (fs.existsSync(CLOUDFLARED_PATH)) return;
        console.log('📥 Downloading cloudflared binary...');
        fs.mkdirSync(CLOUDFLARED_DIR, { recursive: true });
        try {
            execSync(
                `curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ${CLOUDFLARED_PATH} && chmod +x ${CLOUDFLARED_PATH}`,
                { stdio: 'pipe', timeout: 60000 }
            );
            console.log('✅ cloudflared downloaded');
        } catch (e) {
            console.error('❌ Failed to download cloudflared:', e.message);
            throw new Error('cloudflared download failed');
        }
    }

    // Check if Cloudflare certificate exists (needed for named tunnels)
    hasCert() {
        return fs.existsSync(path.join(CF_CONFIG_DIR, 'cert.pem'));
    }

    // Get the tunnel key (subdomain) for a project
    _getKey(project) {
        return project.subdomain || project.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Get the fixed URL for a project
    getFixedUrl(project) {
        const key = this._getKey(project);
        return `https://${key}.${TUNNEL_DOMAIN}`;
    }

    // Create or reuse a named Cloudflare tunnel and return its fixed URL
    async startTunnel(project) {
        const key = this._getKey(project);
        await this.ensureCloudflared();

        // If no cert, fallback to quick tunnel (trycloudflare.com)
        if (!this.hasCert()) {
            console.log(`⚠️ No Cloudflare cert found. Using quick tunnel for ${project.name}`);
            return this._startQuickTunnel(project, key);
        }

        const tunnelName = `devdeploy-${key}`;
        const hostname = `${key}.${TUNNEL_DOMAIN}`;
        const fixedUrl = `https://${hostname}`;

        // ── Skip if the systemd tunnel service is already active ──
        try {
            const { stdout: status } = await execAsync(
                `systemctl is-active cloudflared-${tunnelName} 2>/dev/null || true`,
                { timeout: 5000 }
            );
            if (status.trim() === 'active') {
                console.log(`✅ Tunnel systemd service already active for ${project.name}, skipping restart.`);
                TUNNEL_PROCS[key] = { url: fixedUrl, tunnelName, project, key, isSystemd: true };
                return fixedUrl;
            }
        } catch (e) { /* ignore check failure, continue with normal flow */ }

        try {
            // Step 1: Create tunnel if it doesn't exist
            const tunnelId = await this._ensureTunnel(tunnelName);
            if (!tunnelId) {
                console.error(`❌ Failed to create/find tunnel ${tunnelName}`);
                return this._startQuickTunnel(project, key);
            }

            // Step 2: Add DNS route (idempotent — skips if exists)
            await this._ensureDnsRoute(tunnelName, tunnelId, hostname);

            // Step 3: Write config file
            const configPath = this._writeConfig(tunnelName, tunnelId, hostname, project.port);

            // Step 4: Run the tunnel process
            this._runTunnel(project, key, tunnelName, configPath, fixedUrl);

            console.log(`🌐 Cloudflare fixed tunnel for ${project.name}: ${fixedUrl}`);
            return fixedUrl;

        } catch (e) {
            console.error(`❌ Named tunnel failed for ${project.name}:`, e.message);
            return this._startQuickTunnel(project, key);
        }
    }

    // Ensure a named tunnel exists, return its ID
    async _ensureTunnel(tunnelName) {
        try {
            // Check if tunnel already exists
            const { stdout: listOutput } = await execAsync(
                `${CLOUDFLARED_PATH} tunnel list --name ${tunnelName} --output json`,
                { stdio: 'pipe', timeout: 15000 }
            );

            let tunnels = [];
            try {
                tunnels = JSON.parse(listOutput || '[]') || [];
            } catch (e) {
                tunnels = [];
            }
            if (tunnels && tunnels.length > 0) {
                console.log(`✅ Tunnel "${tunnelName}" already exists (${tunnels[0].id})`);
                return tunnels[0].id;
            }

            // Create new tunnel
            console.log(`Creating new Cloudflare tunnel for ${tunnelName}...`);
            const { stdout: createOutput } = await execAsync(
                `${CLOUDFLARED_PATH} tunnel create ${tunnelName}`,
                { stdio: 'pipe', timeout: 15000 }
            );

            const idMatch = createOutput.match(/with id ([a-f0-9-]+)/);
            if (idMatch) {
                console.log(`✅ Created tunnel "${tunnelName}" (${idMatch[1]})`);
                return idMatch[1];
            }

            return null;
        } catch (e) {
            // If tunnel already exists error, try to extract id
            const errMsg = e.stderr?.toString() || e.stdout?.toString() || e.message;
            if (errMsg.includes('already exists')) {
                try {
                    const { stdout: listOutput } = await execAsync(
                        `${CLOUDFLARED_PATH} tunnel list --output json`,
                        { stdio: 'pipe', timeout: 15000 }
                    );
                    let tunnels = [];
                    try { tunnels = JSON.parse(listOutput || '[]') || []; } catch (e) { }
                    const found = tunnels.find(t => t && t.name === tunnelName);
                    if (found) return found.id;
                } catch (_) { }
            }
            console.error(`Tunnel create/find error: ${errMsg}`);
            return null;
        }
    }

    // Add DNS CNAME route for the tunnel (safe to call multiple times)
    async _ensureDnsRoute(tunnelName, tunnelId, hostname) {
        try {
            await execAsync(
                `${CLOUDFLARED_PATH} tunnel route dns -f ${tunnelId} ${hostname}`,
                { stdio: 'pipe', timeout: 15000 }
            );
            console.log(`✅ DNS route: ${hostname} → ${tunnelName}`);
        } catch (e) {
            const msg = e.stderr?.toString() || e.stdout?.toString() || '';
            if (msg.includes('already exists') || msg.includes('CNAME')) {
                console.log(`✅ DNS route already exists: ${hostname}`);
            } else {
                console.error(`⚠️ DNS route error: ${msg}`);
            }
        }
    }

    // Write a tunnel config file
    _writeConfig(tunnelName, tunnelId, hostname, port) {
        const credFile = path.join(CF_CONFIG_DIR, `${tunnelId}.json`);
        const configPath = path.join(CF_CONFIG_DIR, `config-${tunnelName}.yml`);

        // Pass to Nginx on port 80. Cloudflare natively passes the `hostname` as Host header.
        // Nginx is configured to match `${subdomain}.localhost` and `${custom_domain}`.
        const config = `tunnel: ${tunnelId}\ncredentials-file: ${credFile}\ningress:\n  - hostname: ${hostname}\n    service: http://127.0.0.1:80\n  - service: http_status:404\n`;
        fs.writeFileSync(configPath, config);
        return configPath;
    }

    // Run the named tunnel process via Systemd (Zero-Downtime Decoupling)
    _runTunnel(project, key, tunnelName, configPath, fixedUrl) {
        try {
            // Wait for Nginx to finish applying buffers before systemd lock
            execSync(`sleep 1`);

            const serviceName = `cloudflared-${tunnelName}`;
            const serviceContent = `[Unit]
Description=Cloudflare Tunnel for ${tunnelName}
After=network.target

[Service]
TimeoutStartSec=0
Type=simple
ExecStart=${CLOUDFLARED_PATH} tunnel --edge-ip-version auto --config ${configPath} run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
`;
            // Write to a local temp file first
            const tmpPath = path.join(os.tmpdir(), `${serviceName}.service`);
            fs.writeFileSync(tmpPath, serviceContent);

            // Use sudo to move the file to systemd and enable it
            const sudoPwd = process.env.SUDO_PASSWORD;
            if (!sudoPwd) {
                console.error('❌ SUDO_PASSWORD is required in .env for systemd tunnel decoupling.');
                return;
            }

            const enableCmd = `
                echo "${sudoPwd}" | sudo -S mv ${tmpPath} /etc/systemd/system/ && 
                echo "${sudoPwd}" | sudo -S systemctl daemon-reload && 
                echo "${sudoPwd}" | sudo -S systemctl enable ${serviceName} && 
                echo "${sudoPwd}" | sudo -S systemctl restart ${serviceName}
            `;

            execSync(enableCmd, { stdio: 'ignore' });

            // Register in memory just for Orbitron tracking, but do NOT hold the process
            TUNNEL_PROCS[key] = { url: fixedUrl, tunnelName, project, key, isSystemd: true };

        } catch (e) {
            console.error(`❌ Failed to create systemd service for ${tunnelName}:`, e.message);
        }
    }

    // Stop a tunnel for a project using systemctl
    stopTunnel(key) {
        if (TUNNEL_PROCS[key]) {
            const tunnelConfig = TUNNEL_PROCS[key];
            if (tunnelConfig.isSystemd) {
                try {
                    const sudoPwd = process.env.SUDO_PASSWORD;
                    if (sudoPwd) {
                        const serviceName = `cloudflared-${tunnelConfig.tunnelName}`;
                        const stopCmd = `
                            echo "${sudoPwd}" | sudo -S systemctl stop ${serviceName} && 
                            echo "${sudoPwd}" | sudo -S systemctl disable ${serviceName}
                        `;
                        require('child_process').execSync(stopCmd, { stdio: 'ignore' });
                    }
                } catch (e) {
                    console.error('Failed to stop systemd tunnel:', e.message);
                }
            } else if (tunnelConfig.proc) {
                // Fallback for old legacy spawned processes (during migration)
                try { tunnelConfig.proc.kill(); } catch (e) { }
            }

            delete TUNNEL_PROCS[key];
        }
    }

    // Fallback: quick tunnel (trycloudflare.com) if no cert
    _startQuickTunnel(project, key) {
        this.stopTunnel(key);
        return new Promise((resolve) => {
            const proc = spawn(CLOUDFLARED_PATH, [
                'tunnel', '--url', `http://localhost:${project.port}`, '--no-autoupdate'
            ], { stdio: ['ignore', 'pipe', 'pipe'] });

            const entry = { proc, url: null, project, key };
            TUNNEL_PROCS[key] = entry;
            let resolved = false;
            let output = '';

            const handleOutput = (data) => {
                output += data.toString();
                const match = output.match(/(https:\/\/[^\s]+\.trycloudflare\.com)/);
                if (match && !entry.url) {
                    entry.url = match[1].trim();
                    console.log(`🌐 Quick tunnel for ${project.name}: ${entry.url}`);
                    if (!resolved) { resolved = true; resolve(entry.url); }
                }
            };
            proc.stdout.on('data', handleOutput);
            proc.stderr.on('data', handleOutput);
            proc.on('error', () => { if (!resolved) { resolved = true; resolve(null); } });
            proc.on('exit', (code) => {
                console.log(`⚠️ Quick tunnel for ${project.name} exited (${code}). Restarting...`);
                const timer = setTimeout(() => {
                    if (TUNNEL_PROCS[key]?.proc === proc) {
                        TUNNEL_PROCS[key].url = null;
                        this._startQuickTunnel(project, key).then(url => {
                            if (TUNNEL_PROCS[key]) TUNNEL_PROCS[key].url = url;
                        });
                    }
                }, 5000);
                if (TUNNEL_PROCS[key]) TUNNEL_PROCS[key].retryTimer = timer;
            });
            setTimeout(() => { if (!resolved) { resolved = true; resolve(entry.url); } }, 20000);
        });
    }

    // Stop a tunnel process
    stopTunnel(key) {
        const tunnel = TUNNEL_PROCS[key];
        if (tunnel) {
            if (tunnel.retryTimer) clearTimeout(tunnel.retryTimer);
            if (tunnel.proc) {
                try { tunnel.proc.kill('SIGTERM'); } catch (e) { /* dead */ }
            }
            delete TUNNEL_PROCS[key];
        }
    }

    // Delete a tunnel completely (when project is deleted)
    async deleteTunnel(key) {
        this.stopTunnel(key);
        const tunnelName = `devdeploy-${key}`;
        if (tunnelName) {
            try {
                // Ignore errors as tunnel might already be deleted or in use
                await execAsync(`${CLOUDFLARED_PATH} tunnel cleanup ${tunnelName} 2>&1`, { timeout: 10000 });
                await execAsync(`${CLOUDFLARED_PATH} tunnel delete ${tunnelName} 2>&1`, { timeout: 10000 });
                console.log(`🗑️ Deleted Cloudflare tunnel: ${tunnelName}`);
            } catch (e) {
                // Expected if tunnel doesn't exist
                console.log(`⚠️ Tunnel delete error for ${tunnelName}: ${e.message}`);
            }
        }
        // Remove config file
        const configPath = path.join(CF_CONFIG_DIR, `config-${tunnelName}.yml`);
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    }

    // Get tunnel URL for a project
    getTunnelUrl(key) {
        return TUNNEL_PROCS[key]?.url || null;
    }
}

module.exports = new TunnelService();
