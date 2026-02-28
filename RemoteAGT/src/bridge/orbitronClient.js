// src/bridge/orbitronClient.js
// REST API client for Orbitron Dashboard integration
import config from '../utils/config.js';
import logger from '../utils/logger.js';

class OrbitronClient {
    constructor() {
        this.baseUrl = config.orbitron.apiUrl;
        this.authToken = null;
    }

    // Login to Orbitron and get JWT token
    async login() {
        try {
            const res = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: process.env.ADMIN_EMAIL || 'admintop@orbitron.io',
                    password: process.env.ADMIN_PASSWORD || 'admin1234',
                }),
            });

            if (!res.ok) {
                throw new Error(`Login failed: ${res.status}`);
            }

            const data = await res.json();
            this.authToken = data.token;
            logger.info('Orbitron', 'Authenticated with Orbitron API');
            return true;
        } catch (err) {
            logger.warn('Orbitron', `Auth failed: ${err.message} — some features may be limited`);
            return false;
        }
    }

    // Make authenticated request to Orbitron
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
            ...options.headers,
        };

        try {
            const res = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers,
            });

            if (res.status === 401) {
                // Token expired, re-authenticate
                await this.login();
                headers.Authorization = `Bearer ${this.authToken}`;
                const retryRes = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
                return retryRes.json();
            }

            return res.json();
        } catch (err) {
            logger.error('Orbitron', `API request failed: ${endpoint} — ${err.message}`);
            return null;
        }
    }

    // Get all projects
    async getProjects() {
        return this.request('/projects');
    }

    // Get project by ID
    async getProject(id) {
        return this.request(`/projects/${id}`);
    }

    // Trigger deploy for a project
    async deployProject(projectId, commitHash = null) {
        return this.request(`/projects/${projectId}/deploy`, {
            method: 'POST',
            body: JSON.stringify({ commit_hash: commitHash }),
        });
    }

    // Stop a project
    async stopProject(projectId) {
        return this.request(`/projects/${projectId}/stop`, {
            method: 'POST',
        });
    }

    // Get project stats
    async getProjectStats(projectId) {
        return this.request(`/projects/${projectId}/stats`);
    }

    // Get project logs
    async getProjectLogs(projectId, lines = 50) {
        return this.request(`/projects/${projectId}/logs?lines=${lines}`);
    }

    // Health check
    async healthCheck() {
        try {
            const res = await fetch(`${this.baseUrl}/health`);
            return res.ok;
        } catch {
            return false;
        }
    }

    // Find project by name or subdomain (fuzzy)
    async findProject(query) {
        const projects = await this.getProjects();
        if (!projects || !Array.isArray(projects)) return null;

        const q = query.toLowerCase().trim();
        return projects.find(p =>
            p.name?.toLowerCase() === q ||
            p.subdomain?.toLowerCase() === q ||
            p.name?.toLowerCase().includes(q)
        );
    }
}

export default new OrbitronClient();
