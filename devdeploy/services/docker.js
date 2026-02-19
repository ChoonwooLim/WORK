const { execSync, exec } = require('child_process');
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
        const imageName = `devdeploy-${project.subdomain}`;

        // Always regenerate Dockerfile to match current project type
        const dockerfilePath = path.join(projectDir, 'Dockerfile');
        const dockerfile = this.generateDockerfile(project, projectDir);
        fs.writeFileSync(dockerfilePath, dockerfile);

        return new Promise((resolve, reject) => {
            exec(`docker build -t ${imageName} ${projectDir}`, (error, stdout, stderr) => {
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
        if (fs.existsSync(path.join(projectDir, 'package.json'))) {
            return 'node';
        }
        if (fs.existsSync(path.join(projectDir, 'requirements.txt')) ||
            fs.existsSync(path.join(projectDir, 'manage.py'))) {
            return 'python';
        }
        if (fs.existsSync(path.join(projectDir, 'index.html')) ||
            fs.existsSync(path.join(projectDir, 'index.htm'))) {
            return 'static';
        }
        return 'static'; // Default to static
    }

    generateDockerfile(project, projectDir) {
        const type = this.detectProjectType(projectDir);
        const port = project.port || 3000;

        if (type === 'node') {
            return `FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN ${project.build_command || 'npm install'}
COPY . .
EXPOSE ${port}
CMD ${JSON.stringify((project.start_command || 'npm start').split(' '))}
`;
        }

        // Static site - serve with nginx
        return `FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN echo 'server { listen ${port}; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE ${port}
`;
    }


    // Start a container for a project
    async startContainer(project) {
        const imageName = `devdeploy-${project.subdomain}`;
        const containerName = `devdeploy-${project.subdomain}`;
        const port = project.port || 3000;

        // Stop existing container if any
        await this.stopContainer(containerName);

        // Build env vars string
        const envVars = project.env_vars || {};
        const envFlags = Object.entries(envVars)
            .map(([k, v]) => `-e ${k}="${v}"`)
            .join(' ');

        return new Promise((resolve, reject) => {
            const cmd = `docker run -d --name ${containerName} --network infrastructure_dev-network ${envFlags} -p ${port}:${port} ${imageName}`;
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Start failed: ${stderr}`));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    // Stop and remove a container
    async stopContainer(containerName) {
        try {
            execSync(`docker stop ${containerName} 2>/dev/null && docker rm ${containerName} 2>/dev/null`, { stdio: 'pipe' });
        } catch (e) {
            // Container doesn't exist, that's fine
        }
    }

    // Get container status
    async getContainerStatus(containerName) {
        try {
            const status = execSync(`docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`, { stdio: 'pipe' });
            return status.toString().trim();
        } catch (e) {
            return 'stopped';
        }
    }

    // Get container logs
    async getContainerLogs(containerName, lines = 100) {
        try {
            const logs = execSync(`docker logs --tail ${lines} ${containerName} 2>&1`, { stdio: 'pipe' });
            return logs.toString();
        } catch (e) {
            return 'No logs available';
        }
    }

    // Remove image
    async removeImage(subdomain) {
        try {
            execSync(`docker rmi devdeploy-${subdomain} 2>/dev/null`, { stdio: 'pipe' });
        } catch (e) {
            // Image doesn't exist
        }
    }
}

module.exports = new DockerService();
