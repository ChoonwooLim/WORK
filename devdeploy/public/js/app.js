// DevDeploy Dashboard - Frontend JavaScript

const API = '/api';
let currentProject = null;
let serverHost = 'localhost'; // Will be updated with public IP

// ============ PROJECT LIST ============

async function loadProjects() {
    try {
        const res = await fetch(`${API}/projects`);
        const projects = await res.json();
        renderProjects(projects);
        updateStats(projects);
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

function renderProjects(projects) {
    const list = document.getElementById('project-list');

    if (projects.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <div class="icon">📦</div>
        <h3>프로젝트가 없습니다</h3>
        <p>New Project 버튼을 눌러 첫 번째 프로젝트를 추가하세요.</p>
      </div>`;
        return;
    }

    list.innerHTML = projects.map(p => {
        const siteUrl = `http://${serverHost}:${p.port}`;
        return `
    <div class="project-card" onclick="openProject(${p.id})">
      <div class="project-status ${p.status}"></div>
      <div class="project-info">
        <div class="project-name">${escapeHtml(p.name)}</div>
        <div class="project-meta">
          ${p.status === 'running'
                ? `<a href="${siteUrl}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:none;font-weight:600;">🌐 ${siteUrl}</a>`
                : `<span style="color:var(--text-muted)">🌐 ${siteUrl}</span>`
            }
          <span>📂 ${extractRepoName(p.github_url)}</span>
          <span>🔀 ${p.branch}</span>
          <span class="badge badge-${p.status}">${statusLabel(p.status)}</span>
        </div>
      </div>
      <div class="project-actions">
        ${p.status === 'running'
                ? `<a class="btn btn-sm btn-primary" href="${siteUrl}" target="_blank" onclick="event.stopPropagation()">🌐 열기</a>
               <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); stopProject(${p.id})">⏹ 중지</button>`
                : `<button class="btn btn-sm btn-success" onclick="event.stopPropagation(); deployProject(${p.id})">▶ 배포</button>`
            }
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteProject(${p.id})">🗑</button>
      </div>
    </div>`;
    }).join('');
}

function updateStats(projects) {
    document.getElementById('stat-total').textContent = projects.length;
    document.getElementById('stat-running').textContent = projects.filter(p => p.status === 'running').length;
    document.getElementById('stat-stopped').textContent = projects.filter(p => p.status === 'stopped' || p.status === 'failed').length;
    document.getElementById('stat-building').textContent = projects.filter(p => p.status === 'building').length;
}

// ============ PROJECT ACTIONS ============

async function createProject() {
    const name = document.getElementById('input-name').value.trim();
    const github_url = document.getElementById('input-github').value.trim();
    const branch = document.getElementById('input-branch').value.trim() || 'main';
    const build_command = document.getElementById('input-build').value.trim();
    const start_command = document.getElementById('input-start').value.trim();
    const port = document.getElementById('input-port').value ? parseInt(document.getElementById('input-port').value) : null;
    const subdomain = document.getElementById('input-subdomain').value.trim() || null;

    if (!name || !github_url) {
        toast('프로젝트 이름과 GitHub URL은 필수입니다.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, github_url, branch, build_command, start_command, port, subdomain })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }

        toast('프로젝트가 생성되었습니다!', 'success');
        closeModal();
        loadProjects();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function deployProject(id) {
    try {
        await fetch(`${API}/projects/${id}/deploy`, { method: 'POST' });
        toast('배포가 시작되었습니다! 🚀', 'info');
        // Poll for completion
        pollDeployStatus(id);
    } catch (error) {
        toast('배포 실패: ' + error.message, 'error');
    }
}

function pollDeployStatus(id) {
    let attempts = 0;
    const poll = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch(`${API}/projects/${id}`);
            const p = await res.json();
            loadProjects();
            if (p.status === 'running') {
                clearInterval(poll);
                const url = `http://${serverHost}:${p.port}`;
                toast(`✅ 배포 완료! 사이트: ${url}`, 'success');
            } else if (p.status === 'failed') {
                clearInterval(poll);
                toast('❌ 배포 실패. 로그를 확인하세요.', 'error');
            } else if (attempts > 60) {
                clearInterval(poll);
                toast('⏰ 배포 시간 초과', 'error');
            }
        } catch (e) { /* ignore */ }
    }, 3000);
}

async function stopProject(id) {
    try {
        await fetch(`${API}/projects/${id}/stop`, { method: 'POST' });
        toast('프로젝트가 중지되었습니다.', 'success');
        loadProjects();
    } catch (error) {
        toast('중지 실패: ' + error.message, 'error');
    }
}

async function deleteProject(id) {
    if (!confirm('정말로 이 프로젝트를 삭제하시겠습니까?')) return;
    try {
        await fetch(`${API}/projects/${id}`, { method: 'DELETE' });
        toast('프로젝트가 삭제되었습니다.', 'success');
        loadProjects();
    } catch (error) {
        toast('삭제 실패: ' + error.message, 'error');
    }
}

// ============ PROJECT DETAIL ============

async function openProject(id) {
    try {
        const res = await fetch(`${API}/projects/${id}`);
        currentProject = await res.json();
        renderProjectDetail();
        document.getElementById('detail-modal').classList.add('active');
        switchTab('overview');
    } catch (error) {
        toast('프로젝트 로드 실패', 'error');
    }
}

function renderProjectDetail() {
    const p = currentProject;
    document.getElementById('detail-title').textContent = `📦 ${p.name}`;

    // Overview
    const siteUrl = `http://${serverHost}:${p.port}`;
    document.getElementById('overview-content').innerHTML = `
    ${p.status === 'running' ? `
    <div style="background:linear-gradient(135deg,rgba(63,185,80,0.15),rgba(88,166,255,0.1));border:1px solid var(--success);border-radius:var(--radius-lg);padding:20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:var(--success);margin-bottom:8px;font-weight:600;">🟢 사이트 실행 중</div>
      <a href="${siteUrl}" target="_blank" style="color:var(--accent);font-size:20px;font-weight:700;text-decoration:none;">${siteUrl}</a>
      <div style="margin-top:12px;"><a class="btn btn-primary" href="${siteUrl}" target="_blank" style="text-decoration:none;">🌐 사이트 열기</a></div>
    </div>` : ''}
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">상태</div>
        <span class="badge badge-${p.status}" style="font-size:14px;padding:4px 12px;">${statusLabel(p.status)}</span>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">사이트 URL</div>
        <a href="${siteUrl}" target="_blank" style="color:var(--accent);">${siteUrl}</a>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">GitHub</div>
        <a href="${p.github_url}" target="_blank" style="color:var(--accent);">${extractRepoName(p.github_url)}</a>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">Branch</div>
        <span>${p.branch}</span>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">포트</div>
        <span>${p.port}</span>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">생성일</div>
        <span>${new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
      </div>
    </div>
    <div style="margin-top:24px; display:flex; gap:8px;">
      ${p.status === 'running'
            ? `<button class="btn btn-ghost" onclick="stopProject(${p.id}); closeDetailModal();">⏹ 중지</button>`
            : `<button class="btn btn-success" onclick="deployProject(${p.id}); closeDetailModal();">▶ 배포</button>`
        }
      <button class="btn btn-primary" onclick="deployProject(${p.id}); closeDetailModal();">🔄 재배포</button>
    </div>
  `;

    // Settings
    document.getElementById('settings-content').innerHTML = `
    <div class="form-group">
      <label>프로젝트 이름</label>
      <input type="text" id="set-name" value="${escapeHtml(p.name)}">
    </div>
    <div class="form-group">
      <label>GitHub URL</label>
      <input type="text" id="set-github" value="${escapeHtml(p.github_url)}">
    </div>
    <div class="form-group">
      <label>Branch</label>
      <input type="text" id="set-branch" value="${p.branch}">
    </div>
    <div class="form-group">
      <label>빌드 명령어</label>
      <input type="text" id="set-build" value="${escapeHtml(p.build_command || '')}">
    </div>
    <div class="form-group">
      <label>시작 명령어</label>
      <input type="text" id="set-start" value="${escapeHtml(p.start_command || '')}">
    </div>
    <button class="btn btn-primary" onclick="saveSettings()">설정 저장</button>
  `;

    // Env vars
    renderEnvVars();
}

function renderEnvVars() {
    const envVars = currentProject.env_vars || {};
    const container = document.getElementById('env-content');
    const entries = Object.entries(envVars);

    if (entries.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">환경변수가 없습니다.</p>';
    } else {
        container.innerHTML = entries.map(([key, val]) => `
      <div class="env-row">
        <input type="text" class="env-key" value="${escapeHtml(key)}" placeholder="KEY">
        <input type="text" class="env-val" value="${escapeHtml(val)}" placeholder="VALUE">
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
      </div>
    `).join('');
    }
}

function addEnvRow() {
    const container = document.getElementById('env-content');
    const row = document.createElement('div');
    row.className = 'env-row';
    row.innerHTML = `
    <input type="text" class="env-key" placeholder="KEY">
    <input type="text" class="env-val" placeholder="VALUE">
    <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
  `;
    container.appendChild(row);
}

async function saveEnvVars() {
    const rows = document.querySelectorAll('#env-content .env-row');
    const envVars = {};
    rows.forEach(row => {
        const key = row.querySelector('.env-key').value.trim();
        const val = row.querySelector('.env-val').value.trim();
        if (key) envVars[key] = val;
    });

    try {
        await fetch(`${API}/projects/${currentProject.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ env_vars: envVars })
        });
        toast('환경변수가 저장되었습니다!', 'success');
        currentProject.env_vars = envVars;
    } catch (error) {
        toast('저장 실패', 'error');
    }
}

async function saveSettings() {
    try {
        await fetch(`${API}/projects/${currentProject.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('set-name').value,
                github_url: document.getElementById('set-github').value,
                branch: document.getElementById('set-branch').value,
                build_command: document.getElementById('set-build').value,
                start_command: document.getElementById('set-start').value,
            })
        });
        toast('설정이 저장되었습니다!', 'success');
        loadProjects();
    } catch (error) {
        toast('저장 실패', 'error');
    }
}

// ============ LOGS & DEPLOYMENTS ============

async function refreshLogs() {
    if (!currentProject) return;
    try {
        const res = await fetch(`${API}/deployments/${currentProject.id}/logs`);
        const data = await res.json();
        document.getElementById('log-content').textContent = data.logs || '로그가 없습니다.';
    } catch (error) {
        document.getElementById('log-content').textContent = '로그를 불러올 수 없습니다.';
    }
}

async function loadDeployments() {
    if (!currentProject) return;
    try {
        const res = await fetch(`${API}/deployments/${currentProject.id}`);
        const deployments = await res.json();

        if (deployments.length === 0) {
            document.getElementById('deployments-content').innerHTML =
                '<p style="color:var(--text-secondary);">배포 이력이 없습니다.</p>';
            return;
        }

        document.getElementById('deployments-content').innerHTML = deployments.map(d => `
      <div class="deploy-item">
        <span class="deploy-status ${d.status}">${statusLabel(d.status)}</span>
        <div class="deploy-info">
          <div class="deploy-commit">${d.commit_hash ? d.commit_hash.substring(0, 7) : '---'} ${escapeHtml(d.commit_message || '')}</div>
          <div class="deploy-time">${timeAgo(d.started_at)}</div>
        </div>
      </div>
    `).join('');
    } catch (error) {
        document.getElementById('deployments-content').innerHTML = '<p style="color:var(--danger);">로드 실패</p>';
    }
}

// ============ TABS ============

function switchTab(tabName) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'logs') refreshLogs();
    if (tabName === 'deployments') loadDeployments();
}

// ============ MODALS ============

function openNewProjectModal() {
    document.getElementById('new-project-modal').classList.add('active');
    document.getElementById('input-name').value = '';
    document.getElementById('input-github').value = '';
    document.getElementById('input-branch').value = 'main';
    document.getElementById('input-build').value = 'npm install';
    document.getElementById('input-start').value = 'npm start';
    document.getElementById('input-port').value = '';
    document.getElementById('input-subdomain').value = '';
    document.getElementById('input-name').focus();
}

function closeModal() {
    document.getElementById('new-project-modal').classList.remove('active');
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('active');
    currentProject = null;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            currentProject = null;
        }
    });
});

// ============ HELPERS ============

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractRepoName(url) {
    if (!url) return '';
    const match = url.match(/github\.com\/(.+?)(?:\.git)?$/);
    return match ? match[1] : url;
}

function statusLabel(status) {
    const labels = { running: '실행 중', stopped: '중지됨', building: '빌드 중', failed: '실패', pending: '대기' };
    return labels[status] || status;
}

function timeAgo(dateStr) {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return '방금 전';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    return `${Math.floor(seconds / 86400)}일 전`;
}

function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// ============ INIT ============

// Fetch public IP then load projects
async function init() {
    try {
        const res = await fetch(`${API}/server-info`);
        const info = await res.json();
        if (info.publicIp) serverHost = info.publicIp;
    } catch (e) { /* fallback to localhost */ }
    loadProjects();
}

init();
setInterval(loadProjects, 5000);
