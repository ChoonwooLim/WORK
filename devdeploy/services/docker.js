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
    // Build a Docker image for a project
    async buildImage(project) {
        const projectDir = path.join(PROJECTS_DIR, project.subdomain);
        const imageName = `orbitron-${project.subdomain}`;

        // Always regenerate Dockerfile to match current project type
        const dockerfilePath = path.join(projectDir, 'Dockerfile');
        const dockerfile = this.generateDockerfile(project, projectDir);
        fs.writeFileSync(dockerfilePath, dockerfile);

        return new Promise((resolve, reject) => {
            exec(`docker build -t ${imageName} ${projectDir}`, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Build failed: ${stderr}`));
                } else {
                    resolve({ imageName, logs: stdout + stderr });
                }
            });
        });
    }

    // Detect project type and generate appropriate Dockerfile
    detectProjectType(projectDir) {
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

    generateDockerfile(project, projectDir) {
        const detected = this.detectProjectType(projectDir);
        const port = project.port || 3000;
        const { type, subdir } = detected;
        const copyFrom = subdir ? `${subdir}/` : '.';

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

        // Static site - serve with nginx
        return `FROM nginx:alpine
COPY ${copyFrom} /usr/share/nginx/html
RUN echo 'server { listen ${port}; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE ${port}
`;
    }


    // Start a container for a project
    async startContainer(project) {
        const imageName = `orbitron-${project.subdomain}`;
        const containerName = `orbitron-${project.subdomain}`;
        const port = project.port || 3000;

        // Stop existing container if any
        await this.stopContainer(containerName);

        // Build env vars string
        const envVars = project.env_vars || {};
        const envFlags = Object.entries(envVars)
            .map(([k, v]) => `-e ${k}="${v}"`)
            .join(' ');

        // Auto-mount persistent volumes if UPLOAD_DIR is defined
        let volumeFlags = '';
        if (envVars.UPLOAD_DIR) {
            const uploadPath = envVars.UPLOAD_DIR;
            // Ensure host directory exists asynchronously
            try {
                await fs.promises.mkdir(uploadPath, { recursive: true });
            } catch (e) { /* ignore */ }
            volumeFlags = `-v ${uploadPath}:${uploadPath}`;
        }

        return new Promise((resolve, reject) => {
            const cmd = `docker run -d --name ${containerName} --restart unless-stopped --network infrastructure_dev-network ${volumeFlags} ${envFlags} -p ${port}:${port} ${imageName}`;
            exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Start failed: ${stderr}`));
                } else {
                    resolve(stdout.trim());
                }
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
