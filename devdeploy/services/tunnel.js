const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

        try {
            // Step 1: Create tunnel if it doesn't exist
            const tunnelId = this._ensureTunnel(tunnelName);
            if (!tunnelId) {
                console.error(`❌ Failed to create/find tunnel ${tunnelName}`);
                return this._startQuickTunnel(project, key);
            }

            // Step 2: Add DNS route (idempotent — skips if exists)
            this._ensureDnsRoute(tunnelName, hostname);

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
    _ensureTunnel(tunnelName) {
        try {
            // Check if tunnel already exists
            const listOutput = execSync(
                `${CLOUDFLARED_PATH} tunnel list --name ${tunnelName} --output json 2>/dev/null`,
                { stdio: 'pipe', timeout: 15000 }
            ).toString().trim();

            const tunnels = JSON.parse(listOutput || '[]');
            if (tunnels.length > 0) {
                console.log(`✅ Tunnel "${tunnelName}" already exists (${tunnels[0].id})`);
                return tunnels[0].id;
            }

            // Create new tunnel
            const createOutput = execSync(
                `${CLOUDFLARED_PATH} tunnel create ${tunnelName} 2>&1`,
                { stdio: 'pipe', timeout: 15000 }
            ).toString();

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
                    const listOutput = execSync(
                        `${CLOUDFLARED_PATH} tunnel list --output json 2>/dev/null`,
                        { stdio: 'pipe', timeout: 15000 }
                    ).toString();
                    const tunnels = JSON.parse(listOutput || '[]');
                    const found = tunnels.find(t => t.name === tunnelName);
                    if (found) return found.id;
                } catch (_) { }
            }
            console.error(`Tunnel create/find error: ${errMsg}`);
            return null;
        }
    }

    // Add DNS CNAME route for the tunnel (safe to call multiple times)
    _ensureDnsRoute(tunnelName, hostname) {
        try {
            execSync(
                `${CLOUDFLARED_PATH} tunnel route dns ${tunnelName} ${hostname} 2>&1`,
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
        const config = `tunnel: ${tunnelId}\ncredentials-file: ${credFile}\ningress:\n  - hostname: ${hostname}\n    service: http://localhost:${port}\n  - service: http_status:404\n`;
        fs.writeFileSync(configPath, config);
        return configPath;
    }

    // Run the named tunnel process
    _runTunnel(project, key, tunnelName, configPath, fixedUrl) {
        // Stop existing process if any
        this.stopTunnel(key);

        const proc = spawn(CLOUDFLARED_PATH, [
            'tunnel', '--config', configPath, '--no-autoupdate', 'run'
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        TUNNEL_PROCS[key] = { proc, url: fixedUrl, tunnelName, project, key };

        proc.stdout.on('data', (d) => {
            const msg = d.toString();
            if (msg.includes('ERR') || msg.includes('error')) console.log(`[tunnel:${key}] ${msg.trim()}`);
        });
        proc.stderr.on('data', (d) => {
            const msg = d.toString();
            if (msg.includes('Registered') || msg.includes('ERR') || msg.includes('error')) {
                console.log(`[tunnel:${key}] ${msg.trim()}`);
            }
        });

        proc.on('exit', (code) => {
            console.log(`⚠️ Tunnel ${tunnelName} exited (code ${code}). Restarting in 5s...`);
            const retryTimer = setTimeout(() => {
                if (TUNNEL_PROCS[key] && TUNNEL_PROCS[key].proc === proc) {
                    console.log(`🔄 Restarting tunnel ${tunnelName}...`);
                    this._runTunnel(project, key, tunnelName, configPath, fixedUrl);
                }
            }, 5000);
            if (TUNNEL_PROCS[key]) TUNNEL_PROCS[key].retryTimer = retryTimer;
        });
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
        try {
            execSync(`${CLOUDFLARED_PATH} tunnel cleanup ${tunnelName} 2>&1`, { stdio: 'pipe', timeout: 10000 });
            execSync(`${CLOUDFLARED_PATH} tunnel delete ${tunnelName} 2>&1`, { stdio: 'pipe', timeout: 10000 });
            // Remove config file
            const configPath = path.join(CF_CONFIG_DIR, `config-${tunnelName}.yml`);
            if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
            console.log(`🗑️ Tunnel ${tunnelName} deleted`);
        } catch (e) {
            console.log(`⚠️ Tunnel delete: ${e.message}`);
        }
    }

    // Get tunnel URL for a project
    getTunnelUrl(key) {
        return TUNNEL_PROCS[key]?.url || null;
    }
}

module.exports = new TunnelService();
