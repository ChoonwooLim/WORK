const { exec, execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TUNNEL_PROCS = {}; // subdomain -> { proc, url, project, retryTimer }
const CLOUDFLARED_DIR = path.join(__dirname, '..', 'bin');
const CLOUDFLARED_PATH = path.join(CLOUDFLARED_DIR, 'cloudflared');

class TunnelService {
    // Ensure cloudflared binary exists, download if missing
    async ensureCloudflared() {
        if (fs.existsSync(CLOUDFLARED_PATH)) return;

        console.log('📥 Downloading cloudflared binary...');
        fs.mkdirSync(CLOUDFLARED_DIR, { recursive: true });

        try {
            execSync(
                `curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ${CLOUDFLARED_PATH} && chmod +x ${CLOUDFLARED_PATH}`,
                { stdio: 'pipe', timeout: 60000 }
            );
            console.log('✅ cloudflared downloaded successfully');
        } catch (e) {
            console.error('❌ Failed to download cloudflared:', e.message);
            throw new Error('cloudflared download failed');
        }
    }

    // Start a tunnel for a project and return the public URL
    async startTunnel(project) {
        // Stop existing tunnel for this project
        const key = project.subdomain || project.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        this.stopTunnel(key);

        // Ensure cloudflared binary is available
        await this.ensureCloudflared();

        return new Promise((resolve) => {
            this._launchTunnel(project, key, resolve);
        });
    }

    // Internal: launch (or re-launch) a cloudflared tunnel process
    _launchTunnel(project, key, initialResolve) {
        const port = project.port;
        const proc = spawn(CLOUDFLARED_PATH, [
            'tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        const entry = { proc, url: null, project, key };
        TUNNEL_PROCS[key] = entry;

        let resolved = false;
        let output = '';

        const handleOutput = (data) => {
            output += data.toString();
            // cloudflared outputs the URL to stderr like:
            // "... | https://xxx-xxx-xxx.trycloudflare.com"
            const match = output.match(/(https:\/\/[^\s]+\.trycloudflare\.com)/);
            if (match && !entry.url) {
                const url = match[1].trim();
                entry.url = url;
                console.log(`🌐 Cloudflare tunnel created for ${project.name}: ${url}`);
                if (initialResolve && !resolved) {
                    resolved = true;
                    initialResolve(url);
                }
            }
        };

        proc.stdout.on('data', handleOutput);
        proc.stderr.on('data', handleOutput);

        proc.on('error', (err) => {
            console.log(`Tunnel error [${project.name}]: ${err.message}`);
            if (initialResolve && !resolved) {
                resolved = true;
                initialResolve(null);
            }
        });

        proc.on('exit', (code) => {
            console.log(`⚠️ Tunnel for ${project.name} exited (code ${code}). Auto-restarting in 5s...`);
            // Auto-restart after 5 seconds
            const retryTimer = setTimeout(() => {
                if (TUNNEL_PROCS[key] && TUNNEL_PROCS[key].proc === proc) {
                    console.log(`🔄 Restarting tunnel for ${project.name}...`);
                    TUNNEL_PROCS[key].url = null;
                    this._launchTunnel(project, key, null);
                }
            }, 5000);
            if (TUNNEL_PROCS[key]) {
                TUNNEL_PROCS[key].retryTimer = retryTimer;
            }
        });

        // Timeout for initial resolve only
        if (initialResolve) {
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    initialResolve(entry.url || null);
                }
            }, 20000);
        }
    }

    // Stop a tunnel for a project (no auto-restart)
    stopTunnel(key) {
        const tunnel = TUNNEL_PROCS[key];
        if (tunnel) {
            // Clear retry timer to prevent auto-restart
            if (tunnel.retryTimer) {
                clearTimeout(tunnel.retryTimer);
            }
            if (tunnel.proc) {
                try {
                    tunnel.proc.kill('SIGTERM');
                } catch (e) { /* already dead */ }
            }
            delete TUNNEL_PROCS[key];
        }
    }

    // Get tunnel URL for a project
    getTunnelUrl(key) {
        return TUNNEL_PROCS[key]?.url || null;
    }
}

module.exports = new TunnelService();
