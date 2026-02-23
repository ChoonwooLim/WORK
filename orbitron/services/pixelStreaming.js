const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const crypto = require('crypto');

class PixelStreamingService {
    constructor() {
        this.sessions = new Map();
        // 6 potential slots (ports 8888-8893)
        // 3 for GPU 0, 3 for GPU 1 to balance load across dual GTX 1080s
        this.availableSlots = [
            { port: 8888, gpu: 0 },
            { port: 8889, gpu: 1 },
            { port: 8890, gpu: 0 },
            { port: 8891, gpu: 1 },
            { port: 8892, gpu: 0 },
            { port: 8893, gpu: 1 },
        ];

        // We assume an existing UE5 pixel streaming image is available on the machine.
        // This can be customized via .env or settings later.
        this.IMAGE_NAME = process.env.PIXEL_STREAM_IMAGE || 'orbitron-pixel-stream:latest';

        // Setup idle cleanup interval (every 1 minute)
        setInterval(() => this.cleanupZombies(), 60000);
    }

    async getAvailableSlot() {
        const usedPorts = Array.from(this.sessions.values()).map(s => s.port);
        const slot = this.availableSlots.find(s => !usedPorts.includes(s.port));
        return slot || null;
    }

    async startSession(projectName = null) {
        const slot = await this.getAvailableSlot();
        if (!slot) {
            throw new Error('Server Full / Please Wait');
        }

        const sessionId = crypto.randomUUID();
        const containerName = `ps-session-${sessionId}`;

        // Use a project-specific image if specified, else fallback to default
        const targetImage = projectName ? `orbitron-${projectName}` : this.IMAGE_NAME;

        // Example UE5 Docker run command for Pixel Streaming
        // Exposes the WebRTC signaling server on the allocated port
        const cmd = `docker run -d --name ${containerName} --gpus '"device=${slot.gpu}"' -p ${slot.port}:80 --rm ${targetImage}`;

        try {
            await execAsync(cmd);
            const session = {
                id: sessionId,
                containerName,
                port: slot.port,
                gpu: slot.gpu,
                createdAt: Date.now()
            };
            this.sessions.set(sessionId, session);
            return session;
        } catch (error) {
            console.error(`❌ Failed to start pixel streaming session ${sessionId}:`, error.message);
            // If it fails because the image is missing, we still throw
            throw error;
        }
    }

    async endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        try {
            await execAsync(`docker stop ${session.containerName} 2>/dev/null`);
            console.log(`✅ Pixel Streaming Session ended: ${sessionId}`);
        } catch (e) {
            console.error(`⚠️ Error stopping container ${session.containerName}:`, e.message);
        }

        this.sessions.delete(sessionId);
    }

    async cleanupZombies() {
        try {
            const { stdout } = await execAsync(`docker ps --filter "name=ps-session-" --format "{{.Names}}" 2>/dev/null`);
            const runningContainers = stdout.split('\n').filter(n => n.trim() !== '');
            const trackedContainers = Array.from(this.sessions.values()).map(s => s.containerName);

            for (const name of runningContainers) {
                if (!trackedContainers.includes(name)) {
                    console.log(`🧹 Killing zombie Pixel Streaming container: ${name}`);
                    await execAsync(`docker stop ${name} 2>/dev/null`);
                }
            }

            // Time limits: auto-kill sessions longer than 1 hour to prevent hoarding
            const MAX_DURATION = 60 * 60 * 1000;
            for (const [id, session] of this.sessions.entries()) {
                if (Date.now() - session.createdAt > MAX_DURATION) {
                    console.log(`⏰ Session ${id} exceeded max time limit. Terminating.`);
                    await this.endSession(id);
                }
            }
        } catch (e) {
            console.error('⚠️ Zombie cleanup check failed:', e.message);
        }
    }
}

module.exports = new PixelStreamingService();
