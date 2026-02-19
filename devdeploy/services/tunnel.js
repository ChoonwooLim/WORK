const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TUNNEL_PROCS = {}; // subdomain -> { proc, url }

class TunnelService {
    // Start a tunnel for a project and return the public URL
    async startTunnel(project) {
        // Stop existing tunnel for this project
        this.stopTunnel(project.subdomain);

        const subdomain = project.subdomain || project.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        return new Promise((resolve) => {
            const proc = exec(
                `lt --port ${project.port} --subdomain ${subdomain}`,
                { stdio: 'pipe' }
            );

            TUNNEL_PROCS[project.subdomain] = { proc, url: null };

            let output = '';
            proc.stdout.on('data', (data) => {
                output += data.toString();
                // localtunnel outputs: "your url is: https://xxx.loca.lt"
                const match = output.match(/your url is: (https?:\/\/[^\s]+)/);
                if (match && !TUNNEL_PROCS[project.subdomain].url) {
                    const url = match[1].trim();
                    TUNNEL_PROCS[project.subdomain].url = url;
                    console.log(`🌐 Tunnel created for ${project.name}: ${url}`);
                    resolve(url);
                }
            });

            proc.stderr.on('data', (data) => {
                console.log(`Tunnel stderr: ${data}`);
            });

            proc.on('error', (err) => {
                console.log(`Tunnel error: ${err.message}`);
                resolve(null);
            });

            proc.on('exit', (code) => {
                if (code && code !== 0) {
                    console.log(`Tunnel exited with code ${code}`);
                }
            });

            // Timeout after 15 seconds
            setTimeout(() => {
                if (!TUNNEL_PROCS[project.subdomain]?.url) {
                    resolve(null);
                }
            }, 15000);
        });
    }

    // Stop a tunnel for a project
    stopTunnel(subdomain) {
        const tunnel = TUNNEL_PROCS[subdomain];
        if (tunnel && tunnel.proc) {
            try {
                tunnel.proc.kill();
            } catch (e) { /* already dead */ }
            delete TUNNEL_PROCS[subdomain];
        }
    }

    // Get tunnel URL for a project
    getTunnelUrl(subdomain) {
        return TUNNEL_PROCS[subdomain]?.url || null;
    }
}

module.exports = new TunnelService();
