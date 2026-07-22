'use strict';

// Orbitron REST API 클라이언트 — 대시보드와 동일한 엔드포인트만 호출.
// fetch 주입 가능 (테스트에서 픽스처 fetch 사용). Node ≥18 내장 fetch 사용.

const { ApiError, AuthError } = require('./errors');

class ApiClient {
    constructor({ server, token = null, fetchImpl = globalThis.fetch } = {}) {
        this.server = String(server || '').replace(/\/+$/, '');
        this.token = token;
        this.fetchImpl = fetchImpl;
    }

    async request(method, apiPath, body) {
        const headers = { Accept: 'application/json' };
        if (this.token) headers.Authorization = `Bearer ${this.token}`;
        const init = { method, headers };
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await this.fetchImpl(this.server + apiPath, init);
        } catch (e) {
            throw new ApiError(`서버에 연결할 수 없습니다 (${this.server}). / Cannot reach server: ${e.message}`);
        }

        let data = null;
        const text = await res.text();
        if (text) {
            try { data = JSON.parse(text); } catch (e) { data = { error: text.slice(0, 500) }; }
        }

        if (res.status === 401) {
            throw new AuthError((data && data.error) || '인증이 필요합니다. / Authentication required.');
        }
        if (!res.ok) {
            throw new ApiError((data && data.error) || `HTTP ${res.status}`, res.status, data && data.code);
        }
        return data;
    }

    // ── Auth ──
    login(email, password) { return this.request('POST', '/api/auth/login', { email, password }); }
    createToken(name) { return this.request('POST', '/api/auth/tokens', { name }); }
    deleteToken(id) { return this.request('DELETE', `/api/auth/tokens/${id}`); }

    // ── Projects ──
    projects() { return this.request('GET', '/api/projects'); }
    deployProject(id) { return this.request('POST', `/api/projects/${id}/deploy`, {}); }
    previews(projectId) { return this.request('GET', `/api/projects/${projectId}/previews`); }
    deletePreview(projectId, prNumber) { return this.request('DELETE', `/api/projects/${projectId}/previews/${prNumber}`); }

    // ── Deployments ──
    deployments(projectId) { return this.request('GET', `/api/deployments/${projectId}`); }
    rollback(deploymentId) { return this.request('POST', `/api/deployments/${deploymentId}/rollback`, {}); }
    containerLogs(projectId, lines) { return this.request('GET', `/api/deployments/${projectId}/logs?lines=${encodeURIComponent(lines)}`); }
}

module.exports = { ApiClient };
