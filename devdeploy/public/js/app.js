// Orbitron Dashboard - Frontend JavaScript (Sidebar Layout)

const API = '/api';
let currentProject = null;
let serverHost = 'localhost';
let currentPage = 'dashboard';

const getToken = () => localStorage.getItem('orbitron_token');
const setToken = (t) => localStorage.setItem('orbitron_token', t);

const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    if (typeof resource === 'string' && resource.startsWith('/api/') && resource !== '/api/auth/login' && resource !== '/api/auth/register' && resource !== '/api/health' && resource !== '/api/server-info' && !resource.startsWith('/api/webhooks')) {
        config = config || {};
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${getToken() || ''}`;
    }
    const response = await originalFetch(resource, config);
    if (response.status === 401) {
        const modal = document.getElementById('login-modal');
        if (!modal.classList.contains('active')) {
            modal.classList.add('active');
            document.getElementById('input-login-email').focus();
        }
    }
    return response;
};

function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    if (tab === 'login') document.getElementById('input-login-email').focus();
    else document.getElementById('input-reg-username').focus();
}

async function login() {
    const email = document.getElementById('input-login-email').value.trim();
    const password = document.getElementById('input-login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    if (!email || !password) { errorEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
    try {
        const res = await originalFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error || '로그인 실패'; return; }
        setToken(data.token);
        document.getElementById('login-modal').classList.remove('active');
        document.getElementById('input-login-email').value = '';
        document.getElementById('input-login-password').value = '';
        toast(`${data.user.username}님, 환영합니다! 🪐`, 'success');
        init();
    } catch (e) { errorEl.textContent = '서버에 연결할 수 없습니다.'; }
}

async function register() {
    const username = document.getElementById('input-reg-username').value.trim();
    const email = document.getElementById('input-reg-email').value.trim();
    const password = document.getElementById('input-reg-password').value;
    const confirm = document.getElementById('input-reg-confirm').value;
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    if (!username || !email || !password) { errorEl.textContent = '모든 필드를 입력해주세요.'; return; }
    if (password.length < 4) { errorEl.textContent = '비밀번호는 4자 이상이어야 합니다.'; return; }
    if (password !== confirm) { errorEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }
    try {
        const res = await originalFetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error || '회원가입 실패'; return; }
        setToken(data.token);
        document.getElementById('login-modal').classList.remove('active');
        toast(`${data.user.username}님, 가입을 환영합니다! 🎉`, 'success');
        init();
    } catch (e) { errorEl.textContent = '서버에 연결할 수 없습니다.'; }
}

// ============ NAVIGATION ============

function navigateTo(page) {
    currentPage = page;

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show target page
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Activate nav item
    const navEl = document.getElementById(`nav-${page}`);
    if (navEl) navEl.classList.add('active');

    // Update topbar title
    const titles = {
        'dashboard': '📊 대시보드',
        'projects': '📦 프로젝트',
        'project-overview': `📋 ${currentProject?.name || ''} — 개요`,
        'project-logs': `📄 ${currentProject?.name || ''} — 로그`,
        'project-deployments': `🔄 ${currentProject?.name || ''} — 배포 이력`,
        'project-env': `🔧 ${currentProject?.name || ''} — 환경변수`,
        'project-console': `🖥 ${currentProject?.name || ''} — 콘솔`,
        'project-settings': `⚙️ ${currentProject?.name || ''} — 설정`,
    };
    document.getElementById('topbar-title').textContent = titles[page] || '';

    // Update topbar actions
    const actions = document.getElementById('topbar-actions');
    if (page.startsWith('project-') && currentProject) {
        const siteUrl = currentProject.custom_domain ? `http://${currentProject.custom_domain}` : (currentProject.tunnel_url || `http://${serverHost}:${currentProject.port}`);
        actions.innerHTML = `
            ${currentProject.status === 'running' ? `<a class="btn btn-sm btn-primary" href="${siteUrl}" target="_blank">🌐 열기</a>` : ''}
            <button class="btn btn-sm btn-ghost" onclick="openDeployOptions(${currentProject.id})">🔄 재배포</button>
            ${currentProject.status === 'running' ? `<button class="btn btn-sm btn-ghost" onclick="stopProject(${currentProject.id})">⏹ 중지</button>` : ''}
        `;
    } else {
        actions.innerHTML = '';
    }

    // Show/hide project sub-nav
    const showProjectNav = page.startsWith('project-');
    document.getElementById('nav-project-section').style.display = showProjectNav ? 'block' : 'none';
    document.getElementById('nav-project-items').style.display = showProjectNav ? 'block' : 'none';

    // Load page data
    if (page === 'project-overview') renderProjectOverview();
    if (page === 'project-logs') refreshLogs();
    if (page === 'project-deployments') loadDeployments();
    if (page === 'project-env') renderEnvVars();
    if (page === 'project-settings') renderSettings();
    if (page === 'project-console') document.getElementById('console-input')?.focus();
}

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
    // ===== Projects Page: Premium Selector Grid =====
    const list = document.getElementById('project-list');
    if (projects.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="icon">📦</div><h3>프로젝트가 없습니다</h3><p>New Project 버튼을 눌러 첫 번째 프로젝트를 추가하세요.</p></div>`;
    } else {
        list.innerHTML = `<div class="selector-grid">${projects.map(p => {
            const statusColors = { running: '#3fb950', stopped: '#484f58', building: '#d29922', failed: '#f85149' };
            const statusGlow = p.status === 'running' ? `box-shadow: 0 0 20px ${statusColors.running}22, inset 0 1px 0 rgba(255,255,255,0.05);` : '';
            const updatedAt = p.updated_at ? timeAgo(p.updated_at) : timeAgo(p.created_at);
            const sourceIcon = p.source_type === 'upload' ? '📁' : '🔗';
            const sourceLabel = p.source_type === 'upload' ? '직접 업로드' : extractRepoName(p.github_url);
            return `
        <div class="selector-card" onclick="openProject(${p.id})" style="${statusGlow}">
          <div class="selector-card-top">
            <div class="selector-status-dot" style="background:${statusColors[p.status] || '#484f58'};${p.status === 'running' ? `box-shadow:0 0 8px ${statusColors.running};` : ''}"></div>
            <span class="selector-status-label">${statusLabel(p.status)}</span>
          </div>
          <div class="selector-card-name">${escapeHtml(p.name)}</div>
          <div class="selector-card-repo">${sourceIcon} ${sourceLabel}</div>
          <div class="selector-card-footer">
            <span>${p.source_type === 'upload' ? '업로드' : p.branch}</span>
            <span>${updatedAt}</span>
          </div>
        </div>`;
        }).join('')}</div>`;
    }

    // ===== Dashboard: Compact Status Cards =====
    const dashList = document.getElementById('dashboard-project-list');
    if (dashList) {
        dashList.innerHTML = projects.map(p => {
            const statusColors = { running: '#3fb950', stopped: '#484f58', building: '#d29922', failed: '#f85149' };
            const sourceLabel = p.source_type === 'upload' ? '📁 업로드' : `${extractRepoName(p.github_url)} · ${p.branch}`;
            return `
        <div class="dash-project-row" onclick="openProject(${p.id})">
          <div class="selector-status-dot" style="background:${statusColors[p.status] || '#484f58'};${p.status === 'running' ? `box-shadow:0 0 6px ${statusColors.running};` : ''}"></div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:15px;margin-bottom:2px;">${escapeHtml(p.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sourceLabel}</div>
          </div>
          <span class="badge badge-${p.status}" style="font-size:11px;">${statusLabel(p.status)}</span>
        </div>`;
        }).join('');
    }
}

function updateStats(projects) {
    document.getElementById('stat-total').textContent = projects.length;
    document.getElementById('stat-running').textContent = projects.filter(p => p.status === 'running').length;
    document.getElementById('stat-stopped').textContent = projects.filter(p => p.status === 'stopped' || p.status === 'failed').length;
    document.getElementById('stat-building').textContent = projects.filter(p => p.status === 'building').length;
}

// ============ PROJECT DETAIL ============

async function openProject(id) {
    try {
        const res = await fetch(`${API}/projects/${id}`);
        currentProject = await res.json();
        navigateTo('project-overview');
    } catch (error) {
        toast('프로젝트 로드 실패', 'error');
    }
}

function renderProjectOverview() {
    const p = currentProject;
    if (!p) return;
    const localUrl = `http://${serverHost}:${p.port}`;
    const siteUrl = p.custom_domain ? `http://${p.custom_domain}` : (p.tunnel_url || localUrl);
    const urlLabel = p.custom_domain || (p.tunnel_url ? p.tunnel_url.replace('https://', '') : `${serverHost}:${p.port}`);

    document.getElementById('overview-content').innerHTML = `
    ${p.status === 'running' ? `
    <div style="background:linear-gradient(135deg,rgba(63,185,80,0.15),rgba(88,166,255,0.1));border:1px solid var(--success);border-radius:var(--radius-lg);padding:24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:var(--success);margin-bottom:8px;font-weight:600;">🟢 사이트 실행 중</div>
      <a href="${siteUrl}" target="_blank" style="color:var(--accent);font-size:22px;font-weight:700;text-decoration:none;">${urlLabel}</a>
      ${p.custom_domain ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">터널: ${p.tunnel_url || 'N/A'}</div>` : ''}
      <div style="margin-top:12px;"><a class="btn btn-primary" href="${siteUrl}" target="_blank" style="text-decoration:none;">🌐 사이트 열기</a></div>
    </div>` : `
    <div style="background:rgba(139,148,158,0.1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;font-weight:600;">⏹ 중지됨</div>
      <button class="btn btn-success" onclick="openDeployOptions(${p.id})">▶ 배포 시작</button>
    </div>`}
    <div id="resource-monitor"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">상태</div>
        <span class="badge badge-${p.status}" style="font-size:14px;padding:4px 12px;">${statusLabel(p.status)}</span>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">사이트 URL</div>
        <a href="${siteUrl}" target="_blank" style="color:var(--accent);">${urlLabel}</a>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">소스</div>
        ${p.source_type === 'upload' ? `
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:var(--accent);">📁 직접 업로드</span>
          <button class="btn-clone-backup" onclick="triggerReupload(${p.id})" title="새 ZIP 파일로 업데이트">
            <span class="btn-clone-icon">📤</span> 재업로드
          </button>
          <input type="file" id="reupload-file-${p.id}" accept=".zip" style="display:none;" onchange="doReupload(${p.id}, this)">
        </div>` : `
        <div style="display:flex;align-items:center;gap:8px;">
          <a href="${p.github_url}" target="_blank" style="color:var(--accent);">${extractRepoName(p.github_url)}</a>
          <button class="btn-clone-backup" id="btn-clone-backup" onclick="cloneBackup(${p.id})" title="GitClones 폴더에 백업 클론">
            <span class="btn-clone-icon">📥</span> 클론
          </button>
        </div>`}
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">Branch</div>
        <span>${p.source_type === 'upload' ? '-' : p.branch}</span>
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
    <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);">📁 미디어 백업</div>
        <div style="display:flex;gap:8px;">
          <button class="btn-clone-backup" id="btn-media-backup" onclick="mediaBackup(${p.id})" title="DATA 드라이브에 미디어 백업">
            <span class="btn-clone-icon">📁</span> 백업
          </button>
          <button class="btn-clone-backup" id="btn-media-restore" onclick="mediaRestore(${p.id})" title="백업에서 미디어 복원" style="border-color:var(--warning);color:var(--warning);">
            <span class="btn-clone-icon">🔄</span> 복구
          </button>
        </div>
      </div>
      <div id="media-backup-status" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;font-size:13px;color:var(--text-secondary);">
        백업 상태 확인 중...
      </div>
    </div>
    <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);">📦 프로젝트 백업 <span style="font-size:12px;font-weight:400;color:var(--text-muted);">(DATA 드라이브)</span></div>
        <div style="display:flex;gap:8px;">
          <button class="btn-clone-backup" id="btn-project-backup" onclick="projectBackup(${p.id})" title="DATA 드라이브에 프로젝트 전체 백업">
            <span class="btn-clone-icon">📦</span> 백업
          </button>
          <button class="btn-clone-backup" id="btn-project-restore" onclick="projectRestore(${p.id})" title="백업에서 프로젝트 복원" style="border-color:var(--warning);color:var(--warning);">
            <span class="btn-clone-icon">🔄</span> 복원
          </button>
        </div>
      </div>
      <div id="project-backup-status" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;font-size:13px;color:var(--text-secondary);">
        백업 상태 확인 중...
      </div>
    </div>`;
    if (p.status === 'running') loadResourceStats(p.id);
    loadMediaBackupStatus(p.id);
    loadProjectBackupStatus(p.id);
}

function renderSettings() {
    const p = currentProject;
    if (!p) return;
    const webhookUrl = `${window.location.origin}/api/webhooks/github`;
    document.getElementById('settings-content').innerHTML = `
    <div class="form-group"><label>프로젝트 이름</label><input type="text" id="set-name" value="${escapeHtml(p.name)}"></div>
    <div class="form-group"><label>GitHub URL</label><input type="text" id="set-github" value="${escapeHtml(p.github_url)}"></div>
    <div class="form-group"><label>Branch</label><input type="text" id="set-branch" value="${p.branch}"></div>
    <div class="form-group"><label>빌드 명령어</label><input type="text" id="set-build" value="${escapeHtml(p.build_command || '')}"></div>
    <div class="form-group"><label>시작 명령어</label><input type="text" id="set-start" value="${escapeHtml(p.start_command || '')}"></div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
      <label style="font-size:15px;font-weight:600;">🌐 커스텀 도메인</label>
      <input type="text" id="set-custom-domain" value="${escapeHtml(p.custom_domain || '')}" placeholder="예: myapp.example.com">
      <div class="form-hint">도메인의 DNS A 레코드를 이 서버 IP로 설정한 후 입력하세요</div>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
      <label style="font-size:15px;font-weight:600;">🔄 배포 모드</label>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
        <label class="toggle-switch"><input type="checkbox" id="set-autodeploy" ${p.auto_deploy !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
        <span style="font-size:14px;color:var(--text-secondary);">${p.auto_deploy !== false ? '자동 배포 활성' : '수동 배포'}</span>
      </div>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
      <label style="font-size:15px;font-weight:600;">🔗 GitHub Webhook URL</label>
      <div class="form-hint">GitHub 레포 → Settings → Webhooks → Add webhook</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
        <input type="text" value="${webhookUrl}" readonly style="flex:1;background:var(--surface);cursor:text;" id="webhook-url-input">
        <button class="btn btn-sm btn-ghost" onclick="copyWebhookUrl()">📋 복사</button>
      </div>
      <div class="form-hint" style="margin-top:4px;">Content type: <code>application/json</code> | Secret: <code>orbitron-secret</code></div>
    </div>
    <button class="btn btn-primary" onclick="saveSettings()">설정 저장</button>
    <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:24px;">
      <button class="btn btn-danger" onclick="deleteProject(${p.id})">🗑 프로젝트 삭제</button>
    </div>`;
}

let currentSourceTab = 'github';
let selectedUploadFile = null;

function switchSourceTab(tab) {
    currentSourceTab = tab;
    document.getElementById('tab-github').classList.toggle('active', tab === 'github');
    document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
    document.getElementById('form-github-source').style.display = tab === 'github' ? 'block' : 'none';
    document.getElementById('form-upload-source').style.display = tab === 'upload' ? 'block' : 'none';
    const createBtn = document.getElementById('btn-create-project');
    if (createBtn) createBtn.textContent = tab === 'upload' ? '업로드 & 배포' : '프로젝트 생성';
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (file) {
        selectedUploadFile = file;
        const content = document.getElementById('upload-dropzone-content');
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        content.innerHTML = `
            <div class="upload-icon">✅</div>
            <div class="upload-text">${escapeHtml(file.name)}</div>
            <div class="upload-hint">${sizeMB} MB · 클릭하여 다른 파일 선택</div>
        `;
        document.getElementById('upload-dropzone').classList.add('has-file');
    }
}

async function createProject() {
    if (currentSourceTab === 'upload') {
        return createUploadProject();
    }
    const name = document.getElementById('input-name').value.trim();
    const github_url = document.getElementById('input-github').value.trim();
    const branch = document.getElementById('input-branch').value.trim() || 'main';
    const build_command = document.getElementById('input-build').value.trim();
    const start_command = document.getElementById('input-start').value.trim();
    const port = document.getElementById('input-port').value ? parseInt(document.getElementById('input-port').value) : null;
    const subdomain = document.getElementById('input-subdomain').value.trim() || null;
    if (!name || !github_url) { toast('프로젝트 이름과 GitHub URL은 필수입니다.', 'error'); return; }
    const auto_deploy = document.getElementById('input-autodeploy')?.checked ?? true;
    try {
        const res = await fetch(`${API}/projects`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, github_url, branch, build_command, start_command, port, subdomain, auto_deploy })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast('프로젝트가 생성되었습니다!', 'success');
        closeModal();
        loadProjects();
    } catch (error) { toast(error.message, 'error'); }
}

async function createUploadProject() {
    const name = document.getElementById('upload-name').value.trim();
    if (!name) { toast('프로젝트 이름은 필수입니다.', 'error'); return; }
    if (!selectedUploadFile) { toast('ZIP 파일을 선택해주세요.', 'error'); return; }

    const formData = new FormData();
    formData.append('zipfile', selectedUploadFile);
    formData.append('name', name);
    formData.append('build_command', document.getElementById('upload-build').value.trim());
    formData.append('start_command', document.getElementById('upload-start').value.trim());
    formData.append('port', document.getElementById('upload-port').value || '');
    formData.append('subdomain', document.getElementById('upload-subdomain').value.trim());

    const createBtn = document.getElementById('btn-create-project');
    createBtn.disabled = true;
    createBtn.textContent = '업로드 중...';

    try {
        const res = await fetch(`${API}/projects/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken() || ''}` },
            body: formData
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        const project = await res.json();
        toast('프로젝트가 업로드되었습니다! 배포를 시작합니다.', 'success');
        closeModal();
        loadProjects();
        openDeployModal(project.id);
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = '업로드 & 배포';
    }
}

function triggerReupload(projectId) {
    const input = document.getElementById(`reupload-file-${projectId}`);
    if (input) input.click();
}

async function doReupload(projectId, input) {
    const file = input.files[0];
    if (!file) return;
    if (!confirm(`"${file.name}"으로 소스 코드를 교체하고 재배포하시겠습니까?`)) { input.value = ''; return; }

    const formData = new FormData();
    formData.append('zipfile', file);

    toast('소스 코드 업로드 중...', 'info');
    try {
        const res = await fetch(`${API}/projects/${projectId}/reupload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken() || ''}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            toast('✅ ' + data.message, 'success');
            openDeployModal(projectId);
        } else {
            toast('❌ 재업로드 실패: ' + (data.error || '알 수 없는 오류'), 'error');
        }
    } catch (e) {
        toast('❌ 재업로드 실패: ' + e.message, 'error');
    }
    input.value = '';
}

async function deployProject(id, commitHash = null) {
    try {
        openDeployModal(id);
        const body = commitHash ? JSON.stringify({ commit_hash: commitHash }) : '{}';
        await fetch(`${API}/projects/${id}/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
    } catch (error) { toast('배포 요청 실패: ' + error.message, 'error'); }
}

async function stopProject(id) {
    try {
        await fetch(`${API}/projects/${id}/stop`, { method: 'POST' });
        toast('프로젝트가 중지되었습니다.', 'success');
        loadProjects();
        if (currentProject?.id === id) { currentProject.status = 'stopped'; navigateTo(currentPage); }
    } catch (error) { toast('중지 실패: ' + error.message, 'error'); }
}

async function deleteProject(id) {
    if (!confirm('정말로 이 프로젝트를 삭제하시겠습니까?')) return;
    try {
        await fetch(`${API}/projects/${id}`, { method: 'DELETE' });
        toast('프로젝트가 삭제되었습니다.', 'success');
        currentProject = null;
        navigateTo('projects');
        loadProjects();
    } catch (error) { toast('삭제 실패: ' + error.message, 'error'); }
}

// ============ ENV VARS ============

function renderEnvVars() {
    if (!currentProject) return;
    const envVars = currentProject.env_vars || {};
    const container = document.getElementById('env-content');
    const entries = Object.entries(envVars);
    if (entries.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">환경변수가 없습니다.</p>';
    } else {
        container.innerHTML = entries.map(([key, val]) => `
      <div class="env-row">
        <input type="text" class="env-key" value="${escapeHtml(key)}" placeholder="KEY">
        <input type="password" class="env-val" value="${escapeHtml(val)}" placeholder="VALUE">
        <button class="btn btn-sm btn-ghost" onclick="toggleEnvVisibility(this)">👁</button>
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
      </div>`).join('');
    }
    const badge = document.getElementById('env-changed-badge');
    if (badge) badge.style.display = 'none';
}

function toggleEnvVisibility(btn) {
    const input = btn.parentElement.querySelector('.env-val');
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

function addEnvRow() {
    const container = document.getElementById('env-content');
    const row = document.createElement('div');
    row.className = 'env-row';
    row.innerHTML = `
    <input type="text" class="env-key" placeholder="KEY">
    <input type="password" class="env-val" placeholder="VALUE">
    <button class="btn btn-sm btn-ghost" onclick="toggleEnvVisibility(this)">👁</button>
    <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>`;
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
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ env_vars: envVars })
        });
        toast('환경변수가 저장되었습니다! 재배포하면 적용됩니다.', 'success');
        currentProject.env_vars = envVars;
        const badge = document.getElementById('env-changed-badge');
        if (badge) badge.style.display = 'inline';
    } catch (error) { toast('저장 실패', 'error'); }
}

async function saveSettings() {
    try {
        const auto_deploy = document.getElementById('set-autodeploy')?.checked ?? true;
        const custom_domain = document.getElementById('set-custom-domain')?.value?.trim() || null;
        await fetch(`${API}/projects/${currentProject.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('set-name').value,
                github_url: document.getElementById('set-github').value,
                branch: document.getElementById('set-branch').value,
                build_command: document.getElementById('set-build').value,
                start_command: document.getElementById('set-start').value,
                auto_deploy, custom_domain,
            })
        });
        currentProject.auto_deploy = auto_deploy;
        currentProject.custom_domain = custom_domain;
        currentProject.name = document.getElementById('set-name').value;
        toast('설정이 저장되었습니다!', 'success');
        loadProjects();
    } catch (error) { toast('저장 실패', 'error'); }
}

async function toggleAutoDeploy(id, enable) {
    try {
        await fetch(`${API}/projects/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auto_deploy: enable })
        });
        toast(enable ? '자동 배포 활성화' : '수동 배포로 전환', 'success');
        loadProjects();
    } catch (error) { toast('변경 실패', 'error'); }
}

function copyWebhookUrl() {
    const input = document.getElementById('webhook-url-input');
    input.select();
    navigator.clipboard.writeText(input.value);
    toast('Webhook URL이 복사되었습니다!', 'success');
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
            document.getElementById('deployments-content').innerHTML = '<p style="color:var(--text-secondary);">배포 이력이 없습니다.</p>';
            return;
        }
        document.getElementById('deployments-content').innerHTML = deployments.map(d => {
            const duration = d.finished_at && d.started_at ? formatDuration(new Date(d.finished_at) - new Date(d.started_at)) : '---';
            return `
      <div class="deploy-item">
        <span class="deploy-status ${d.status}">${statusLabel(d.status)}</span>
        <div class="deploy-info">
          <div class="deploy-commit">${d.commit_hash ? d.commit_hash.substring(0, 7) : '---'} ${escapeHtml(d.commit_message || '')}</div>
          <div class="deploy-time">${timeAgo(d.started_at)} · ⏱ ${duration}</div>
        </div>
        ${d.status === 'success' && d.commit_hash ? `<button class="btn btn-sm btn-ghost btn-rollback" onclick="rollbackTo(${d.id})">↩ 롤백</button>` : ''}
      </div>`;
        }).join('');
    } catch (error) {
        document.getElementById('deployments-content').innerHTML = '<p style="color:var(--danger);">로드 실패</p>';
    }
}

// ============ DEPLOY MONITOR ============

let activeEventSource = null;

function openDeployModal(projectId) {
    const modal = document.getElementById('deploy-modal');
    modal.classList.add('active');
    document.getElementById('deploy-modal-title').textContent = '🚀 배포 진행 중...';
    document.getElementById('deploy-progress-fill').style.width = '0%';
    document.getElementById('deploy-progress-fill').className = 'deploy-progress-fill';
    document.getElementById('deploy-progress-label').textContent = '배포를 시작합니다...';
    document.getElementById('deploy-log-viewer').textContent = '';
    document.getElementById('deploy-log-viewer').classList.remove('collapsed');

    const defaultSteps = [
        { id: 'clone', label: '📥 소스 코드 가져오기' },
        { id: 'build', label: '🔨 Docker 이미지 빌드' },
        { id: 'container', label: '🚀 컨테이너 시작' },
        { id: 'nginx', label: '🌐 프록시 설정' },
        { id: 'tunnel', label: '🔗 외부 접속 터널 생성' },
        { id: 'done', label: '✅ 배포 완료' },
    ];
    document.getElementById('deploy-steps').innerHTML = defaultSteps.map(s => `
        <div class="deploy-step" id="step-${s.id}">
          <div class="deploy-step-icon">●</div>
          <div class="deploy-step-label">${s.label}</div>
        </div>`).join('');

    if (activeEventSource) activeEventSource.close();
    const es = new EventSource(`${API}/deploy-stream/${projectId}?token=${getToken() || ''}`);
    activeEventSource = es;
    let completedSteps = [];

    es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return;
        document.getElementById('deploy-progress-fill').style.width = data.progress + '%';
        document.getElementById('deploy-progress-label').textContent = data.message;
        const currentStepId = data.stepId;

        if (!completedSteps.includes(currentStepId)) {
            defaultSteps.forEach(s => {
                const el = document.getElementById(`step-${s.id}`);
                if (el && completedSteps.includes(s.id)) {
                    el.className = 'deploy-step completed';
                    el.querySelector('.deploy-step-icon').textContent = '✓';
                }
            });
        }

        const currentEl = document.getElementById(`step-${currentStepId}`);
        if (currentEl) {
            if (data.status === 'success') {
                currentEl.className = 'deploy-step completed';
                currentEl.querySelector('.deploy-step-icon').textContent = '✓';
                document.getElementById('deploy-progress-fill').classList.add('done');
                document.getElementById('deploy-modal-title').textContent = '✅ 배포 완료!';
                document.getElementById('deploy-log-viewer').textContent += '\n✅ 배포가 성공적으로 완료되었습니다!\n';
                es.close(); activeEventSource = null; loadProjects();
                if (currentProject?.id === projectId) openProject(projectId);
            } else if (data.status === 'failed') {
                currentEl.className = 'deploy-step failed';
                currentEl.querySelector('.deploy-step-icon').textContent = '✕';
                document.getElementById('deploy-progress-fill').style.background = 'var(--danger)';
                document.getElementById('deploy-progress-fill').classList.add('done');
                document.getElementById('deploy-modal-title').textContent = '❌ 배포 실패';
                es.close(); activeEventSource = null; loadProjects();
            } else {
                currentEl.className = 'deploy-step active';
                currentEl.querySelector('.deploy-step-icon').textContent = '◉';
            }
        }

        if (data.status === 'running' && !completedSteps.includes(currentStepId)) {
            for (const s of defaultSteps) {
                if (s.id === currentStepId) break;
                if (!completedSteps.includes(s.id)) {
                    completedSteps.push(s.id);
                    const el = document.getElementById(`step-${s.id}`);
                    if (el) { el.className = 'deploy-step completed'; el.querySelector('.deploy-step-icon').textContent = '✓'; }
                }
            }
        }

        const logViewer = document.getElementById('deploy-log-viewer');
        const timestamp = new Date(data.timestamp).toLocaleTimeString('ko-KR');
        logViewer.textContent += `[${timestamp}] ${data.message}\n`;
        logViewer.scrollTop = logViewer.scrollHeight;
    };

    let sseRetried = false;
    es.onerror = () => {
        if (!sseRetried) {
            sseRetried = true;
            // Retry SSE once
            setTimeout(() => {
                if (activeEventSource === es) {
                    es.close();
                    const es2 = new EventSource(`${API}/deploy-stream/${projectId}?token=${getToken() || ''}`);
                    activeEventSource = es2;
                    es2.onmessage = es.onmessage;
                    es2.onerror = es.onerror;
                }
            }, 2000);
            return;
        }
        // SSE failed twice — fallback to polling
        es.close(); activeEventSource = null;
        document.getElementById('deploy-progress-label').textContent = '빌드 진행 중... (상태 확인 중)';
        const poll = setInterval(async () => {
            try {
                const res = await fetch(`${API}/projects`);
                const projects = await res.json();
                const p = projects.find(x => x.id === projectId);
                if (!p) { clearInterval(poll); return; }
                if (p.status === 'running') {
                    clearInterval(poll);
                    document.getElementById('deploy-progress-fill').style.width = '100%';
                    document.getElementById('deploy-progress-fill').classList.add('done');
                    document.getElementById('deploy-modal-title').textContent = '✅ 배포 완료!';
                    document.getElementById('deploy-progress-label').textContent = '배포가 성공적으로 완료되었습니다!';
                    document.querySelectorAll('.deploy-step').forEach(el => {
                        el.className = 'deploy-step completed';
                        el.querySelector('.deploy-step-icon').textContent = '✓';
                    });
                    loadProjects();
                    if (currentProject?.id === projectId) openProject(projectId);
                } else if (p.status === 'failed') {
                    clearInterval(poll);
                    document.getElementById('deploy-progress-fill').style.background = 'var(--danger)';
                    document.getElementById('deploy-progress-fill').classList.add('done');
                    document.getElementById('deploy-modal-title').textContent = '❌ 배포 실패';
                    document.getElementById('deploy-progress-label').textContent = '배포에 실패했습니다.';
                    loadProjects();
                }
            } catch (e) { /* keep polling */ }
        }, 3000);
    };
}

function closeDeployModal() {
    document.getElementById('deploy-modal').classList.remove('active');
    if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
    loadProjects();
}

function toggleDeployLog() { document.getElementById('deploy-log-viewer').classList.toggle('collapsed'); }

function openDeployOptions(projectId) {
    const modal = document.getElementById('deploy-options-modal');
    modal.classList.add('active');
    modal.dataset.projectId = projectId;

    const list = document.getElementById('deploy-options-list');
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">커밋 목록을 불러오는 중...</div>';

    fetch(`${API}/projects/${projectId}/commits`)
        .then(res => res.json())
        .then(commits => {
            if (!commits || commits.length === 0) {
                list.innerHTML = `
                    <div class="commit-option" onclick="this.querySelector('input').checked=true" style="display:flex; align-items:flex-start; gap:10px; padding:10px; border:1px solid var(--border); border-radius:6px; cursor:pointer; background:var(--bg-primary);">
                        <input type="radio" name="deploy_commit" value="" checked style="width:16px; height:16px; margin-top:2px; flex-shrink:0;">
                        <div>
                            <div style="font-weight:600; font-size:14px;">최신 브랜치 (Latest)</div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">소스 코드를 아직 가져오지 않았거나 커밋이 없습니다.</div>
                        </div>
                    </div>
                `;
                return;
            }

            let html = `
                <div class="commit-option" onclick="this.querySelector('input').checked=true" style="display:flex; align-items:flex-start; gap:10px; padding:10px; border:1px solid var(--success); border-radius:6px; cursor:pointer; background:rgba(63,185,80,0.05); margin-bottom:6px;">
                    <input type="radio" name="deploy_commit" value="" checked style="width:16px; height:16px; margin-top:2px; flex-shrink:0;">
                    <div style="min-width:0;">
                        <div style="font-weight:600; font-size:13px; color:var(--success);">🌟 최신 브랜치로 배포 (Default)</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">GitHub의 최신 코드를 당겨와 배포합니다.</div>
                    </div>
                </div>
            `;

            commits.forEach(c => {
                const dateStr = new Date(c.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                html += `
                    <div class="commit-option" onclick="this.querySelector('input').checked=true" style="display:flex; align-items:flex-start; gap:10px; padding:10px; border:1px solid var(--border); border-radius:6px; cursor:pointer; background:var(--bg-primary); margin-bottom:6px;">
                        <input type="radio" name="deploy_commit" value="${c.hash}" style="width:16px; height:16px; margin-top:2px; flex-shrink:0;">
                        <div style="min-width:0; flex:1;">
                            <div style="font-weight:600; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.message)}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:3px; display:flex; gap:6px; flex-wrap:wrap;">
                                <span style="font-family:monospace; background:var(--surface); padding:1px 5px; border-radius:3px; font-size:11px;">${c.shortHash}</span>
                                <span>👤 ${escapeHtml(c.author)}</span>
                                <span>🕒 ${dateStr}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            list.innerHTML = html;
        })
        .catch(() => {
            list.innerHTML = '<div style="color:var(--danger); padding:20px; text-align:center;">목록을 불러오는데 실패했습니다.</div>';
        });
}

function closeDeployOptions() {
    document.getElementById('deploy-options-modal').classList.remove('active');
}

function confirmDeploySelect() {
    const modal = document.getElementById('deploy-options-modal');
    const projectId = modal.dataset.projectId;
    if (!projectId) return;

    const selected = document.querySelector('input[name="deploy_commit"]:checked');
    const commitHash = selected ? selected.value : null;

    closeDeployOptions();
    deployProject(projectId, commitHash || null);
}

// ============ NEW FEATURES ============

async function loadResourceStats(projectId) {
    try {
        const res = await fetch(`${API}/projects/${projectId}/stats`);
        const stats = await res.json();
        const monitor = document.getElementById('resource-monitor');
        if (!monitor) return;
        const cpuVal = parseFloat(stats.cpu) || 0;
        const memVal = parseFloat(stats.memPercent) || 0;
        const uptime = formatUptime(stats.uptime || 0);
        monitor.innerHTML = `
        <div class="resource-grid">
          <div class="resource-card"><div class="resource-label">💻 CPU</div><div class="resource-value" style="color:var(--accent)">${cpuVal.toFixed(1)}%</div><div class="resource-bar"><div class="resource-bar-fill cpu" style="width:${Math.min(cpuVal, 100)}%"></div></div></div>
          <div class="resource-card"><div class="resource-label">🧠 메모리</div><div class="resource-value" style="color:var(--purple)">${stats.memUsage}</div><div class="resource-bar"><div class="resource-bar-fill mem" style="width:${Math.min(memVal, 100)}%"></div></div></div>
          <div class="resource-card"><div class="resource-label">⏱ Uptime</div><div class="resource-value">${uptime}</div></div>
          <div class="resource-card"><div class="resource-label">🌐 Network I/O</div><div class="resource-value" style="font-size:14px">${stats.netIO}</div></div>
        </div>`;
    } catch (e) { /* ignore */ }
}

async function rollbackTo(deploymentId) {
    if (!confirm('이 버전으로 롤백하시겠습니까?')) return;
    try {
        openDeployModal(currentProject.id);
        await fetch(`${API}/projects/${currentProject.id}/rollback`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deployment_id: deploymentId })
        });
    } catch (e) { toast('롤백 실패: ' + e.message, 'error'); }
}

async function execCommand() {
    const input = document.getElementById('console-input');
    const output = document.getElementById('console-output');
    const cmd = input.value.trim();
    if (!cmd || !currentProject) return;
    output.textContent += `$ ${cmd}\n`;
    input.value = '';
    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/exec`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        output.textContent += (data.output || '(no output)') + '\n';
    } catch (e) { output.textContent += `Error: ${e.message}\n`; }
    output.scrollTop = output.scrollHeight;
}

function openBulkImport() {
    document.getElementById('bulk-import-modal').classList.add('active');
    document.getElementById('bulk-env-input').value = '';
    document.getElementById('bulk-env-input').focus();
}
function closeBulkImport() { document.getElementById('bulk-import-modal').classList.remove('active'); }

function applyBulkImport() {
    const raw = document.getElementById('bulk-env-input').value;
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const container = document.getElementById('env-content');
    lines.forEach(line => {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.substring(0, eqIdx).trim();
        const val = line.substring(eqIdx + 1).trim();
        if (!key) return;
        const row = document.createElement('div');
        row.className = 'env-row';
        row.innerHTML = `
        <input type="text" class="env-key" value="${escapeHtml(key)}" placeholder="KEY">
        <input type="password" class="env-val" value="${escapeHtml(val)}" placeholder="VALUE">
        <button class="btn btn-sm btn-ghost" onclick="toggleEnvVisibility(this)">👁</button>
        <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>`;
        container.appendChild(row);
    });
    closeBulkImport();
    toast(`${lines.length}개 변수가 추가되었습니다`, 'success');
}

// ============ CLONE BACKUP ============

async function cloneBackup(projectId) {
    const btn = document.getElementById('btn-clone-backup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-clone-spinner"></span> 클론 중...';
    }
    try {
        const res = await fetch(`${API}/projects/${projectId}/clone-backup`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            const actionLabel = data.action === 'cloned' ? '클론 완료' : '업데이트 완료';
            toast(`✅ ${actionLabel}: ${data.path}`, 'success');
        } else {
            toast(`❌ 클론 실패: ${data.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (e) {
        toast(`❌ 클론 실패: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-clone-icon">📥</span> 클론';
        }
    }
}

// ============ MEDIA BACKUP ============

async function mediaBackup(projectId) {
    const btn = document.getElementById('btn-media-backup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-clone-spinner"></span> 백업 중...';
    }
    try {
        const res = await fetch(`${API}/projects/${projectId}/media-backup`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            toast(`✅ ${data.message}`, 'success');
            loadMediaBackupStatus(projectId);
        } else {
            toast(`❌ 백업 실패: ${data.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (e) {
        toast(`❌ 백업 실패: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-clone-icon">📁</span> 백업';
        }
    }
}

async function mediaRestore(projectId) {
    if (!confirm('백업에서 미디어 파일을 복원하시겠습니까?\n원본 파일이 백업 파일로 덮어씌워집니다.')) return;
    const btn = document.getElementById('btn-media-restore');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-clone-spinner"></span> 복구 중...';
    }
    try {
        const res = await fetch(`${API}/projects/${projectId}/media-restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            toast(`✅ ${data.message}`, 'success');
        } else {
            toast(`❌ 복구 실패: ${data.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (e) {
        toast(`❌ 복구 실패: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-clone-icon">🔄</span> 복구';
        }
    }
}

async function loadMediaBackupStatus(projectId) {
    const container = document.getElementById('media-backup-status');
    if (!container) return;
    try {
        const res = await fetch(`${API}/projects/${projectId}/media-backup/status`);
        const status = await res.json();
        if (status.exists) {
            const backupTime = new Date(status.lastBackupTime).toLocaleString('ko-KR');
            container.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div>📅 마지막 백업: <strong>${backupTime}</strong></div>
                    <div>📄 파일 수: <strong>${status.fileCount}개</strong></div>
                    <div>💾 총 크기: <strong>${status.totalSizeFormatted}</strong></div>
                    <div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${status.backupDir}">📂 ${status.backupDir}</div>
                </div>`;
        } else {
            container.innerHTML = '<span style="color:var(--text-muted);">⚠️ 아직 백업이 없습니다. 백업 버튼을 눌러 미디어 파일을 백업하세요.</span>';
        }
    } catch (e) {
        container.innerHTML = '<span style="color:var(--danger);">백업 상태를 불러올 수 없습니다.</span>';
    }
}

// ============ MODALS ============

function openNewProjectModal() {
    document.getElementById('new-project-modal').classList.add('active');
    // Reset GitHub tab
    document.getElementById('input-name').value = '';
    document.getElementById('input-github').value = '';
    document.getElementById('input-branch').value = 'main';
    document.getElementById('input-build').value = 'npm install';
    document.getElementById('input-start').value = 'npm start';
    document.getElementById('input-port').value = '';
    document.getElementById('input-subdomain').value = '';
    // Reset Upload tab
    document.getElementById('upload-name').value = '';
    document.getElementById('upload-build').value = 'npm install';
    document.getElementById('upload-start').value = 'npm start';
    document.getElementById('upload-port').value = '';
    document.getElementById('upload-subdomain').value = '';
    const uploadFile = document.getElementById('upload-file');
    if (uploadFile) uploadFile.value = '';
    selectedUploadFile = null;
    const dropContent = document.getElementById('upload-dropzone-content');
    if (dropContent) dropContent.innerHTML = `
        <div class="upload-icon">📦</div>
        <div class="upload-text">ZIP 파일을 드래그하거나 클릭하여 선택</div>
        <div class="upload-hint">프로젝트 폴더를 ZIP으로 압축하여 업로드하세요 (최대 500MB)</div>
    `;
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone) dropzone.classList.remove('has-file');
    // Reset to GitHub tab
    switchSourceTab('github');
    document.getElementById('input-name').focus();
}

function closeModal() { document.getElementById('new-project-modal').classList.remove('active'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
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
    if (seconds < 0) return '방금 전';
    if (seconds < 60) return '방금 전';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    return `${Math.floor(seconds / 86400)}일 전`;
}

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}초`;
    if (s < 3600) return `${Math.floor(s / 60)}분`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
    return `${Math.floor(s / 86400)}일 ${Math.floor((s % 86400) / 3600)}시간`;
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}초`;
    return `${Math.floor(s / 60)}분 ${s % 60}초`;
}

function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// ============ PROJECT BACKUP ============

async function projectBackup(projectId) {
    const btn = document.getElementById('btn-project-backup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-clone-spinner"></span> 백업 중...';
    }
    try {
        const res = await fetch(`${API}/projects/${projectId}/project-backup`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            toast(`✅ ${data.message}`, 'success');
            loadProjectBackupStatus(projectId);
        } else {
            toast(`❌ 백업 실패: ${data.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (e) {
        toast(`❌ 백업 실패: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-clone-icon">📦</span> 백업';
        }
    }
}

async function projectRestore(projectId) {
    if (!confirm('백업에서 프로젝트를 복원하시겠습니까?\n현재 소스 코드가 백업 파일로 덮어씌워집니다.')) return;
    const btn = document.getElementById('btn-project-restore');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-clone-spinner"></span> 복원 중...';
    }
    try {
        const res = await fetch(`${API}/projects/${projectId}/project-restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            toast(`✅ ${data.message}`, 'success');
        } else {
            toast(`❌ 복원 실패: ${data.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (e) {
        toast(`❌ 복원 실패: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-clone-icon">🔄</span> 복원';
        }
    }
}

async function loadProjectBackupStatus(projectId) {
    const container = document.getElementById('project-backup-status');
    if (!container) return;
    try {
        const res = await fetch(`${API}/projects/${projectId}/project-backup/status`);
        const status = await res.json();
        if (status.exists) {
            const backupTime = new Date(status.lastBackupTime).toLocaleString('ko-KR');
            container.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div>📅 마지막 백업: <strong>${backupTime}</strong></div>
                    <div>💾 크기: <strong>${status.totalSizeFormatted}</strong></div>
                    <div style="grid-column:1/3;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${status.backupDir}">📂 ${status.backupDir}</div>
                </div>`;
        } else {
            container.innerHTML = '<span style="color:var(--text-muted);">⚠️ 아직 백업이 없습니다. 배포 시 자동으로 백업됩니다.</span>';
        }
    } catch (e) {
        container.innerHTML = '<span style="color:var(--danger);">백업 상태를 불러올 수 없습니다.</span>';
    }
}

// ============ DRAG & DROP ============

document.addEventListener('DOMContentLoaded', () => {
    // Setup dropzone
    setTimeout(() => {
        const dropzone = document.getElementById('upload-dropzone');
        if (!dropzone) return;
        dropzone.addEventListener('click', () => document.getElementById('upload-file').click());
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.zip') || file.type.includes('zip'))) {
                const input = document.getElementById('upload-file');
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                handleFileSelect(input);
            } else {
                toast('ZIP 파일만 업로드할 수 있습니다.', 'error');
            }
        });
    }, 500);
});

// ============ INIT ============

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
