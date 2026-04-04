// Orbitron Dashboard - Frontend JavaScript (Sidebar Layout)

const API = '/api';
let currentProject = null;
let serverHost = 'localhost';
let currentPage = 'dashboard';

const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
};

const getToken = () => {
    let token = localStorage.getItem('orbitron_token');
    if (!token) {
        token = getCookie('twinverse_token');
        if (token) localStorage.setItem('orbitron_token', token);
    }
    return token;
};

const setToken = (t) => {
    localStorage.setItem('orbitron_token', t);
    // Sync token across *.twinverse.org domain
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const domainStr = isLocal ? '' : 'domain=.twinverse.org; ';
    document.cookie = `twinverse_token=${t}; ${domainStr}path=/; max-age=604800; samesite=lax`;
};

// SSO Config
const originIsLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REMOTEAGT_ORIGIN = originIsLocal ? `http://${window.location.hostname}:4100` : 'https://remoteagt.twinverse.org';

// Sync token to RemoteAGT via hidden iframe
function ssoSyncToRemoteAGT(token, user) {
    try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${REMOTEAGT_ORIGIN}/sso-sync.html`;
        iframe.onload = () => {
            iframe.contentWindow.postMessage(
                { action: 'sso_login', token, user },
                REMOTEAGT_ORIGIN
            );
            setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) { } }, 500);
        };
        iframe.onerror = () => { try { document.body.removeChild(iframe); } catch (e) { } };
        document.body.appendChild(iframe);
    } catch (e) { /* SSO sync is best-effort */ }
}
function ssoLogoutRemoteAGT() {
    try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${REMOTEAGT_ORIGIN}/sso-sync.html`;
        iframe.onload = () => {
            iframe.contentWindow.postMessage({ action: 'sso_logout' }, REMOTEAGT_ORIGIN);
            setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) { } }, 500);
        };
        document.body.appendChild(iframe);
    } catch (e) { }
}
function isAdminUser() {
    try {
        const token = getToken();
        if (!token) return false;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        return payload.role === 'admin' || payload.role === 'superadmin';
    } catch (e) { return false; }
}
function isSuperAdmin() {
    try {
        const token = getToken();
        if (!token) return false;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        return payload.role === 'superadmin';
    } catch (e) { return false; }
}
function isViewerUser() {
    try {
        const token = getToken();
        if (!token) return false;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        return payload.role === 'viewer';
    } catch (e) { return false; }
}
function viewerBlock() {
    toast('🔒 읽기 전용 계정입니다. 관리자에게 권한 승격을 요청하세요.', 'error');
    return false;
}

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
        // SSO: sync token to RemoteAGT
        ssoSyncToRemoteAGT(data.token, data.user);
        document.getElementById('login-modal').classList.remove('active');
        document.getElementById('input-login-email').value = '';
        document.getElementById('input-login-password').value = '';
        toast(`${data.user.username}님, 환영합니다! 🪐`, 'success');
        init();
    } catch (e) { errorEl.textContent = '서버에 연결할 수 없습니다.'; }
}

function logout() {
    localStorage.removeItem('orbitron_token');
    document.cookie = 'orbitron_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const domainStr = isLocal ? '' : 'domain=.twinverse.org; ';
    document.cookie = `twinverse_token=; ${domainStr}path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    // SSO: logout from RemoteAGT too
    ssoLogoutRemoteAGT();
    setTimeout(() => { window.location.href = '/'; }, 600);
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
        // SSO: sync token to RemoteAGT
        ssoSyncToRemoteAGT(data.token, data.user);
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

    const titles = {
        'dashboard': '📊 대시보드',
        'projects': '📦 프로젝트',
        'deploy-unreal': '🎮 Unreal Engine 서버 배포',
        'deploy-unity': '🎲 Unity WebGL 퍼블리싱',
        'project-overview': `📋 ${currentProject?.name || ''} — 개요`,
        'project-logs': `📄 ${currentProject?.name || ''} — 로그`,
        'project-deployments': `🔄 ${currentProject?.name || ''} — 배포 이력`,
        'project-editor': `📝 ${currentProject?.name || ''} — 소스 에디터`,
        'project-env': `🔧 ${currentProject?.name || ''} — 환경변수`,
        'project-console': `🖥 ${currentProject?.name || ''} — 콘솔`,
        'project-settings': `⚙️ ${currentProject?.name || ''} — 설정`,
        'project-ai': `💬 ${currentProject?.name || ''} — AI 어시스턴트`,
        'groups': '📂 프로젝트 그룹',
        'issues': '🐛 이슈 보드',
        'group-overview': `📂 ${currentGroup?.name || ''} — 서비스 목록`,
        'admin-system': '🖥 시스템 모니터',
        'admin-users': '👥 유저 관리',
        'admin-projects': '🌐 전체 프로젝트',
        'admin-bugs': '🐞 버그 수정 로그',
        'business-plan': '🚀 Orbitron 상용 서비스 계획서',
    };
    document.getElementById('topbar-title').textContent = titles[page] || '';

    // Update topbar actions
    const actions = document.getElementById('topbar-actions');
    if (page.startsWith('project-') && currentProject) {
        // Redundant project actions removed at user's request
    }

    let userInfoHtml = '';
    try {
        const token = getToken();
        if (token) {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            const username = escapeHtml(payload.username || '알 수 없음');
            const role = payload.role === 'superadmin' ? 'Super Admin' : (payload.role === 'admin' ? 'Admin' : 'Viewer');
            const initial = username.charAt(0).toUpperCase();
            userInfoHtml = `
                <div style="display:flex; align-items:center; gap:8px; margin-right:8px; padding-right:12px; border-right:1px solid rgba(255,255,255,0.1);">
                    <div style="width:24px; height:24px; border-radius:50%; background:var(--accent); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; color:#fff;">
                        ${initial}
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-start;">
                        <span style="font-size:12px; font-weight:600; color:var(--text-primary); line-height:1;">${username}</span>
                        <span style="font-size:10px; color:var(--text-muted); line-height:1; margin-top:3px; text-transform:uppercase;">${role}</span>
                    </div>
                </div>
            `;
        }
    } catch (e) { /* ignore */ }

    actions.innerHTML = `
        ${userInfoHtml}
        <div style="display:flex; align-items:center; gap:8px; margin-right:8px; padding-right:12px; border-right:1px solid rgba(255,255,255,0.1); font-size:13px;">
            <a href="#" style="color:var(--text-primary); font-weight:700; text-decoration:none;">KO</a>
            <span style="color:var(--text-muted);">|</span>
            <a href="/index-en.html" style="color:var(--text-muted); text-decoration:none;">EN</a>
        </div>
        <a class="btn btn-sm btn-ghost" href="/" style="text-decoration:none; display:flex; align-items:center; gap:6px;">🏠 홈</a>
        <a class="btn btn-sm btn-ghost" href="${REMOTEAGT_ORIGIN}" style="text-decoration:none; display:flex; align-items:center; gap:6px; color: #58a6ff;">🌐 RemoteAGT</a>
        <button class="btn btn-sm btn-ghost" onclick="logout()" style="display:flex; align-items:center; gap:6px;">⏏ 로그아웃</button>
    `;

    // Remove dynamic show/hide of project sub-nav, it is now permanently visible
    // Update active state styling manually since both dashboard and project views are visible
    document.getElementById('nav-project-section').style.display = 'block';
    document.getElementById('nav-project-items').style.display = 'block';

    // Load page data
    if (page === 'project-overview') renderProjectOverview();
    if (page === 'project-logs') refreshLogs();
    if (page === 'project-deployments') loadDeployments();
    if (page === 'project-env') renderEnvVars();
    if (page === 'project-settings') renderSettings();
    if (page === 'project-console') document.getElementById('console-input')?.focus();
    if (page === 'project-ai') {
        document.getElementById('page-project-ai').style.display = 'flex'; // Ensure flex layout
        loadAiChatHistory();
    } else {
        const aiPage = document.getElementById('page-project-ai');
        if (aiPage) aiPage.style.display = 'none';
    }

    if (page === 'project-editor') {
        document.getElementById('page-project-editor').style.display = 'flex'; // Ensure flex layout for 2-pane editor
        if (!monacoEditor) initMonacoEditor();
        loadProjectFileTree();
    } else {
        const editorPage = document.getElementById('page-project-editor');
        if (editorPage) editorPage.style.display = 'none';
    }

    if (page === 'groups') loadGroups();
    if (page === 'group-overview') renderGroupOverview();
    if (page === 'issues') loadIssues();
    if (page === 'admin-system') renderAdminSystem();
    if (page === 'admin-users') renderAdminUsers();
    if (page === 'admin-projects') renderAdminProjects();
    if (page === 'admin-bugs') loadAdminBugs();
    if (page === 'business-plan') renderBusinessPlan();
}

// ============ PROJECT LIST ============
let allProjectsCache = []; // Cached for dropdown search
let prevProjectStatuses = {}; // Tracks statuses to detect auto-deploys

async function loadProjects() {
    try {
        const res = await fetch(`${API}/projects`);
        if (!res.ok) {
            if (res.status === 401) return;
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const newProjects = await res.json();

        // Check for new background deployments and auto-open modal
        if (Object.keys(prevProjectStatuses).length > 0) {
            newProjects.forEach(p => {
                const oldStatus = prevProjectStatuses[p.id];
                if (oldStatus && oldStatus !== 'building' && p.status === 'building') {
                    const modal = document.getElementById('deploy-modal');
                    if (!modal?.classList.contains('active')) {
                        toast(`🚀 [${p.name}] 자동 배포가 감지되어 실시간 로그를 엽니다.`, 'info');
                        openDeployModal(p.id);
                    }
                }
            });
        }
        newProjects.forEach(p => prevProjectStatuses[p.id] = p.status);

        allProjectsCache = newProjects;

        // Populate custom searchable dropdown
        renderProjectDropdown(allProjectsCache);

        // Auto-select if needed
        if (!currentProject && allProjectsCache.length > 0) {
            await onGlobalProjectSelect(allProjectsCache[0].id, false);
        } else if (!currentProject && allProjectsCache.length === 0) {
            navigateTo(currentPage);
        }

        // For dashboard display: admin shows only selected project's owner's projects
        let displayProjects = allProjectsCache;
        if (currentProject && currentProject.user_id && isAdminUser()) {
            displayProjects = allProjectsCache.filter(p => p.user_id === currentProject.user_id);
        }

        renderProjects(displayProjects);
        updateStats(displayProjects);
        loadDashboardResourceStats();
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// ===== CUSTOM SEARCHABLE PROJECT DROPDOWN =====
const statusColors = { running: '#3fb950', stopped: '#484f58', building: '#d29922', failed: '#f85149' };

function renderProjectDropdown(projects) {
    const listEl = document.getElementById('project-search-list');
    const selectedText = document.getElementById('psd-selected-text');
    if (!listEl) return;

    if (projects.length === 0) {
        listEl.innerHTML = '<div class="psd-empty">생성된 프로젝트 없음</div>';
        if (selectedText) selectedText.textContent = '생성된 프로젝트 없음';
        return;
    }

    listEl.innerHTML = projects.map(p => `
        <div class="psd-item${currentProject && currentProject.id === p.id ? ' selected' : ''}" onclick="selectProjectFromDropdown(${p.id})" data-name="${escapeHtml(p.name).toLowerCase()}" data-owner="${(p.owner_name || '').toLowerCase()}">
            <div class="psd-item-dot" style="background:${statusColors[p.status] || '#484f58'};${p.status === 'running' ? 'box-shadow:0 0 6px ' + statusColors[p.status] + ';' : ''}"></div>
            <div class="psd-item-name">${escapeHtml(p.name)}</div>
            ${p.owner_name ? `<div class="psd-item-owner">${escapeHtml(p.owner_name)}</div>` : ''}
        </div>
    `).join('');

    // Update selected display
    if (currentProject) {
        const owner = projects.find(p => p.id === currentProject.id);
        const ownerStr = owner && owner.owner_name ? ` (${owner.owner_name})` : '';
        if (selectedText) selectedText.textContent = currentProject.name + ownerStr;
    } else if (selectedText) {
        selectedText.textContent = '프로젝트를 선택하세요...';
    }
}

function toggleProjectDropdown() {
    const panel = document.getElementById('project-search-panel');
    const selected = document.getElementById('project-search-selected');
    const searchInput = document.getElementById('project-search-input');
    if (!panel) return;

    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
        closeProjectDropdown();
    } else {
        panel.style.display = 'block';
        selected.classList.add('open');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
            filterProjectDropdown('');
        }
    }
}

function closeProjectDropdown() {
    const panel = document.getElementById('project-search-panel');
    const selected = document.getElementById('project-search-selected');
    if (panel) panel.style.display = 'none';
    if (selected) selected.classList.remove('open');
}

function filterProjectDropdown(query) {
    const items = document.querySelectorAll('#project-search-list .psd-item');
    const q = query.toLowerCase().trim();
    let visibleCount = 0;
    items.forEach(item => {
        const name = item.dataset.name || '';
        const owner = item.dataset.owner || '';
        const match = !q || name.includes(q) || owner.includes(q);
        item.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });
    // Show "no results" message
    let emptyEl = document.getElementById('psd-no-results');
    if (visibleCount === 0) {
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.id = 'psd-no-results';
            emptyEl.className = 'psd-empty';
            document.getElementById('project-search-list').appendChild(emptyEl);
        }
        emptyEl.textContent = `"${query}" 검색 결과 없음`;
        emptyEl.style.display = '';
    } else if (emptyEl) {
        emptyEl.style.display = 'none';
    }
}

async function selectProjectFromDropdown(id) {
    closeProjectDropdown();
    await onGlobalProjectSelect(id);
    // Re-render dropdown to update selected state
    renderProjectDropdown(allProjectsCache);
}

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('project-search-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        closeProjectDropdown();
    }
});

// Sidebar Global Selection Event
async function onGlobalProjectSelect(id, navigate = true) {
    if (!id) return;
    try {
        const res = await fetch(`${API}/projects/${id}`);
        const data = await res.json();
        if (res.ok) {
            currentProject = data;
            // Update dropdown display
            renderProjectDropdown(allProjectsCache);
            // Update the topbar action buttons
            navigateTo(currentPage);

            // If they are on a generic page and select a project, jump to project overview
            if (navigate && (currentPage === 'dashboard' || currentPage === 'projects' || currentPage.startsWith('deploy-'))) {
                navigateTo('project-overview');
            }
        }
    } catch (error) {
        toast('프로젝트 상세 로드 실패', 'error');
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
          <div class="selector-card-footer" style="display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; width:100%;">
              <span>${p.source_type === 'upload' ? '업로드' : p.branch}</span>
              <span>${updatedAt}</span>
            </div>
            ${p.status === 'running' ? `
            <div id="selector-res-${p.id}" style="display:flex; gap:12px; font-size:11px; margin-top:4px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.05);">
              <span style="color:var(--text-muted); font-style:italic;">리소스 통계 수집 중...</span>
            </div>
            ` : ''}
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

            const isPixelStreaming = p.env_vars && p.env_vars.PROJECT_TYPE === 'pixel_streaming';
            let siteUrl = p.custom_domain ? `http://${p.custom_domain}` : (p.tunnel_url || `http://${serverHost}:${p.port}`);
            let urlLabel = p.custom_domain || (p.tunnel_url ? p.tunnel_url.replace('https://', '') : `${serverHost}:${p.port}`);
            let openSiteButtonHtml = '';

            if (p.status === 'running') {
                if (isPixelStreaming) {
                    siteUrl = `/pixel-stream.html?project=${p.subdomain}`;
                    urlLabel = `🎮 Pixel Streaming`;
                    openSiteButtonHtml = `<a href="${siteUrl}" target="_blank" class="btn btn-sm btn-primary" onclick="event.stopPropagation()">🎮 접속</a>`;
                } else {
                    openSiteButtonHtml = `<a href="${siteUrl}" target="_blank" class="btn btn-sm btn-ghost" onclick="event.stopPropagation()">🌐 접속</a>`;
                }
            }

            return `
        <div class="dash-project-row" style="display:flex; flex-direction:column; align-items:stretch; gap:12px; padding:16px;" onclick="openProject(${p.id})">
          <div style="display:flex; align-items:center;">
            <div class="selector-status-dot" style="background:${statusColors[p.status] || '#484f58'};${p.status === 'running' ? `box-shadow:0 0 6px ${statusColors.running};` : ''}"></div>
            <div style="flex:1;min-width:0; margin-left:14px;">
              <div style="font-weight:600;font-size:16px;margin-bottom:2px;">${escapeHtml(p.name)}</div>
              <div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sourceLabel}</div>
            </div>
            <span class="badge badge-${p.status}" style="font-size:11px;">${statusLabel(p.status)}</span>
          </div>
          
          <div style="display:flex; align-items:flex-end; justify-content:space-between; margin-top:4px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
                <div style="color:var(--text-secondary);">포트: <strong style="color:var(--text-primary); font-family:monospace;">${p.port}</strong></div>
                ${p.status === 'running' ? `<div style="color:var(--text-secondary);">URL: <a href="${siteUrl}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent); text-decoration:none;">${urlLabel}</a></div>` : ''}
              </div>
              
              <!-- Realtime Resource KPI Container -->
              ${p.status === 'running' ? `
              <div id="dash-res-${p.id}" style="display:flex; gap:16px; font-size:12px; margin-top:4px;">
                <span style="color:var(--text-muted); font-style:italic;">리소스 통계 수집 중...</span>
              </div>
              ` : ''}
            </div>
            
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); openDeployOptions(${p.id})">🔄 재배포</button>
              ${p.status === 'running' ? `
                <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); stopProject(${p.id})">⏹ 중지</button>
                ${openSiteButtonHtml}
              ` : `
                ${openSiteButtonHtml}
              `}
            </div>
          </div>
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
    if (!p) {
        document.getElementById('overview-content').innerHTML = `
            <div style="text-align:center; padding:100px 20px; color:var(--text-muted);">
                <span class="icon" style="font-size:48px; display:block; margin-bottom:16px;">🔍</span>
                <p>좌측 상단에서 프로젝트를 선택해주세요.</p>
            </div>
        `;
        return;
    }
    const localUrl = `http://${serverHost}:${p.port}`;
    let siteUrl = p.custom_domain ? `http://${p.custom_domain}` : (p.tunnel_url || localUrl);
    let urlLabel = p.custom_domain || (p.tunnel_url ? p.tunnel_url.replace('https://', '') : `${serverHost}:${p.port}`);

    const isPixelStreaming = p.env_vars && p.env_vars.PROJECT_TYPE === 'pixel_streaming';
    if (isPixelStreaming) {
        siteUrl = `/pixel-stream.html?project=${p.subdomain}`;
        urlLabel = `🎮 Pixel Streaming`;
    }

    const isDatabase = p.type === 'db_postgres' || p.type === 'db_redis';
    const isWorker = p.type === 'worker';

    let dbConnectionString = '';
    if (isDatabase) {
        if (p.type === 'db_postgres') {
            dbConnectionString = `postgresql://${p.env_vars?.POSTGRES_USER || 'orbitron_user'}:${p.env_vars?.POSTGRES_PASSWORD || 'orbitron_db_pass'}@orbitron-${p.subdomain}:${p.port || 5432}/${p.env_vars?.POSTGRES_DB || 'orbitron_db'}`;
        } else if (p.type === 'db_redis') {
            dbConnectionString = `redis://orbitron-${p.subdomain}:${p.port || 6379}`;
        }
    }

    document.getElementById('overview-content').innerHTML = `
    ${p.status === 'running' ? `
    <div style="background:linear-gradient(135deg,rgba(63,185,80,0.15),rgba(88,166,255,0.1));border:1px solid var(--success);border-radius:var(--radius-lg);padding:24px;margin-bottom:24px;text-align:center;">
      ${isDatabase ? `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;font-weight:600;">🔒 구동 중인 내부 네트워크 전용 접속 문자열 (orbitron_internal)</div>
      <div style="background:rgba(0,0,0,0.3); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); font-family:monospace; color:var(--success); font-size:16px; word-break:break-all; user-select:all; margin-top:12px;">
        ${dbConnectionString}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:12px;">같은 Orbitron 환경에 배포된 다른 서비스에서만 위 주소로 연결할 수 있습니다.</div>
      <div style="margin-top:16px; display:flex; justify-content:center; gap:8px;">
        <button class="btn btn-outline" onclick="openDeployOptions(${p.id})" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff;">🔄 컨테이너 재시작</button>
      </div>
      ` : isWorker ? `
      <div style="font-size:13px;color:var(--success);margin-bottom:8px;font-weight:600;">⚙️ 백그라운드 워커 실행 중</div>
      <div style="font-size:16px;color:var(--text-primary);font-weight:600;">${p.name} 워커가 백그라운드에서 가동 중입니다.</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">이 컨테이너는 외부로 개방된 포트가 없으며 논스톱 프로세스만 처리합니다.</div>
      <div style="margin-top:16px; display:flex; justify-content:center; gap:8px;">
        <button class="btn btn-outline" onclick="openDeployOptions(${p.id})" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff;">🔄 워커 재시작</button>
      </div>
      ` : `
      <div style="font-size:13px;color:var(--success);margin-bottom:8px;font-weight:600;">🟢 사이트 실행 중</div>
      <a href="${siteUrl}" target="_blank" style="color:var(--accent);font-size:22px;font-weight:700;text-decoration:none; word-break: break-all;">${urlLabel}</a>
      ${p.custom_domain ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">터널: ${p.tunnel_url || 'N/A'}</div>` : ''}
      <div style="margin-top:16px; display:flex; justify-content:center; gap:8px;">
        <a class="btn btn-primary" href="${siteUrl}" target="_blank" style="text-decoration:none;">${isPixelStreaming ? '🎮 게임 시작' : '🌐 사이트 열기'}</a>
        <button class="btn btn-outline" onclick="openDeployOptions(${p.id})" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff;">🔄 재배포</button>
      </div>`}
    </div>` : `
    <div style="background:rgba(139,148,158,0.1);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;font-weight:600;">⏹ 중지됨</div>
      <button class="btn btn-success" onclick="openDeployOptions(${p.id})">▶ 배포/시작</button>
    </div>`}
    <div id="resource-monitor"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">상태</div>
        <span class="badge badge-${p.status}" style="font-size:14px;padding:4px 12px;">${statusLabel(p.status)}</span>
      </div>
      ${(isDatabase || isWorker) ? `
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">네트워크 환경</div>
        <span style="color:var(--accent);">🔒 내부망 전용 (orbitron_internal)</span>
      </div>
      ` : `
      <div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">사이트 URL</div>
        <a href="${siteUrl}" target="_blank" style="color:var(--accent);">${urlLabel}</a>
      </div>
      `}
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
        <span>${isWorker ? '-' : p.port}</span>
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
    </div>
    ${p.type === 'db_postgres' || (p.env_vars && p.env_vars.DATABASE_URL) ? `
    <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);">🗄️ 데이터베이스 백업 <span style="font-size:12px;font-weight:400;color:var(--text-muted);">(DATA 드라이브)</span></div>
        <div style="display:flex;gap:8px;">
          <button class="btn-clone-backup" id="btn-db-backup" onclick="dbBackup(${p.id})" title="DATA 드라이브에 DB 덤프 백업">
            <span class="btn-clone-icon">🗄️</span> 백업
          </button>
          <button class="btn-clone-backup" id="btn-db-restore" onclick="dbRestore(${p.id})" title="백업에서 DB 데이터 복원" style="border-color:var(--warning);color:var(--warning);">
            <span class="btn-clone-icon">🔄</span> 복원
          </button>
        </div>
      </div>
      <div id="db-backup-status" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;font-size:13px;color:var(--text-secondary);">
        백업 상태 확인 중...
      </div>
    </div>` : ''}`;
    if (p.status === 'running') loadResourceStats(p.id);
    loadMediaBackupStatus(p.id);
    loadProjectBackupStatus(p.id);
    if (p.type === 'db_postgres' || (p.env_vars && p.env_vars.DATABASE_URL)) loadDbBackupStatus(p.id);
}

function renderSettings() {
    const p = currentProject;
    if (!p) {
        document.getElementById('settings-content').innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
                프로젝트를 먼저 선택하세요.
            </div>
        `;
        return;
    }
    const webhookUrl = `${window.location.origin}/api/webhooks/github`;
    document.getElementById('settings-content').innerHTML = `
    <div class="form-group"><label>프로젝트 이름</label><input type="text" id="set-name" value="${escapeHtml(p.name)}"></div>
    <div class="form-group"><label>GitHub URL</label><input type="text" id="set-github" value="${escapeHtml(p.github_url)}"></div>
    <div class="form-group"><label>Branch</label><input type="text" id="set-branch" value="${p.branch}"></div>
    <div class="form-group"><label>빌드 명령어</label><input type="text" id="set-build" value="${escapeHtml(p.build_command || '')}"></div>
    <div class="form-group"><label>시작 명령어</label><input type="text" id="set-start" value="${escapeHtml(p.start_command || '')}"></div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
      <label style="font-size:15px;font-weight:600;">🌐 커스텀 도메인</label>
      <div id="domain-status-area" style="margin-bottom:12px;"></div>
      ${p.custom_domain ? `
      <div style="background:rgba(63,185,80,0.1);border:1px solid rgba(63,185,80,0.3);border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:600;color:var(--success);margin-bottom:4px;">🟢 연결됨</div>
            <a href="https://${escapeHtml(p.custom_domain)}" target="_blank" style="color:var(--accent);font-size:16px;font-weight:600;text-decoration:none;">${escapeHtml(p.custom_domain)}</a>
          </div>
          <button class="btn btn-sm" style="background:rgba(248,81,73,0.1);color:var(--danger);border:1px solid rgba(248,81,73,0.3);" onclick="disconnectDomain(${p.id})">🔌 연결 해제</button>
        </div>
      </div>
      ` : `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">도메인 등록기관(가비아, Namecheap 등)에서 CNAME 레코드를 <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">${p.subdomain}.twinverse.org</code>로 설정한 후 연결하세요.</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <input type="text" id="set-custom-domain" value="" placeholder="예: www.myapp.com" style="flex:1;">
          <button class="btn btn-sm btn-ghost" onclick="verifyDomain(${p.id})" id="btn-verify-domain">🔍 DNS 검증</button>
          <button class="btn btn-sm btn-primary" onclick="connectDomain(${p.id})" id="btn-connect-domain" disabled>🔗 연결</button>
        </div>
        <div id="domain-verify-result" style="display:none;font-size:13px;padding:10px 12px;border-radius:6px;margin-bottom:12px;"></div>
        <details style="cursor:pointer;">
          <summary style="font-size:13px;color:var(--accent);font-weight:600;">📖 도메인 DNS 설정 가이드</summary>
          <div style="margin-top:12px;font-size:13px;color:var(--text-muted);">
            <div style="margin-bottom:12px;">
              <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">가비아(Gabia)</div>
              <ol style="padding-left:20px;line-height:1.8;">
                <li>관리 콘솔 → 도메인 관리 → DNS 설정</li>
                <li>레코드 추가: 타입 <code>CNAME</code>, 호스트 <code>www</code>, 값 <code>${p.subdomain}.twinverse.org</code></li>
                <li>저장 후 여기서 "DNS 검증" 클릭</li>
              </ol>
            </div>
            <div style="margin-bottom:12px;">
              <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">Namecheap</div>
              <ol style="padding-left:20px;line-height:1.8;">
                <li>Dashboard → Domain List → Manage → Advanced DNS</li>
                <li>Add Record: Type <code>CNAME</code>, Host <code>www</code>, Value <code>${p.subdomain}.twinverse.org</code></li>
                <li>저장 후 여기서 "DNS 검증" 클릭</li>
              </ol>
            </div>
            <div>
              <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">Cloudflare</div>
              <ol style="padding-left:20px;line-height:1.8;">
                <li>Dashboard → DNS → Records → Add Record</li>
                <li>Type <code>CNAME</code>, Name <code>www</code>, Target <code>${p.subdomain}.twinverse.org</code>, Proxy Off</li>
                <li>저장 후 여기서 "DNS 검증" 클릭</li>
              </ol>
            </div>
          </div>
        </details>
      </div>
      `}
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
      <label style="font-size:15px;font-weight:600;">📣 알림 Webhook URL</label>
      <input type="text" id="set-webhook-url" value="${escapeHtml(p.webhook_url || '')}" placeholder="https://discord.com/api/webhooks/...">
      <div class="form-hint">배포 결과 및 AI 자동 복구 알림을 받을 Discord 또는 Slack 웹훅 URL을 입력하세요.</div>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
      <label style="font-size:15px;font-weight:600;">🔄 배포 모드</label>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
        <label class="toggle-switch"><input type="checkbox" id="set-autodeploy" ${p.auto_deploy !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
        <span style="font-size:14px;color:var(--text-secondary);">${p.auto_deploy !== false ? '자동 배포 활성' : '수동 배포'}</span>
      </div>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px;">
      <label style="font-size:15px;font-weight:600;">🤖 AI 에러 분석 모델 설정</label>
      <div class="form-hint" style="margin-bottom:8px;">배포 실패 시 에러 로그를 분석할 AI 모델을 선택하세요.</div>
      <select id="set-ai-model" style="width:100%; padding:10px; border-radius:6px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); font-family:var(--font-family); margin-bottom: 12px;" onchange="toggleAiKeyFields()">
          <option value="claude-4-6-opus-20260205" ${p.ai_model === 'claude-4-6-opus-20260205' ? 'selected' : ''}>👑 Claude 4.6 Opus (가장 강력함)</option>
          <option value="claude-4-6-sonnet-20260217" ${p.ai_model === 'claude-4-6-sonnet-20260217' ? 'selected' : ''}>⚡ Claude 4.6 Sonnet (빠르고 똑똑함)</option>
          <option value="claude-3-5-sonnet-20241022" ${p.ai_model === 'claude-3-5-sonnet-20241022' ? 'selected' : ''}>🧠 Claude 3.5 Sonnet</option>
          <option value="gemini-3.1-pro" ${p.ai_model === 'gemini-3.1-pro' ? 'selected' : ''}>🔭 Gemini 3.1 Pro (강력한 추론)</option>
          <option value="gemini-3.0-flash" ${p.ai_model === 'gemini-3.0-flash' ? 'selected' : ''}>🚀 Gemini 3.0 Flash (초고속)</option>
          <option value="gemini-2.5-pro" ${p.ai_model === 'gemini-2.5-pro' ? 'selected' : ''}>📚 Gemini 2.5 Pro</option>
          <option value="gemini-2.5-flash" ${p.ai_model === 'gemini-2.5-flash' ? 'selected' : ''}>✨ Gemini 2.5 Flash</option>
      </select>

      <div id="ai-key-anthropic" style="display: ${(!p.ai_model || p.ai_model.startsWith('claude')) ? 'block' : 'none'};">
         <label style="font-size:13px;font-weight:600;color:var(--text-secondary);">🔑 Anthropic API Key <span style="font-weight:normal;font-size:11px;">(해당 프로젝트 전용)</span></label>
         <div style="display:flex; gap:8px; margin-top:4px;">
            <input type="password" id="set-anthropic-key" placeholder="${(p.env_vars && p.env_vars.ANTHROPIC_API_KEY) ? '✅ 설정됨 (변경하려면 새 키 입력)' : 'sk-ant-...'}" style="flex:1;">
            <a href="https://console.anthropic.com/settings/keys" target="_blank" class="btn btn-outline" style="white-space:nowrap; text-decoration:none; display:flex; align-items:center;">발급받기 🔗</a>
         </div>
      </div>
      
      <div id="ai-key-gemini" style="display: ${p.ai_model?.startsWith('gemini') ? 'block' : 'none'};">
         <label style="font-size:13px;font-weight:600;color:var(--text-secondary);">🔑 Gemini API Key <span style="font-weight:normal;font-size:11px;">(해당 프로젝트 전용)</span></label>
         <div style="display:flex; gap:8px; margin-top:4px;">
            <input type="password" id="set-gemini-key" placeholder="${(p.env_vars && p.env_vars.GEMINI_API_KEY) ? '✅ 설정됨 (변경하려면 새 키 입력)' : 'AIzaSy...'}" style="flex:1;">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" class="btn btn-outline" style="white-space:nowrap; text-decoration:none; display:flex; align-items:center;">발급받기 🔗</a>
         </div>
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
      <button class="btn btn-danger" onclick="openDeleteModal(${p.id}, '${escapeHtml(p.name)}')">🗑 프로젝트 삭제</button>
    </div>`;
}

window.toggleAiKeyFields = function () {
    const model = document.getElementById('set-ai-model').value;
    const anthropicDiv = document.getElementById('ai-key-anthropic');
    const geminiDiv = document.getElementById('ai-key-gemini');
    if (anthropicDiv) anthropicDiv.style.display = model.startsWith('claude') ? 'block' : 'none';
    if (geminiDiv) geminiDiv.style.display = model.startsWith('gemini') ? 'block' : 'none';
};

let currentSourceTab = 'github';
let selectedUploadFile = null;

function switchSourceTab(tab) {
    currentSourceTab = tab;
    document.getElementById('tab-github').classList.toggle('active', tab === 'github');
    document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
    const tabDb = document.getElementById('tab-database');
    if (tabDb) tabDb.classList.toggle('active', tab === 'database');
    const tabWorker = document.getElementById('tab-worker');
    if (tabWorker) tabWorker.classList.toggle('active', tab === 'worker');

    document.getElementById('form-github-source').style.display = tab === 'github' ? 'block' : 'none';
    document.getElementById('form-upload-source').style.display = tab === 'upload' ? 'block' : 'none';
    const formDb = document.getElementById('form-database-source');
    if (formDb) formDb.style.display = tab === 'database' ? 'block' : 'none';
    const formWorker = document.getElementById('form-worker-source');
    if (formWorker) formWorker.style.display = tab === 'worker' ? 'block' : 'none';

    const createBtn = document.getElementById('btn-create-project');
    if (createBtn) {
        if (tab === 'upload') createBtn.textContent = '업로드 & 배포';
        else if (tab === 'database') createBtn.textContent = '데이터베이스 생성';
        else if (tab === 'worker') createBtn.textContent = '워커 생성';
        else createBtn.textContent = '프로젝트 생성';
    }
}

function handleFileSelect(input, dropzoneId) {
    const file = input.files[0];
    if (file) {
        selectedUploadFile = file;
        const content = document.getElementById(`${dropzoneId}-content`);
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        let icon = '✅';
        if (dropzoneId === 'unreal-dropzone') icon = '🎮';
        if (dropzoneId === 'unity-dropzone') icon = '🎲';
        content.innerHTML = `
            <div class="upload-icon">${icon}</div>
            <div class="upload-text">${escapeHtml(file.name)}</div>
            <div class="upload-hint">${sizeMB} MB · 클릭하여 다른 파일 선택</div>
        `;
        document.getElementById(dropzoneId).classList.add('has-file');
    }
}

async function createProject() {
    if (isViewerUser()) return viewerBlock();
    if (currentSourceTab === 'upload') {
        return createUploadProject('upload');
    }

    if (currentSourceTab === 'database') {
        const name = document.getElementById('db-name').value.trim();
        const type = document.getElementById('db-type').value;
        if (!name) { toast('데이터베이스 이름은 필수입니다.', 'error'); return; }

        try {
            const res = await fetch(`${API}/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type })
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            const project = await res.json();
            toast('데이터베이스 컨테이너가 생성 및 시작 중입니다.', 'success');
            closeModal();
            loadProjects();
            deployProject(project.id);
        } catch (error) { toast(error.message, 'error'); }
        return;
    }

    if (currentSourceTab === 'worker') {
        const name = document.getElementById('worker-name').value.trim();
        const github_url = document.getElementById('worker-github').value.trim();
        const branch = document.getElementById('worker-branch').value.trim() || 'main';
        const build_command = document.getElementById('worker-build').value.trim();
        const start_command = document.getElementById('worker-start').value.trim();
        if (!name || !github_url) { toast('워커 이름과 GitHub URL은 필수입니다.', 'error'); return; }
        const auto_deploy = document.getElementById('worker-autodeploy')?.checked ?? true;

        try {
            const res = await fetch(`${API}/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, github_url, branch, build_command, start_command, auto_deploy, type: 'worker' })
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            toast('백그라운드 워커가 생성되었습니다!', 'success');
            closeModal();
            loadProjects();
        } catch (error) { toast(error.message, 'error'); }
        return;
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

async function createUploadProject(projectType = 'upload') {
    let nameInputId = 'upload-name';
    if (projectType === 'pixel_streaming') nameInputId = 'unreal-name';
    if (projectType === 'unity_webgl') nameInputId = 'unity-name';

    const name = document.getElementById(nameInputId).value.trim();
    if (!name) { toast('프로젝트 이름은 필수입니다.', 'error'); return; }
    if (!selectedUploadFile) { toast('ZIP 파일을 선택해주세요.', 'error'); return; }

    const formData = new FormData();
    formData.append('zipfile', selectedUploadFile);
    formData.append('name', name);
    formData.append('project_type', projectType);

    if (projectType === 'pixel_streaming') {
        // Pixel streaming defaults
        formData.append('build_command', 'echo PixelStreaming');
        formData.append('start_command', 'echo Matchmaker');
        formData.append('subdomain', name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
    } else if (projectType === 'unity_webgl') {
        // Unity WebGL defaults (Static Nginx)
        formData.append('build_command', 'echo UnityWebGL');
        formData.append('start_command', 'echo Nginx');
        formData.append('port', '80');
        formData.append('subdomain', name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
    } else {
        formData.append('build_command', document.getElementById('upload-build').value.trim());
        formData.append('start_command', document.getElementById('upload-start').value.trim());
        formData.append('port', document.getElementById('upload-port').value || '');
        formData.append('subdomain', document.getElementById('upload-subdomain').value.trim());
    }

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
        toast('프로젝트가 업로드되었습니다! 빌드를 시작합니다.', 'success');

        // Reset the form values
        document.getElementById(nameInputId).value = '';
        selectedUploadFile = null;
        const dropzoneId = projectType === 'pixel_streaming' ? 'unreal-dropzone' : (projectType === 'unity_webgl' ? 'unity-dropzone' : 'upload-dropzone');
        const content = document.getElementById(`${dropzoneId}-content`);
        const icon = projectType === 'pixel_streaming' ? '🎮' : (projectType === 'unity_webgl' ? '🎲' : '📦');
        content.innerHTML = `
            <div class="upload-icon">${icon}</div>
            <div class="upload-text">파일을 드래그하거나 클릭하여 선택</div>
            <div class="upload-hint">업로드할 ZIP 파일을 선택해주세요.</div>
        `;
        document.getElementById(dropzoneId).classList.remove('has-file');

        closeModal();
        openDeployModal(project.id);

        // Switch to the new project overview page
        await loadProjects();
        renderProjectDropdown(allProjectsCache);
        await onGlobalProjectSelect(project.id);

    } catch (error) {
        toast(error.message, 'error');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = projectType === 'pixel_streaming' ? '게임 서버 빌드' : (projectType === 'unity_webgl' ? '웹 서버 배포' : '업로드 & 배포');
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
    if (isViewerUser()) return viewerBlock();
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

// ============ SAFE DELETE ============

let deleteTargetId = null;
let deleteTargetName = '';

function openDeleteModal(id, name) {
    deleteTargetId = id;
    deleteTargetName = name;
    const modal = document.getElementById('delete-confirm-modal');
    modal.classList.add('active');
    document.getElementById('delete-project-name-display').textContent = name;
    document.getElementById('delete-confirm-input').value = '';
    document.getElementById('btn-confirm-delete').disabled = true;
    document.getElementById('delete-input-hint').textContent = '프로젝트 이름이 일치하지 않습니다.';
    document.getElementById('delete-input-hint').classList.remove('matched');
    document.getElementById('delete-confirm-input').classList.remove('matched');
    setTimeout(() => document.getElementById('delete-confirm-input').focus(), 100);
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal').classList.remove('active');
    deleteTargetId = null;
    deleteTargetName = '';
}

function validateDeleteInput() {
    const input = document.getElementById('delete-confirm-input');
    const btn = document.getElementById('btn-confirm-delete');
    const hint = document.getElementById('delete-input-hint');
    const val = input.value.trim();

    if (val === deleteTargetName) {
        btn.disabled = false;
        hint.textContent = '✅ 이름이 일치합니다. 삭제를 진행할 수 있습니다.';
        hint.classList.add('matched');
        input.classList.add('matched');
    } else {
        btn.disabled = true;
        hint.textContent = val.length > 0 ? '⚠️ 프로젝트 이름이 일치하지 않습니다.' : '프로젝트 이름이 일치하지 않습니다.';
        hint.classList.remove('matched');
        input.classList.remove('matched');
    }
}

async function confirmDeleteProject() {
    if (!deleteTargetId || !deleteTargetName) return;
    const btn = document.getElementById('btn-confirm-delete');
    btn.disabled = true;
    btn.textContent = '삭제 중...';

    try {
        const res = await fetch(`${API}/projects/${deleteTargetId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm_name: deleteTargetName })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '삭제 실패');

        closeDeleteModal();
        toast('프로젝트가 영구적으로 삭제되었습니다.', 'success');
        currentProject = null;
        navigateTo('projects');
        loadProjects();
    } catch (error) {
        toast('삭제 실패: ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = '🗑️ 영구 삭제';
    }
}

// Legacy wrapper for backward compatibility
async function deleteProject(id) {
    if (isViewerUser()) return viewerBlock();
    const name = currentProject?.name || '';
    openDeleteModal(id, name);
}

// ============ ENV VARS ============

function renderEnvVars() {
    if (!currentProject) {
        document.getElementById('env-content').innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
                프로젝트를 먼저 선택하세요.
            </div>
        `;
        return;
    }
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
        const ai_model = document.getElementById('set-ai-model')?.value || 'claude-4-6-sonnet-20260217';

        const anthropicKey = document.getElementById('set-anthropic-key')?.value?.trim();
        const geminiKey = document.getElementById('set-gemini-key')?.value?.trim();

        let targetEnvVars = currentProject.env_vars || {};
        let envVarsChanged = false;
        if (anthropicKey) { targetEnvVars.ANTHROPIC_API_KEY = anthropicKey; envVarsChanged = true; }
        if (geminiKey) { targetEnvVars.GEMINI_API_KEY = geminiKey; envVarsChanged = true; }

        const webhook_url = document.getElementById('set-webhook-url')?.value?.trim() || null;

        const payload = {
            name: document.getElementById('set-name').value,
            github_url: document.getElementById('set-github').value,
            branch: document.getElementById('set-branch').value,
            build_command: document.getElementById('set-build').value,
            start_command: document.getElementById('set-start').value,
            auto_deploy,
            ai_model,
            webhook_url
        };
        if (envVarsChanged) {
            payload.env_vars = targetEnvVars;
        }

        await fetch(`${API}/projects/${currentProject.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        currentProject.auto_deploy = auto_deploy;
        currentProject.ai_model = ai_model;
        currentProject.name = document.getElementById('set-name').value;
        toast('설정이 저장되었습니다!', 'success');
        loadProjects();
    } catch (error) { toast('저장 실패', 'error'); }
}

// ============ DOMAIN MANAGEMENT ============

async function verifyDomain(projectId) {
    const domainInput = document.getElementById('set-custom-domain');
    const domain = domainInput?.value?.trim();
    if (!domain) { toast('도메인을 입력해주세요.', 'error'); return; }

    const btn = document.getElementById('btn-verify-domain');
    const resultDiv = document.getElementById('domain-verify-result');
    btn.disabled = true;
    btn.textContent = '검증 중...';
    resultDiv.style.display = 'none';

    try {
        const res = await fetch(`${API}/projects/${projectId}/domain/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        const data = await res.json();

        resultDiv.style.display = 'block';
        if (data.verified) {
            resultDiv.style.background = 'rgba(63,185,80,0.1)';
            resultDiv.style.border = '1px solid rgba(63,185,80,0.3)';
            resultDiv.style.color = 'var(--success)';
            resultDiv.innerHTML = `${data.message}<br><span style="font-size:12px;color:var(--text-muted);margin-top:4px;display:inline-block;">이제 "연결" 버튼을 클릭하여 도메인을 연결하세요.</span>`;
            document.getElementById('btn-connect-domain').disabled = false;
        } else {
            resultDiv.style.background = 'rgba(210,153,34,0.1)';
            resultDiv.style.border = '1px solid rgba(210,153,34,0.3)';
            resultDiv.style.color = 'var(--warning)';
            resultDiv.textContent = data.message || data.error;
            document.getElementById('btn-connect-domain').disabled = true;
        }
    } catch (e) {
        toast('DNS 검증 실패: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 DNS 검증';
    }
}

async function connectDomain(projectId) {
    const domainInput = document.getElementById('set-custom-domain');
    const domain = domainInput?.value?.trim();
    if (!domain) return;

    const btn = document.getElementById('btn-connect-domain');
    btn.disabled = true;
    btn.textContent = '연결 중...';

    try {
        const res = await fetch(`${API}/projects/${projectId}/domain/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            toast(`✅ ${domain} 도메인이 연결되었습니다!`, 'success');
            currentProject.custom_domain = domain;
            renderSettings();
            loadProjects();
        } else {
            toast(data.error || '도메인 연결 실패', 'error');
        }
    } catch (e) {
        toast('도메인 연결 실패: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔗 연결';
    }
}

async function disconnectDomain(projectId) {
    if (!confirm('도메인 연결을 해제하시겠습니까? 기존 서브도메인(.twinverse.org)으로 되돌아갑니다.')) return;

    try {
        const res = await fetch(`${API}/projects/${projectId}/domain`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (res.ok && data.success) {
            toast('도메인 연결이 해제되었습니다.', 'success');
            currentProject.custom_domain = null;
            renderSettings();
            loadProjects();
        } else {
            toast(data.error || '도메인 해제 실패', 'error');
        }
    } catch (e) {
        toast('도메인 해제 실패: ' + e.message, 'error');
    }
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
    if (!currentProject) {
        document.getElementById('log-content').textContent = '프로젝트를 먼저 선택하세요.';
        return;
    }
    try {
        const res = await fetch(`${API}/deployments/${currentProject.id}/logs`);
        const data = await res.json();
        const logEl = document.getElementById('log-content');

        if (!data.logs) { logEl.textContent = '로그가 없습니다.'; return; }

        // Check for AI Auto-Repair data
        const repairMarker = '🤖 [AI_AUTO_REPAIR_DATA]';
        const markerIdx = data.logs.indexOf(repairMarker);

        if (markerIdx !== -1) {
            const logPart = data.logs.substring(0, markerIdx);
            const jsonPart = data.logs.substring(markerIdx + repairMarker.length).trim();

            // Format log text with AI highlights
            logEl.innerHTML = formatDeployLogWithAI(logPart);

            // Parse auto-repair data
            try {
                const repairData = JSON.parse(jsonPart);
                const repairCard = document.createElement('div');
                repairCard.className = 'ai-repair-card';
                repairCard.innerHTML = `
                    <div class="ai-repair-header">
                        <span>🤖 AI 자동 복구 성공</span>
                        ${repairData.prUrl ? `<a href="${escapeHtml(repairData.prUrl)}" target="_blank" class="btn btn-sm btn-ghost" style="font-size:12px;">📤 GitHub PR 보기</a>` : ''}
                    </div>
                    <div class="ai-repair-summary">📋 ${escapeHtml(repairData.summary || '')}</div>
                    ${repairData.patches ? '<div class="ai-repair-patches">' +
                        repairData.patches.map(p => `<div class="ai-repair-patch">📝 <code>${escapeHtml(p.file)}</code> — ${escapeHtml(p.explanation)}</div>`).join('') +
                        '</div>' : ''}
                    ${repairData.branch ? `<div style="margin-top:6px; font-size:12px; color:var(--text-muted);">🌿 브랜치: ${escapeHtml(repairData.branch)}</div>` : ''}
                `;
                logEl.appendChild(repairCard);
            } catch (e) {
                logEl.textContent += '\n' + jsonPart;
            }
        } else {
            logEl.innerHTML = formatDeployLogWithAI(data.logs);
        }
    } catch (error) {
        document.getElementById('log-content').textContent = '로그를 불러올 수 없습니다.';
    }
}

function formatDeployLogWithAI(logText) {
    return escapeHtml(logText)
        .replace(/🤖.*$/gm, '<span style="color:#bd93f9;font-weight:600;">$&</span>')
        .replace(/✅.*$/gm, '<span style="color:var(--success);">$&</span>')
        .replace(/❌.*$/gm, '<span style="color:var(--danger);">$&</span>')
        .replace(/⚠️.*$/gm, '<span style="color:#f59e0b;">$&</span>')
        .replace(/\[AI Auto-Repair\].*$/gm, '<span style="color:#bd93f9;">$&</span>')
        .replace(/\[AI Error Analysis\]/g, '<span style="color:#bd93f9;font-weight:700;">[AI Error Analysis]</span>');
}

async function loadDeployments() {
    if (!currentProject) {
        document.getElementById('deployments-content').innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
                프로젝트를 먼저 선택하세요.
            </div>
        `;
        return;
    }
    try {
        const res = await fetch(`${API}/deployments/${currentProject.id}`);
        const deployments = await res.json();
        if (deployments.length === 0) {
            document.getElementById('deployments-content').innerHTML = '<p style="color:var(--text-secondary);">배포 이력이 없습니다.</p>';
            return;
        }
        document.getElementById('deployments-content').innerHTML = deployments.map(d => {
            const duration = d.finished_at && d.started_at ? formatDuration(new Date(d.finished_at) - new Date(d.started_at)) : '---';
            const logSize = d.log_size ? `(${(d.log_size / 1024).toFixed(1)}KB)` : '';
            return `
      <div class="deploy-item">
        <span class="deploy-status ${d.status}">${statusLabel(d.status)}</span>
        <div class="deploy-info">
          <div class="deploy-commit">${d.commit_hash ? d.commit_hash.substring(0, 7) : '---'} ${escapeHtml(d.commit_message || '')}</div>
          <div class="deploy-time">${timeAgo(d.started_at)} · ⏱ ${duration}</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="viewDeployLog(${currentProject.id}, ${d.id})" title="배포 로그 보기">📋 로그 ${logSize}</button>
        ${d.status === 'success' && d.commit_hash ? `<button class="btn btn-sm btn-ghost btn-rollback" onclick="rollbackTo(${d.id})">↩ 롤백</button>` : ''}
      </div>`;
        }).join('');
    } catch (error) {
        document.getElementById('deployments-content').innerHTML = '<p style="color:var(--danger);">로드 실패</p>';
    }
}

async function viewDeployLog(projectId, deploymentId) {
    const modal = document.getElementById('deploy-modal');
    modal.classList.add('active');
    document.getElementById('deploy-modal-title').textContent = `📋 배포 로그 #${deploymentId}`;
    document.getElementById('deploy-progress-fill').style.width = '100%';
    document.getElementById('deploy-progress-fill').className = 'deploy-progress-fill';
    document.getElementById('deploy-progress-label').textContent = '로그를 불러오는 중...';
    document.getElementById('deploy-steps').innerHTML = '';
    const logViewer = document.getElementById('deploy-log-viewer');
    logViewer.textContent = '로딩 중...';
    logViewer.classList.remove('collapsed');

    try {
        const res = await fetch(`${API}/deployments/${projectId}/log/${deploymentId}`, {
            headers: { Authorization: `Bearer ${getToken()}` }
        });
        const data = await res.json();

        if (data.error) {
            logViewer.textContent = `❌ ${data.error}`;
            return;
        }

        const statusIcon = data.status === 'success' ? '✅' : data.status === 'failed' ? '❌' : '🔄';
        const started = data.started_at ? new Date(data.started_at).toLocaleString('ko-KR') : '---';
        const finished = data.finished_at ? new Date(data.finished_at).toLocaleString('ko-KR') : '진행 중';
        const duration = data.started_at && data.finished_at
            ? formatDuration(new Date(data.finished_at) - new Date(data.started_at))
            : '---';

        document.getElementById('deploy-modal-title').textContent = `${statusIcon} 배포 로그 #${deploymentId}`;
        document.getElementById('deploy-progress-label').textContent =
            `${started} → ${finished} (소요: ${duration})`;

        if (data.status === 'success') {
            document.getElementById('deploy-progress-fill').classList.add('done');
        } else if (data.status === 'failed') {
            document.getElementById('deploy-progress-fill').style.background = 'var(--danger)';
            document.getElementById('deploy-progress-fill').classList.add('done');
        }

        logViewer.textContent = data.logs || '(로그 없음)';
        logViewer.scrollTop = 0;
    } catch (err) {
        logViewer.textContent = `❌ 로그 조회 실패: ${err.message}`;
    }
}

// ============ DEPLOY MONITOR ============

let activeEventSource = null;

function openDeployModal(projectId) {
    if (window.deployModalCloseTimeout) { clearTimeout(window.deployModalCloseTimeout); window.deployModalCloseTimeout = null; }
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
    let completedSteps = [];

    // Extract message handler as a standalone function so it can be reused across SSE retries
    const handleMessage = (event) => {
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
                if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
                loadProjects();
                if (currentProject?.id === projectId) openProject(projectId);
                
                // 배포 완료 후 5초 뒤 자동 닫기 (이전 타이머 취소)
                if (window.deployModalCloseTimeout) clearTimeout(window.deployModalCloseTimeout);
                window.deployModalCloseTimeout = setTimeout(() => {
                    if (document.getElementById('deploy-modal').classList.contains('active')) {
                        closeDeployModal();
                    }
                }, 5000);
            } else if (data.status === 'failed') {
                currentEl.className = 'deploy-step failed';
                currentEl.querySelector('.deploy-step-icon').textContent = '✕';
                document.getElementById('deploy-progress-fill').style.background = 'var(--danger)';
                document.getElementById('deploy-progress-fill').classList.add('done');
                document.getElementById('deploy-modal-title').textContent = '❌ 배포 실패';
                if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
                loadProjects();
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
        logViewer.scrollTop = logViewer.scrollHeight;
    };

    // Polling fallback: check project status via API
    const startPollingFallback = () => {
        if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
        document.getElementById('deploy-progress-label').textContent = '빌드 진행 중... (상태 확인 중)';

        const checkStatus = async () => {
            try {
                const res = await fetch(`${API}/projects`);
                const projects = await res.json();
                const p = projects.find(x => x.id === projectId);
                if (!p) return true; // stop polling
                if (p.status === 'running') {
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
                    
                    // 배포 완료 후 5초 뒤 자동 닫기
                    if (window.deployModalCloseTimeout) clearTimeout(window.deployModalCloseTimeout);
                    window.deployModalCloseTimeout = setTimeout(() => {
                        if (document.getElementById('deploy-modal').classList.contains('active')) {
                            closeDeployModal();
                        }
                    }, 5000);
                    return true; // stop polling
                } else if (p.status === 'failed') {
                    document.getElementById('deploy-progress-fill').style.background = 'var(--danger)';
                    document.getElementById('deploy-progress-fill').classList.add('done');
                    document.getElementById('deploy-modal-title').textContent = '❌ 배포 실패';
                    document.getElementById('deploy-progress-label').textContent = '배포에 실패했습니다.';
                    loadProjects();
                    return true; // stop polling
                }
            } catch (e) { /* keep polling */ }
            return false;
        };

        // Immediately check once first (deploy may already be done)
        checkStatus().then(done => {
            if (!done) {
                const poll = setInterval(async () => {
                    const finished = await checkStatus();
                    if (finished) clearInterval(poll);
                }, 3000);
            }
        });
    };

    // Create SSE connection with proper error handling
    let sseRetryCount = 0;
    const createSSE = () => {
        const es = new EventSource(`${API}/deploy-stream/${projectId}?token=${getToken() || ''}`);
        activeEventSource = es;
        es.onmessage = handleMessage;
        es.onerror = () => {
            sseRetryCount++;
            if (sseRetryCount <= 2) {
                // Retry SSE
                setTimeout(() => {
                    if (activeEventSource === es) {
                        es.close();
                        createSSE();
                    }
                }, 2000);
            } else {
                // SSE failed multiple times — fallback to polling
                startPollingFallback();
            }
        };
    };

    createSSE();
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
        const uptime = formatUptime((stats.uptime || 0) / 1000);
        monitor.innerHTML = `
        <div class="resource-grid">
          <div class="resource-card"><div class="resource-label">💻 CPU</div><div class="resource-value" style="color:var(--accent)">${cpuVal.toFixed(1)}%</div><div class="resource-bar"><div class="resource-bar-fill cpu" style="width:${Math.min(cpuVal, 100)}%"></div></div></div>
          <div class="resource-card"><div class="resource-label">🧠 메모리</div><div class="resource-value" style="color:var(--purple)">${stats.memUsage}</div><div class="resource-bar"><div class="resource-bar-fill mem" style="width:${Math.min(memVal, 100)}%"></div></div></div>
          <div class="resource-card"><div class="resource-label">⏱ Uptime</div><div class="resource-value">${uptime}</div></div>
          <div class="resource-card"><div class="resource-label">🌐 Network I/O</div><div class="resource-value" style="font-size:14px">${stats.netIO}</div></div>
        </div>`;
    } catch (e) { /* ignore */ }
}

async function loadDashboardResourceStats() {
    // Collect all elements with ID starting with selector-res-
    const containers = document.querySelectorAll('[id^="selector-res-"]');
    for (let el of containers) {
        const projectId = el.id.replace('selector-res-', '');
        try {
            const res = await fetch(`${API}/projects/${projectId}/stats`);
            if (res.ok) {
                const stats = await res.json();
                const cpuVal = parseFloat(stats.cpu) || 0;
                const uptime = formatUptime((stats.uptime || 0) / 1000);
                el.innerHTML = `
                    <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">💻 <span style="color:var(--accent); font-weight:600;">${cpuVal.toFixed(1)}%</span></div>
                    <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">🧠 <span style="color:var(--purple); font-weight:600;">${stats.memUsage}</span></div>
                    <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">⏱ <span style="color:var(--text-primary);">${uptime}</span></div>
                    <div style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">🌐 <span style="color:var(--text-primary);">${stats.netIO}</span></div>
                `;
            }
        } catch (e) { /* silently fail for background pollers */ }
    }
}

// ============ WEB IDE (MONACO EDITOR) ============
let monacoEditor = null;
let currentSourceFile = null;

function initMonacoEditor() {
    if (monacoEditor) return;
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        monacoEditor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
            value: "// ⬅ 좌측에서 파일을 선택하여 소스 코드를 편집하세요.\n",
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'var(--font-mono)'
        });

        monacoEditor.onDidChangeModelContent(() => {
            if (currentSourceFile) {
                document.getElementById('btn-save-file').disabled = false;
                document.getElementById('editor-status').textContent = '변경사항 있음';
            }
        });

        // Initialize AI editor extensions (context menu, keybindings, selection tracking)
        initMonacoEditorExtensions();
    });
}

function getLanguageFromExtension(ext) {
    const map = {
        '.js': 'javascript', '.jsx': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python',
        '.json': 'json',
        '.html': 'html',
        '.css': 'css',
        '.md': 'markdown',
        '.yml': 'yaml', '.yaml': 'yaml',
        '.sql': 'sql',
        '.sh': 'shell'
    };
    return map[ext] || 'plaintext';
}

async function loadProjectFileTree() {
    if (!currentProject) return;
    const container = document.getElementById('editor-file-tree');
    container.innerHTML = '<div style="color:var(--text-muted); padding:10px;">파일 목록을 불러오는 중...</div>';

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/source/tree`);
        if (!res.ok) throw new Error('파일 트리를 불러올 수 없습니다.');
        const data = await res.json();

        if (!data.tree || data.tree.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted); padding:10px;">파일이 없습니다. (배포 후 확인 가능)</div>';
            return;
        }

        container.innerHTML = renderFileTree(data.tree, 0);
    } catch (e) {
        container.innerHTML = `<div style="color:var(--danger); padding:10px;">오류: ${e.message}</div>`;
    }
}

function renderFileTree(nodes, depth) {
    let html = '';
    nodes.forEach(node => {
        const padding = depth * 12 + 4;
        if (node.type === 'dir') {
            html += `<div style="padding:4px ${padding}px; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">📁 ${escapeHtml(node.name)}</div>`;
            html += `<div style="display:none;">${renderFileTree(node.children, depth + 1)}</div>`;
        } else {
            html += `<div class="file-tree-item" style="padding:4px ${padding}px;" onclick="openSourceFile('${node.path}', '${node.name}', '${node.extension}')">📄 ${escapeHtml(node.name)}</div>`;
        }
    });
    return html;
}

async function openSourceFile(filePath, fileName, ext) {
    if (!currentProject || !monacoEditor) return;

    document.getElementById('editor-status').textContent = '파일 불러오는 중...';
    document.getElementById('btn-save-file').disabled = true;

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/source/file?path=${encodeURIComponent(filePath)}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '파일을 읽을 수 없습니다.');
        }
        const data = await res.json();

        currentSourceFile = filePath;
        document.getElementById('editor-current-file').innerHTML = `📝 <strong style="color:var(--accent);">${escapeHtml(filePath)}</strong>`;

        const lang = getLanguageFromExtension(data.extension);
        monaco.editor.setModelLanguage(monacoEditor.getModel(), lang);
        monacoEditor.setValue(data.content);

        document.getElementById('editor-status').textContent = '읽기 전용 상태가 아님 (수정 가능)';
    } catch (e) {
        document.getElementById('editor-status').textContent = `오류: ${e.message}`;
    }
}

async function saveCurrentFile() {
    if (!currentProject || !currentSourceFile || !monacoEditor) return;

    const content = monacoEditor.getValue();
    const btn = document.getElementById('btn-save-file');
    const status = document.getElementById('editor-status');

    btn.disabled = true;
    btn.textContent = '저장 중...';

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/source/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentSourceFile, content })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '저장 실패');
        }

        status.textContent = '✅ 저장되었습니다!';
        toast('파일이 서버에 즉각 저장되었습니다.', 'success');

        setTimeout(() => {
            if (status.textContent.includes('저장되었습니다')) {
                status.textContent = '명령 대기 중';
            }
        }, 3000);
    } catch (e) {
        status.textContent = `❌ ${e.message}`;
        btn.disabled = false;
        toast(`저장 오류: ${e.message}`, 'error');
    } finally {
        if (btn.textContent === '저장 중...') btn.textContent = '저장';
    }
}
// ============ AI CODE EDITOR ENGINE ============
let monacoDiffEditor = null;
let aiPendingChange = null; // { filePath, original, modified, explanation, changes }
let aiMultiPatches = null;  // For multi-file edits

function initMonacoEditorExtensions() {
    if (!monacoEditor || !window.monaco) return;

    // Track selection changes → enable/disable AI buttons
    monacoEditor.onDidChangeCursorSelection((e) => {
        const sel = monacoEditor.getSelection();
        const hasSelection = sel && !sel.isEmpty();
        document.getElementById('btn-ai-explain').disabled = !hasSelection;
        document.getElementById('btn-ai-fix').disabled = !hasSelection;
        document.getElementById('btn-ai-refactor').disabled = !hasSelection;

        if (hasSelection) {
            const model = monacoEditor.getModel();
            const lines = sel.endLineNumber - sel.startLineNumber + 1;
            const chars = model.getValueInRange(sel).length;
            document.getElementById('editor-selection-info').textContent = `선택: ${lines}줄, ${chars}자`;
        } else {
            document.getElementById('editor-selection-info').textContent = '';
        }
    });

    // Ctrl+I → Toggle inline AI prompt
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
        toggleAiPromptInline();
    });

    // Context menu: AI actions
    monacoEditor.addAction({
        id: 'ai-edit-selection',
        label: '🤖 AI로 수정 (Ctrl+I)',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
        contextMenuGroupId: '1_ai',
        contextMenuOrder: 1,
        run: () => toggleAiPromptInline()
    });
    monacoEditor.addAction({
        id: 'ai-explain-selection',
        label: '💡 AI 코드 설명',
        contextMenuGroupId: '1_ai',
        contextMenuOrder: 2,
        precondition: 'editorHasSelection',
        run: () => aiEditorAction('explain')
    });
    monacoEditor.addAction({
        id: 'ai-fix-selection',
        label: '🔧 AI 버그 수정',
        contextMenuGroupId: '1_ai',
        contextMenuOrder: 3,
        precondition: 'editorHasSelection',
        run: () => aiEditorAction('fix')
    });
    monacoEditor.addAction({
        id: 'ai-refactor-selection',
        label: '♻️ AI 리팩토링',
        contextMenuGroupId: '1_ai',
        contextMenuOrder: 4,
        precondition: 'editorHasSelection',
        run: () => aiEditorAction('refactor')
    });
}

function toggleAiPromptInline() {
    const bar = document.getElementById('ai-inline-prompt');
    const isVisible = bar.style.display === 'flex';
    bar.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
        const input = document.getElementById('ai-inline-input');
        input.focus();
        input.select();
    }
}

function openAiPanel() {
    document.getElementById('ai-result-panel').style.width = '360px';
}

function closeAiPanel() {
    document.getElementById('ai-result-panel').style.width = '0';
    document.getElementById('ai-result-actions').style.display = 'none';
    aiPendingChange = null;
    // If diff view is open, switch back
    if (document.getElementById('monaco-diff-container').style.display !== 'none') {
        toggleDiffView();
    }
}

async function aiEditorAction(action) {
    if (!currentProject || !monacoEditor) return;

    const sel = monacoEditor.getSelection();
    let selectedCode = '';
    if (sel && !sel.isEmpty()) {
        selectedCode = monacoEditor.getModel().getValueInRange(sel);
    }

    const instruction = document.getElementById('ai-inline-input')?.value?.trim() || '';
    const fullFileContent = monacoEditor.getValue();

    // Validate
    if ((action === 'explain' || action === 'fix' || action === 'refactor') && !selectedCode) {
        toast('먼저 코드를 선택해주세요.', 'warning');
        return;
    }
    if (action === 'edit' && !instruction) {
        toast('AI에게 지시할 내용을 입력해주세요.', 'warning');
        return;
    }
    if (action === 'multi-edit') {
        const multiInstr = prompt('멀티파일 리팩토링 지시사항을 입력하세요:\n예: "모든 console.log를 logger로 변경해줘"');
        if (!multiInstr) return;
        return aiMultiFileEdit(multiInstr);
    }

    openAiPanel();
    const resultContent = document.getElementById('ai-result-content');
    const actionLabels = { edit: '코드 수정', explain: '코드 설명', fix: '버그 수정', refactor: '리팩토링', generate: '코드 생성' };
    resultContent.innerHTML = `
        <div style="text-align:center; padding:40px;">
            <div style="font-size:28px; margin-bottom:12px; animation: pulse 1.5s infinite;">🤖</div>
            <div style="color:#bd93f9; font-weight:600; margin-bottom:4px;">${actionLabels[action] || 'AI 처리'} 중...</div>
            <div style="color:var(--text-muted); font-size:12px;">AI가 코드를 분석하고 있습니다</div>
        </div>
    `;
    document.getElementById('ai-result-actions').style.display = 'none';

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/source/ai-edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                filePath: currentSourceFile,
                selectedCode: selectedCode || undefined,
                instruction: instruction || undefined,
                fullFileContent: (action !== 'explain' && selectedCode) ? fullFileContent : undefined
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI 호출 실패');

        const result = data.result;

        if (action === 'explain') {
            resultContent.innerHTML = `
                <div style="margin-bottom:12px;">
                    <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                        💡 코드 설명
                    </div>
                    <div style="background:rgba(0,0,0,0.2); border-radius:8px; padding:12px; margin-bottom:12px;">
                        <pre style="white-space:pre-wrap; font-size:12px; color:#8b949e; margin:0; font-family:var(--font-mono);">${escapeHtml(selectedCode)}</pre>
                    </div>
                    <div style="line-height:1.8; color:var(--text-secondary);">
                        ${formatMarkdownLite(result.explanation || result.raw || '')}
                    </div>
                </div>
            `;
        } else if (result.modified !== undefined) {
            // Single edit result
            aiPendingChange = {
                filePath: currentSourceFile,
                original: selectedCode,
                modified: result.modified,
                explanation: result.explanation,
                changes: result.changes || [],
                selection: sel
            };

            resultContent.innerHTML = `
                <div style="margin-bottom:12px;">
                    <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        ${action === 'fix' ? '🔧 수정 제안' : action === 'refactor' ? '♻️ 리팩토링 제안' : '✏️ AI 수정 제안'}
                    </div>
                    <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px; line-height:1.7;">
                        ${escapeHtml(result.explanation || '')}
                    </div>
                    ${result.changes && result.changes.length > 0 ? `
                        <div style="margin-bottom:12px;">
                            <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:6px;">변경 사항:</div>
                            ${result.changes.map(c => `
                                <div style="display:flex; gap:6px; align-items:flex-start; margin-bottom:4px;">
                                    <span style="color:#50fa7b; font-size:11px; margin-top:2px;">●</span>
                                    <span style="font-size:12px; color:var(--text-secondary);">${escapeHtml(c.description)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div style="margin-bottom:8px;">
                        <div style="font-size:12px; font-weight:600; color:#f85149; margin-bottom:4px;">- 원본 (삭제)</div>
                        <pre style="background:rgba(248,81,73,0.08); border:1px solid rgba(248,81,73,0.2); border-radius:6px; padding:10px; font-size:12px; color:#ffa198; overflow-x:auto; white-space:pre-wrap; margin:0; font-family:var(--font-mono);">${escapeHtml(selectedCode)}</pre>
                    </div>
                    <div>
                        <div style="font-size:12px; font-weight:600; color:#50fa7b; margin-bottom:4px;">+ 수정안 (추가)</div>
                        <pre style="background:rgba(63,185,80,0.08); border:1px solid rgba(63,185,80,0.2); border-radius:6px; padding:10px; font-size:12px; color:#7ee787; overflow-x:auto; white-space:pre-wrap; margin:0; font-family:var(--font-mono);">${escapeHtml(result.modified)}</pre>
                    </div>
                </div>
            `;

            document.getElementById('ai-result-actions').style.display = 'block';
            document.getElementById('btn-toggle-diff').style.display = 'inline-flex';

            // Show inline decoration in editor
            showInlineAiDecoration(sel);

        } else if (result.raw) {
            resultContent.innerHTML = `
                <div style="line-height:1.8; color:var(--text-secondary);">
                    ${formatMarkdownLite(result.raw)}
                </div>
            `;
        }

        // Hide inline prompt after action
        document.getElementById('ai-inline-prompt').style.display = 'none';

    } catch (e) {
        resultContent.innerHTML = `
            <div style="text-align:center; padding:40px; color:#f85149;">
                <div style="font-size:24px; margin-bottom:8px;">❌</div>
                <div style="font-weight:600; margin-bottom:4px;">AI 오류</div>
                <div style="font-size:13px; color:var(--text-muted);">${escapeHtml(e.message)}</div>
            </div>
        `;
    }
}

// Show a yellow highlight decoration on the lines that AI wants to change
let aiDecorationIds = [];
function showInlineAiDecoration(selection) {
    if (!monacoEditor || !selection) return;
    clearAiDecorations();

    aiDecorationIds = monacoEditor.deltaDecorations([], [{
        range: new monaco.Range(selection.startLineNumber, 1, selection.endLineNumber, 1),
        options: {
            isWholeLine: true,
            className: 'ai-pending-change-line',
            glyphMarginClassName: 'ai-pending-glyph',
            overviewRuler: { color: '#bd93f9', position: monaco.editor.OverviewRulerLane.Center }
        }
    }]);
}

function clearAiDecorations() {
    if (monacoEditor && aiDecorationIds.length > 0) {
        aiDecorationIds = monacoEditor.deltaDecorations(aiDecorationIds, []);
    }
}

function acceptAiChange() {
    if (!aiPendingChange || !monacoEditor) return;

    const { original, modified, selection } = aiPendingChange;

    if (selection && !selection.isEmpty()) {
        // Replace selected range with modified code
        monacoEditor.executeEdits('ai-edit', [{
            range: selection,
            text: modified
        }]);
    } else {
        // Full file content replacement
        const fullContent = monacoEditor.getValue();
        const newContent = fullContent.replace(original, modified);
        monacoEditor.setValue(newContent);
    }

    clearAiDecorations();
    aiPendingChange = null;
    document.getElementById('ai-result-actions').style.display = 'none';
    document.getElementById('btn-toggle-diff').style.display = 'none';

    // Switch back from diff view if open
    if (document.getElementById('monaco-diff-container').style.display !== 'none') {
        toggleDiffView();
    }

    toast('✅ AI 수정이 적용되었습니다. 저장 버튼을 눌러 서버에 반영하세요.', 'success');
    document.getElementById('btn-save-file').disabled = false;
    document.getElementById('editor-status').textContent = 'AI 수정 적용됨 — 저장 필요';
}

function rejectAiChange() {
    clearAiDecorations();
    aiPendingChange = null;
    document.getElementById('ai-result-actions').style.display = 'none';
    document.getElementById('btn-toggle-diff').style.display = 'none';

    if (document.getElementById('monaco-diff-container').style.display !== 'none') {
        toggleDiffView();
    }

    toast('AI 수정을 거부했습니다.', 'info');
}

function toggleDiffView() {
    const editorContainer = document.getElementById('monaco-editor-container');
    const diffContainer = document.getElementById('monaco-diff-container');

    if (diffContainer.style.display === 'none') {
        // Show diff view
        if (!aiPendingChange) return;

        editorContainer.style.display = 'none';
        diffContainer.style.display = 'block';

        if (monacoDiffEditor) {
            monacoDiffEditor.dispose();
        }

        const originalModel = monaco.editor.createModel(aiPendingChange.original, getLanguageFromExtension(currentSourceFile ? '.' + currentSourceFile.split('.').pop() : '.js'));
        const modifiedModel = monaco.editor.createModel(aiPendingChange.modified, getLanguageFromExtension(currentSourceFile ? '.' + currentSourceFile.split('.').pop() : '.js'));

        monacoDiffEditor = monaco.editor.createDiffEditor(diffContainer, {
            automaticLayout: true,
            theme: 'vs-dark',
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'var(--font-mono)'
        });

        monacoDiffEditor.setModel({ original: originalModel, modified: modifiedModel });

        document.getElementById('btn-toggle-diff').innerHTML = '<span style="font-size:13px;">📝 에디터</span>';
    } else {
        // Back to editor
        diffContainer.style.display = 'none';
        editorContainer.style.display = 'block';

        if (monacoDiffEditor) {
            monacoDiffEditor.dispose();
            monacoDiffEditor = null;
        }

        document.getElementById('btn-toggle-diff').innerHTML = '<span style="font-size:13px;">📊 Diff 보기</span>';
    }
}

async function aiMultiFileEdit(instruction) {
    if (!currentProject) return;

    openAiPanel();
    const resultContent = document.getElementById('ai-result-content');
    resultContent.innerHTML = `
        <div style="text-align:center; padding:40px;">
            <div style="font-size:28px; margin-bottom:12px; animation: pulse 1.5s infinite;">📂</div>
            <div style="color:#bd93f9; font-weight:600; margin-bottom:4px;">멀티파일 분석 중...</div>
            <div style="color:var(--text-muted); font-size:12px;">프로젝트 전체를 분석하고 수정안을 생성합니다</div>
        </div>
    `;

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/source/ai-edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'multi-edit', instruction })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI 호출 실패');

        const result = data.result;
        if (!result.patches || result.patches.length === 0) {
            resultContent.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <div style="font-size:24px; margin-bottom:8px;">📋</div>
                    <div>수정이 필요한 파일을 찾지 못했습니다.</div>
                </div>
            `;
            return;
        }

        aiMultiPatches = result.patches;

        resultContent.innerHTML = `
            <div style="margin-bottom:16px;">
                <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:8px;">📂 멀티파일 수정 제안</div>
                <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">${escapeHtml(result.summary || instruction)}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">${result.patches.length}개 파일 수정</div>
            </div>
            ${result.patches.map((p, i) => `
                <div style="margin-bottom:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; border-left:3px solid #58a6ff;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:13px; font-weight:600; color:#58a6ff;">📄 ${escapeHtml(p.file)}</span>
                        <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-muted); cursor:pointer;">
                            <input type="checkbox" checked data-patch-idx="${i}" class="multi-patch-check" style="accent-color:#50fa7b;">
                            적용
                        </label>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">${escapeHtml(p.explanation)}</div>
                    <div style="margin-bottom:4px;">
                        <pre style="background:rgba(248,81,73,0.06); border-radius:4px; padding:6px 8px; font-size:11px; color:#ffa198; white-space:pre-wrap; margin:0 0 4px; font-family:var(--font-mono);">- ${escapeHtml(p.original || '').split('\n').join('\n- ')}</pre>
                        <pre style="background:rgba(63,185,80,0.06); border-radius:4px; padding:6px 8px; font-size:11px; color:#7ee787; white-space:pre-wrap; margin:0; font-family:var(--font-mono);">+ ${escapeHtml(p.modified || '').split('\n').join('\n+ ')}</pre>
                    </div>
                </div>
            `).join('')}
        `;

        // Show apply button
        const actionsDiv = document.getElementById('ai-result-actions');
        actionsDiv.style.display = 'block';
        actionsDiv.innerHTML = `
            <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-primary" onclick="applyMultiPatches()" style="flex:1; background:#238636; border-color:#238636;">
                    ✅ 선택 항목 적용
                </button>
                <button class="btn btn-sm btn-ghost" onclick="closeAiPanel()" style="flex:1; color:#f85149;">
                    ❌ 취소
                </button>
            </div>
        `;

    } catch (e) {
        resultContent.innerHTML = `
            <div style="text-align:center; padding:40px; color:#f85149;">
                <div style="font-size:24px; margin-bottom:8px;">❌</div>
                <div style="font-weight:600;">${escapeHtml(e.message)}</div>
            </div>
        `;
    }
}

async function applyMultiPatches() {
    if (!aiMultiPatches || !currentProject) return;

    // Get checked patches
    const checks = document.querySelectorAll('.multi-patch-check');
    const selectedPatches = [];
    checks.forEach(chk => {
        if (chk.checked) {
            selectedPatches.push(aiMultiPatches[parseInt(chk.dataset.patchIdx)]);
        }
    });

    if (selectedPatches.length === 0) {
        toast('적용할 패치를 선택해주세요.', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/source/ai-apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patches: selectedPatches })
        });
        const data = await res.json();

        if (data.applied > 0) {
            toast(`✅ ${data.applied}개 파일이 수정되었습니다.${data.failed > 0 ? ` (${data.failed}개 실패)` : ''}`, 'success');
            // Reload current file if it was modified
            if (currentSourceFile) {
                const wasModified = selectedPatches.some(p => p.file === currentSourceFile);
                if (wasModified) {
                    openSourceFile(currentSourceFile, currentSourceFile.split('/').pop(), '.' + currentSourceFile.split('.').pop());
                }
            }
        } else {
            toast('패치를 적용할 수 없었습니다. 원본 코드가 변경되었을 수 있습니다.', 'error');
        }

        closeAiPanel();
        aiMultiPatches = null;
    } catch (e) {
        toast('패치 적용 실패: ' + e.message, 'error');
    }
}

function formatMarkdownLite(text) {
    if (!text) return '';
    return text
        .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre style="background:#161b22;padding:12px;border-radius:6px;overflow-x:auto;margin:8px 0;font-family:monospace;border:1px solid var(--border);"><code>$2</code></pre>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;color:var(--accent);">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\#(.*?)\n/g, '<h4 style="margin:12px 0 8px;color:var(--accent);">$1</h4>')
        .replace(/\n/g, '<br/>');
}

function renderAiMessage(msg, isSystem = false) {
    const isUser = msg.role === 'user';
    const bg = isUser ? 'rgba(88, 166, 255, 0.1)' : (isSystem ? 'transparent' : 'rgba(189, 147, 249, 0.1)');
    const border = isUser ? 'rgba(88, 166, 255, 0.3)' : (isSystem ? 'transparent' : 'rgba(189, 147, 249, 0.3)');
    const align = isUser ? 'flex-end' : 'flex-start';
    const textAlign = isUser ? 'right' : 'left';
    const icon = isUser ? '🧑‍💻' : (isSystem ? '⚙️' : '🤖');

    // Render action results if present
    let actionsHtml = '';
    if (msg.actions && msg.actions.length > 0) {
        actionsHtml = msg.actions.map(a => {
            const statusIcon = a.success ? '✅' : '⚠️';
            const statusColor = a.success ? 'var(--success)' : 'var(--warning, #f59e0b)';
            const actionLabel = a.action === 'FIX_AND_DEPLOY' ? '🔧 자동 수정 & 재배포' :
                a.action === 'REDEPLOY' ? '🚀 재배포' : a.action;
            let patchesHtml = '';
            if (a.patches && a.patches.length > 0) {
                patchesHtml = '<div style="margin-top:8px; font-size:12px;">' +
                    a.patches.map(p => `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">📝 <code style="color:var(--accent);">${escapeHtml(p.file)}</code> — ${escapeHtml(p.explanation)}</div>`).join('') +
                    '</div>';
            }
            return `<div class="ai-action-result" style="margin-top:8px; padding:10px 14px; border-radius:8px; background:rgba(0,0,0,0.3); border-left:3px solid ${statusColor};">
                <div style="display:flex; align-items:center; gap:6px; font-weight:600; font-size:13px;">
                    <span>${statusIcon}</span>
                    <span>${actionLabel}</span>
                </div>
                <div style="margin-top:4px; font-size:13px; color:var(--text-muted);">${escapeHtml(a.message)}</div>
                ${a.summary ? '<div style="margin-top:4px; font-size:12px; color:var(--text-secondary);">📋 ' + escapeHtml(a.summary) + '</div>' : ''}
                ${patchesHtml}
            </div>`;
        }).join('');
    }

    return `
    <div style="display:flex; flex-direction:column; align-items:${align}; width:100%;">
        <div style="display:flex; flex-direction:${isUser ? 'row-reverse' : 'row'}; gap:8px; max-width:85%;">
            <div style="font-size:20px; margin-top:4px;">${icon}</div>
            <div style="background:${bg}; border:1px solid ${border}; border-radius:8px; padding:12px 16px; text-align:${textAlign}; line-height:1.6; font-size:14px;">
                ${isUser ? escapeHtml(msg.content) : formatMarkdownLite(msg.content)}
                ${actionsHtml}
            </div>
        </div>
    </div>`;
}

async function loadAiChatHistory() {
    if (!currentProject) return;
    const container = document.getElementById('ai-chat-messages');
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">대화 기록을 불러오는 중...</div>';

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/chat`);
        const data = await res.json();

        if (data.history && data.history.length > 0) {
            container.innerHTML = data.history.map(msg => renderAiMessage(msg)).join('');
        } else {
            container.innerHTML = renderAiMessage({ role: 'assistant', content: '안녕하세요! 저는 Orbitron AI 엔지니어입니다.\n\n**제가 할 수 있는 것들:**\n- 🔍 소스코드 분석 및 에러 진단\n- 🔧 배포 오류 자동 수정 & 재배포\n- 🚀 코드 수정 후 자동 재배포\n- 📤 GitHub PR 자동 생성\n\n무엇을 도와드릴까요?' });
        }
        container.scrollTop = container.scrollHeight;
    } catch (e) {
        container.innerHTML = '<div style="color:var(--danger); text-align:center; padding:20px;">대화 기록을 불러올 수 없습니다.</div>';
    }
}

async function sendAiChat() {
    const input = document.getElementById('ai-chat-input');
    const text = input.value.trim();
    if (!text || !currentProject) return;

    const container = document.getElementById('ai-chat-messages');

    // Remove the greeting helper message if it exists and history was empty
    if (container.innerHTML.includes('무엇을 도와드릴까요?')) container.innerHTML = '';

    // Add user message locally
    container.innerHTML += renderAiMessage({ role: 'user', content: text });
    input.value = '';

    // Add loading indicator
    const loadingId = 'ai-loading-' + Date.now();
    container.innerHTML += `<div id="${loadingId}" style="display:flex; gap:8px; margin-top:8px;">
        <div style="font-size:20px;">🤖</div>
        <div style="color:var(--text-muted); font-style:italic; padding-top:4px;">AI가 답변을 생성하고 있습니다...</div>
    </div>`;
    container.scrollTop = container.scrollHeight;

    const btn = document.getElementById('btn-ai-chat-send');
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/projects/${currentProject.id}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await res.json();

        document.getElementById(loadingId)?.remove();

        if (!res.ok) {
            container.innerHTML += renderAiMessage({ role: 'system', content: `❌ 오류: ${data.error || '답변을 생성하지 못했습니다.'}` }, true);
        } else if (data.reply) {
            container.innerHTML += renderAiMessage(data.reply);
        }
    } catch (e) {
        document.getElementById(loadingId)?.remove();
        container.innerHTML += renderAiMessage({ role: 'system', content: `❌ 네트워크 오류: ${e.message}` }, true);
    } finally {
        container.scrollTop = container.scrollHeight;
        btn.disabled = false;
        input.focus();
    }
}

async function clearAiChat() {
    if (!confirm('대화 기록을 모두 지우시겠습니까?')) return;
    try {
        await fetch(`${API}/projects/${currentProject.id}/chat`, { method: 'DELETE' });
        loadAiChatHistory();
        toast('대화 기록이 초기화되었습니다.', 'success');
    } catch (e) {
        toast('지우기 실패: ' + e.message, 'error');
    }
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

// ============ DB BACKUP ============

async function dbBackup(projectId) {
    const btn = document.getElementById('btn-db-backup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-clone-spinner"></span> 백업 중...';
    }
    try {
        const res = await fetch(`${API}/projects/${projectId}/db-backup`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            toast(`✅ ${data.message}`, 'success');
            loadDbBackupStatus(projectId);
        } else {
            toast(`❌ DB 백업 실패: ${data.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (e) {
        toast(`❌ DB 백업 실패: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-clone-icon">🗄️</span> 백업';
        }
    }
}

async function dbRestore(projectId) {
    if (!confirm('경고: 백업된 DB 데이터로 복원하시겠습니까?\\n현재 동작 중인 데이터베이스 데이터가 덮어씌워지거나 삭제될 수 있습니다. 진행할까요?')) return;
    const btn = document.getElementById('btn-db-restore');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-clone-spinner"></span> 복원 중...';
    }
    try {
        const res = await fetch(`${API}/projects/${projectId}/db-restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            toast(`✅ ${data.message}`, 'success');
        } else {
            toast(`❌ DB 복원 실패: ${data.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (e) {
        toast(`❌ DB 복원 실패: ${e.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-clone-icon">🔄</span> 복원';
        }
    }
}

async function loadDbBackupStatus(projectId) {
    const container = document.getElementById('db-backup-status');
    if (!container) return;
    try {
        const res = await fetch(`${API}/projects/${projectId}/db-backup/status`);
        const status = await res.json();
        if (status.exists) {
            const backupTime = new Date(status.lastBackupTime).toLocaleString('ko-KR');
            container.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div>📅 마지막 백업: <strong>${backupTime}</strong></div>
                    <div>💾 DB 덤프 크기: <strong>${status.fileSizeFormatted}</strong></div>
                    <div style="grid-column: 1 / -1; font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${status.backupDir}">📂 ${status.backupDir}</div>
                </div>`;
        } else {
            container.innerHTML = '<span style="color:var(--text-muted);">⚠️ 아직 DB 백업이 없습니다. 백업 버튼을 눌러 데이터를 안전하게 보관하세요.</span>';
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

// Collapsible sidebar section helper
function makeCollapsible(labelEl, getItemsFn, startCollapsed = false) {
    const arrow = document.createElement('span');
    arrow.style.cssText = 'float:right; font-size:10px; transition:transform 0.2s; margin-right:4px;';
    arrow.textContent = '▼';
    labelEl.appendChild(arrow);
    labelEl.style.cursor = 'pointer';
    labelEl.style.userSelect = 'none';

    let collapsed = startCollapsed;
    function toggle() {
        collapsed = !collapsed;
        const items = getItemsFn();
        items.forEach(item => { item.style.display = collapsed ? 'none' : ''; });
        arrow.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
    labelEl.addEventListener('click', toggle);
    if (startCollapsed) {
        const items = getItemsFn();
        items.forEach(item => { item.style.display = 'none'; });
        arrow.style.transform = 'rotate(-90deg)';
    }
}

async function init() {
    try {
        const res = await fetch(`${API}/server-info`);
        const info = await res.json();
        if (info.publicIp) serverHost = info.publicIp;
    } catch (e) { /* fallback to localhost */ }
    loadProjects();

    // Show viewer read-only banner
    if (isViewerUser()) {
        const banner = document.createElement('div');
        banner.id = 'viewer-banner';
        banner.style.cssText = 'background:linear-gradient(135deg,rgba(255,184,0,0.15),rgba(255,140,0,0.1)); border:1px solid rgba(255,184,0,0.3); color:#ffb800; padding:10px 16px; border-radius:10px; margin:12px 16px; font-size:13px; font-weight:600; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px;';
        banner.innerHTML = '🔒 읽기 전용 계정 — 메뉴를 둘러볼 수 있지만, 프로젝트 생성·배포·수정은 불가합니다.';
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.insertBefore(banner, sidebar.querySelector('.sidebar-nav'));
        // Hide create project button
        const newProjBtn = document.getElementById('sidebar-new-project-wrap');
        if (newProjBtn) newProjBtn.style.display = 'none';
    }

    // Check admin role from JWT and show admin nav
    try {
        const token = getToken();
        if (token) {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);

            // Populating Sidebar User Profile
            const profileName = document.getElementById('sidebar-user-name');
            const profileRole = document.getElementById('sidebar-user-role');
            const profileAvatar = document.getElementById('sidebar-user-avatar');
            if (profileName) profileName.textContent = payload.username || '알 수 없음';
            if (profileRole) profileRole.textContent = payload.role === 'superadmin' ? 'Super Admin' : (payload.role === 'admin' ? 'Admin' : 'Viewer');
            if (profileAvatar && payload.username) profileAvatar.textContent = payload.username.charAt(0).toUpperCase();

            // Admin features
            if (payload.role === 'admin' || payload.role === 'superadmin') {
                const adminSection = document.getElementById('nav-admin-section');
                const adminItems = document.getElementById('nav-admin-items');
                if (adminSection) adminSection.style.display = 'block';
                if (adminItems) adminItems.style.display = 'block';

                // Move admin section to the top of sidebar-nav
                const sidebarNav = document.querySelector('.sidebar-nav');
                if (sidebarNav && adminSection && adminItems) {
                    sidebarNav.insertBefore(adminItems, sidebarNav.firstChild);
                    sidebarNav.insertBefore(adminSection, sidebarNav.firstChild);

                    // Move project selector below admin items, hide New Project button for admin
                    const projSelectWrap = document.getElementById('sidebar-project-select-wrap');
                    const newProjWrap = document.getElementById('sidebar-new-project-wrap');
                    if (projSelectWrap) {
                        const afterAdmin = adminItems.nextSibling;
                        sidebarNav.insertBefore(projSelectWrap, afterAdmin);
                        projSelectWrap.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                        projSelectWrap.style.padding = '12px 0 12px 0';
                    }

                    // Make other sections collapsible (start collapsed)
                    const sections = [
                        { label: '대시보드 홈', items: ['nav-dashboard', 'nav-projects', 'nav-groups'] },
                        { labelId: 'nav-project-section', itemsId: 'nav-project-items' },
                    ];

                    // Wrap 대시보드 홈
                    const dashLabel = sidebarNav.querySelector('.nav-section-label:not(#nav-admin-section):not(#nav-project-section)');
                    if (dashLabel && dashLabel.textContent.includes('대시보드')) {
                        makeCollapsible(dashLabel, () => {
                            const items = [];
                            let el = dashLabel.nextElementSibling;
                            while (el && !el.classList.contains('nav-section-label')) {
                                items.push(el);
                                el = el.nextElementSibling;
                            }
                            return items;
                        }, true);
                    }

                    // Wrap 현재 프로젝트 작업
                    const projLabel = document.getElementById('nav-project-section');
                    const projItems = document.getElementById('nav-project-items');
                    if (projLabel && projItems) {
                        makeCollapsible(projLabel, () => [projItems], true);
                    }

                    // Wrap 전용 배포
                    const allLabels = sidebarNav.querySelectorAll('.nav-section-label');
                    allLabels.forEach(label => {
                        if (label.textContent.includes('전용 배포')) {
                            makeCollapsible(label, () => {
                                const items = [];
                                let el = label.nextElementSibling;
                                while (el && !el.classList.contains('nav-section-label') && !el.classList.contains('sidebar-footer')) {
                                    items.push(el);
                                    el = el.nextElementSibling;
                                }
                                return items;
                            }, true);
                        }
                    });
                }
            }
        }
    } catch (e) { /* ignore */ }
}

init();
setInterval(loadProjects, 5000);
setInterval(loadDashboardResourceStats, 5000);

// ============ PROJECT GROUPS ============

let currentGroup = null;

async function loadGroups() {
    try {
        let groupsUrl = `${API}/groups`;
        if (isAdminUser() && currentProject && currentProject.user_id) {
            groupsUrl += `?owner_id=${currentProject.user_id}`;
        }
        const res = await fetch(groupsUrl);
        const groups = await res.json();
        const container = document.getElementById('groups-list');
        if (groups.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="icon">📂</div><h3>프로젝트 그룹이 없습니다</h3><p>+ New Group 버튼을 눌러 첫 번째 그룹을 만드세요.</p></div>`;
            return;
        }
        container.innerHTML = `<div class="selector-grid">${groups.map(g => {
            const allRunning = g.service_count > 0 && parseInt(g.running_count) === parseInt(g.service_count);
            const someRunning = parseInt(g.running_count) > 0;
            const statusColor = allRunning ? '#3fb950' : someRunning ? '#d29922' : '#484f58';
            return `
            <div class="selector-card" onclick="openGroup(${g.id})" style="${allRunning ? 'box-shadow: 0 0 20px rgba(63,185,80,0.1);' : ''}">
              <div class="selector-card-top">
                <div class="selector-status-dot" style="background:${statusColor};"></div>
                <span class="selector-status-label">${parseInt(g.running_count)}/${parseInt(g.service_count)} 실행 중</span>
              </div>
              <div class="selector-card-name">${escapeHtml(g.name)}</div>
              <div class="selector-card-repo">${g.description ? escapeHtml(g.description) : '서비스 그룹'}</div>
              <div class="selector-card-footer">
                <div style="display:flex; justify-content:space-between; width:100%;">
                  <span>서비스 ${g.service_count}개</span>
                  <span>${timeAgo(g.updated_at)}</span>
                </div>
              </div>
            </div>`;
        }).join('')}</div>`;
    } catch (e) {
        console.error('Failed to load groups:', e);
    }
}

async function openGroup(id) {
    try {
        const res = await fetch(`${API}/groups/${id}`);
        currentGroup = await res.json();
        navigateTo('group-overview');
    } catch (e) {
        toast('그룹 로드 실패', 'error');
    }
}

function renderGroupOverview() {
    const g = currentGroup;
    if (!g) {
        document.getElementById('group-overview-content').innerHTML = '<div style="text-align:center; padding:80px 20px; color:var(--text-muted);"><p>\uadf8\ub8f9\uc744 \uba3c\uc800 \uc120\ud0dd\ud574\uc8fc\uc138\uc694.</p></div>';
        return;
    }
    const services = g.services || [];

    document.getElementById('group-overview-content').innerHTML = `
    <div style="margin-bottom:24px;">
      <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">PROJECT</div>
      <div style="display:flex; align-items:center; gap:12px; margin-top:4px;">
        <h2 style="margin:0; font-size:28px;">${escapeHtml(g.name)}</h2>
        <button class="btn btn-sm btn-ghost" onclick="deleteGroup(${g.id})" title="\uadf8\ub8f9 \uc0ad\uc81c" style="color:var(--danger);">\ud83d\uddd1</button>
      </div>
      ${g.description ? '<div style="color:var(--text-secondary); margin-top:4px; font-size:14px;">' + escapeHtml(g.description) + '</div>' : ''}
    </div>

    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; border-bottom:2px solid var(--accent); padding-bottom:8px;">
      <span style="font-weight:600; color:var(--accent); font-size:14px;">All (${services.length})</span>
      <span style="color:var(--text-muted); font-size:14px;">Services (${services.length})</span>
    </div>

    <div class="group-services-table">
      <div class="group-services-header">
        <span>SERVICE NAME</span>
        <span>TYPE</span>
        <span>RUNTIME</span>
        <span>STATUS</span>
        <span></span>
      </div>
      ${services.length === 0 ? '<div style="text-align:center; padding:40px; color:var(--text-muted);">\uc544\uc9c1 \uc11c\ube44\uc2a4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</div>' :
            services.map((s, i) => renderServiceRow(s, i, g)).join('')}
    </div>

    <div style="margin-top:12px; display:flex; gap:8px;">
      <button class="btn btn-ghost" onclick="openAddServiceModal(${g.id})" style="font-size:13px;">+ \uae30\uc874 \ud504\ub85c\uc81d\ud2b8 \uc5f0\uacb0</button>
      <button class="btn btn-ghost" onclick="openConfigServiceModal(${g.id})" style="font-size:13px;">+ \uc11c\ube0c \uc11c\ube44\uc2a4 \uc815\uc758</button>
    </div>

    ${renderGroupDbConnections(services)}
    `;
}

function renderServiceRow(s, idx, g) {
    const typeIcons = { web: '\ud83c\udf10', static: '\ud83d\udcc4', db_postgres: '\ud83d\uddc4', db_redis: '\ud83d\uddc4', worker: '\u2699\ufe0f' };
    const statusLabels = { running: '\u2705 Running', stopped: '\u23f9 Stopped', building: '\ud83d\udd28 Building', failed: '\u274c Failed' };
    const statusColors = { running: '#3fb950', stopped: '#8b949e', building: '#d29922', failed: '#f85149' };
    const isConfig = s.source === 'config';
    const isLinked = s.source === 'linked';
    const svcId = isConfig ? 'cfg-' + s.key : 'lnk-' + s.id;
    const typeLabel = s.type === 'static' ? 'Static Site' : s.type === 'db_postgres' ? 'PostgreSQL' : s.type === 'worker' ? 'Worker' : 'Web Service';
    const runtime = isConfig ? (s.runtime || typeLabel) : (s.runtime_label || 'Web');
    const clickAction = isConfig ? "toggleServiceDetail('" + svcId + "')" : (isLinked ? "toggleServiceDetail('" + svcId + "')" : "");

    var statusHtml;
    if (isConfig) {
        statusHtml = '<span style="color:#8b949e; font-size:13px;">\ud83d\udccb Config</span>';
    } else {
        statusHtml = '<span style="color:' + (statusColors[s.status] || '#8b949e') + '; font-size:13px;">' + (statusLabels[s.status] || s.status) + '</span>';
    }

    var removeBtn;
    if (isLinked) {
        removeBtn = '<button class="btn btn-sm btn-ghost group-remove-btn" data-group="' + g.id + '" data-project="' + s.id + '" onclick="event.stopPropagation(); confirmRemoveService(this)" title="\uadf8\ub8f9\uc5d0\uc11c \uc81c\uac70" style="font-size:11px;">\u2715</button>';
    } else {
        removeBtn = '<button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); removeConfigService(' + g.id + ", '" + s.key + "')" + ' title="\uc11c\ube44\uc2a4 \uc81c\uac70" style="font-size:11px;">\u2715</button>';
    }

    return '<div class="group-service-row" onclick="' + clickAction + '" data-svc-id="' + svcId + '">' +
        '<span style="display:flex; align-items:center; gap:8px; font-weight:500;">' +
        '<span>' + (typeIcons[s.type] || '\ud83c\udf10') + '</span>' +
        escapeHtml(s.name) +
        (isLinked ? ' <span style="font-size:10px; color:var(--accent); border:1px solid var(--accent); padding:0 4px; border-radius:3px; margin-left:4px;">LINKED</span>' : '') +
        '</span>' +
        '<span>' + typeLabel + '</span>' +
        '<span><span class="group-runtime-badge">' + runtime + '</span></span>' +
        '<span>' + statusHtml + '</span>' +
        '<span>' + removeBtn + '</span>' +
        '</div>' +
        '<div class="group-service-detail" id="detail-' + svcId + '" style="display:none;">' +
        renderServiceDetail(s) +
        '</div>';
}

function renderServiceDetail(s) {
    if (s.type === 'db_postgres' && s.connection_info) {
        var c = s.connection_info;
        return '<div class="svc-detail-content"><div class="svc-detail-section"><h4>\ud83d\udd0c Connection Info</h4>' +
            '<div class="db-conn-grid">' +
            dbConnRow('Hostname', c.hostname) +
            dbConnRow('Port', String(c.port)) +
            dbConnRow('Database', c.database) +
            dbConnRow('Username', c.username) +
            dbConnRow('Password', c.password, true) +
            '</div>' +
            '<div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">' +
            dbConnBlock('Internal Database URL', c.internal_url, true) +
            dbConnBlock('External Database URL', c.external_url, true) +
            dbConnBlock('PSQL Command', c.psql_command, true) +
            '</div></div></div>';
    }

    var html = '';
    if (s.root_dir) {
        html += '<div class="svc-detail-row"><span class="svc-detail-label">Root Directory</span><code class="svc-detail-code">' + escapeHtml(s.root_dir) + '</code></div>';
    }
    if (s.build_command) {
        html += '<div class="svc-detail-row"><span class="svc-detail-label">Build Command</span><code class="svc-detail-code">' + escapeHtml(s.build_command) + '</code></div>';
    }
    if (s.start_command) {
        html += '<div class="svc-detail-row"><span class="svc-detail-label">Start Command</span><code class="svc-detail-code">' + escapeHtml(s.start_command) + '</code></div>';
    }

    var envVars = s.env_vars || {};
    var envKeys = typeof envVars === 'object' ? Object.keys(envVars) : [];
    if (envKeys.length > 0) {
        html += '<div class="svc-detail-section"><h4>\ud83d\udd27 Environment Variables</h4>';
        for (var i = 0; i < envKeys.length; i++) {
            var key = envKeys[i];
            var val = envVars[key];
            var isSensitive = /password|secret|key|token|url/i.test(key);
            html += dbConnRow(key, String(val), isSensitive);
        }
        html += '</div>';
    }

    if (s.has_database_url && s.database_url) {
        html += '<div class="svc-detail-section"><h4>\ud83d\udd17 Database</h4>' + dbConnBlock('DATABASE_URL', s.database_url, true) + '</div>';
    }

    if (s.source === 'linked' && s.tunnel_url) {
        html += '<div class="svc-detail-row"><span class="svc-detail-label">Tunnel URL</span><a href="' + s.tunnel_url + '" target="_blank" style="color:var(--accent);">' + s.tunnel_url + '</a></div>';
    }

    if (s.source === 'linked') {
        html += '<div style="margin-top:12px;"><button class="btn btn-sm btn-primary" onclick="openProjectFromGroup(' + s.id + ')">\ud504\ub85c\uc81d\ud2b8 \uc0c1\uc138 \ud398\uc774\uc9c0 \u2192</button></div>';
    }

    if (!html) {
        html = '<div style="color:var(--text-muted); padding:8px;">\uc0c1\uc138 \uc815\ubcf4\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</div>';
    }

    return '<div class="svc-detail-content">' + html + '</div>';
}

function toggleServiceDetail(svcId) {
    var el = document.getElementById('detail-' + svcId);
    if (!el) return;
    var row = document.querySelector('[data-svc-id="' + svcId + '"]');
    if (el.style.display === 'none') {
        el.style.display = 'block';
        if (row) row.classList.add('expanded');
    } else {
        el.style.display = 'none';
        if (row) row.classList.remove('expanded');
    }
}

function renderGroupDbConnections(services) {
    const dbServices = services.filter(s => s.type === 'db_postgres' && s.connection_info);
    const dbUrlServices = services.filter(s => s.has_database_url && s.type !== 'db_postgres');
    if (dbServices.length === 0 && dbUrlServices.length === 0) return '';

    let html = '<div style="margin-top:32px; border-top:1px solid var(--border); padding-top:24px;">';
    html += '<h3 style="margin-bottom:16px;">🔌 데이터베이스 연결 정보</h3>';

    for (const s of dbServices) {
        const c = s.connection_info;
        html += `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; margin-bottom:16px;">
          <div style="font-weight:600; font-size:15px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">🗄 ${escapeHtml(s.name)}</div>
          <div class="db-conn-grid">
            ${dbConnRow('Hostname', c.hostname)}
            ${dbConnRow('Port', String(c.port))}
            ${dbConnRow('Database', c.database)}
            ${dbConnRow('Username', c.username)}
            ${dbConnRow('Password', c.password, true)}
          </div>
          <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
            ${dbConnBlock('Internal Database URL', c.internal_url, true)}
            ${dbConnBlock('External Database URL', c.external_url, true)}
            ${dbConnBlock('PSQL Command', c.psql_command, true)}
          </div>
        </div>`;
    }

    for (const s of dbUrlServices) {
        let parsed = null;
        try {
            if (s.database_url && s.database_url.includes('://')) {
                const url = new URL(s.database_url);
                parsed = {
                    hostname: url.hostname,
                    port: url.port || (url.protocol.startsWith('postgres') ? '5432' : ''),
                    database: url.pathname.replace(/^\//, ''),
                    username: decodeURIComponent(url.username),
                    password: decodeURIComponent(url.password),
                };
            }
        } catch(e) {}

        if (parsed && parsed.hostname) {
            html += `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; margin-bottom:16px;">
              <div style="font-weight:600; font-size:15px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">🔗 ${escapeHtml(s.name)} (추출된 연결 정보)</div>
              <div class="db-conn-grid">
                ${dbConnRow('Hostname', parsed.hostname)}
                ${dbConnRow('Port', parsed.port)}
                ${dbConnRow('Database', parsed.database)}
                ${dbConnRow('Username', parsed.username)}
                ${dbConnRow('Password', parsed.password, true)}
              </div>
              <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
                ${dbConnBlock('DATABASE_URL (원본)', s.database_url, true)}
              </div>
            </div>`;
        } else {
            html += `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; margin-bottom:16px;">
              <div style="font-weight:600; font-size:15px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">🔗 ${escapeHtml(s.name)} — DATABASE_URL</div>
              ${dbConnBlock('DATABASE_URL', s.database_url, true)}
            </div>`;
        }
    }

    html += '</div>';
    return html;
}

function dbConnRow(label, value, masked = false) {
    const id = 'dbconn-' + Math.random().toString(36).substring(7);
    return `
    <div class="db-conn-row">
      <span class="db-conn-label">${label}</span>
      <div class="db-conn-value-wrap">
        <span class="db-conn-value" id="${id}">${masked ? '••••••••••' : escapeHtml(value)}</span>
        <div class="db-conn-actions">
          ${masked ? `<button class="btn-icon" onclick="event.stopPropagation(); toggleDbValue(this, '${id}', '${escapeHtml(value)}')" title="표시/숨기기">👁</button>` : ''}
          <button class="btn-icon" onclick="event.stopPropagation(); copyToClipboard('${escapeHtml(value)}')" title="복사">📋</button>
        </div>
      </div>
    </div>`;
}

function dbConnBlock(label, value, masked = false) {
    const id = 'dbblock-' + Math.random().toString(36).substring(7);
    const maskedValue = value.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:••••••@');
    return `
    <div>
      <div style="font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">${label}</div>
      <div class="db-conn-block">
        <code id="${id}" style="flex:1; word-break:break-all;">${masked ? escapeHtml(maskedValue) : escapeHtml(value)}</code>
        <div class="db-conn-actions">
          ${masked ? `<button class="btn-icon" onclick="event.stopPropagation(); toggleDbBlock(this, '${id}', '${escapeHtml(value)}', '${escapeHtml(maskedValue)}')" title="표시/숨기기">👁</button>` : ''}
          <button class="btn-icon" onclick="event.stopPropagation(); copyToClipboard('${escapeHtml(value)}')" title="복사">📋</button>
        </div>
      </div>
    </div>`;
}

function toggleDbValue(btn, elId, realValue) {
    const el = document.getElementById(elId);
    if (el.dataset.visible === 'true') {
        el.textContent = '••••••••••';
        el.dataset.visible = 'false';
        btn.textContent = '👁';
    } else {
        el.textContent = realValue;
        el.dataset.visible = 'true';
        btn.textContent = '🙈';
    }
}

function toggleDbBlock(btn, elId, realValue, maskedValue) {
    const el = document.getElementById(elId);
    if (el.dataset.visible === 'true') {
        el.textContent = maskedValue;
        el.dataset.visible = 'false';
        btn.textContent = '👁';
    } else {
        el.textContent = realValue;
        el.dataset.visible = 'true';
        btn.textContent = '🙈';
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        toast('📋 복사 완료!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('📋 복사 완료!', 'success');
    });
}

async function openProjectFromGroup(projectId) {
    try {
        const res = await fetch(`${API}/projects/${projectId}`);
        currentProject = await res.json();
        renderProjectDropdown(allProjectsCache);
        navigateTo('project-overview');
    } catch (e) {
        toast('프로젝트 로드 실패', 'error');
    }
}

function openNewGroupModal() {
    document.getElementById('new-group-modal').classList.add('active');
    document.getElementById('input-group-name').value = '';
    document.getElementById('input-group-desc').value = '';
    document.getElementById('input-group-name').focus();
}

function closeGroupModal() {
    document.getElementById('new-group-modal').classList.remove('active');
}

async function createGroup() {
    const name = document.getElementById('input-group-name').value.trim();
    const description = document.getElementById('input-group-desc').value.trim();
    if (!name) { toast('그룹 이름은 필수입니다.', 'error'); return; }
    try {
        const res = await fetch(`${API}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast('그룹이 생성되었습니다!', 'success');
        closeGroupModal();
        loadGroups();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteGroup(groupId) {
    if (!confirm('이 그룹을 삭제하시겠습니까? (서비스는 유지됩니다)')) return;
    try {
        const res = await fetch(`${API}/groups/${groupId}`, { method: 'DELETE' });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast('그룹이 삭제되었습니다.', 'success');
        currentGroup = null;
        navigateTo('groups');
    } catch (e) { toast(e.message, 'error'); }
}

let addServiceGroupId = null;

async function openAddServiceModal(groupId) {
    addServiceGroupId = groupId;
    document.getElementById('add-service-modal').classList.add('active');
    const container = document.getElementById('unassigned-projects-list');
    container.innerHTML = '로딩 중...';

    try {
        let unassignedUrl = `${API}/groups/unassigned/projects`;
        if (isAdminUser() && currentProject && currentProject.user_id) {
            unassignedUrl += `?owner_id=${currentProject.user_id}`;
        }
        const res = await fetch(unassignedUrl);
        const projects = await res.json();
        if (projects.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">모든 프로젝트가 이미 그룹에 할당되어 있습니다.</div>';
            return;
        }
        const typeIcons = { web: '🌐', db_postgres: '🗄', db_redis: '🗄', worker: '⚙️' };
        container.innerHTML = projects.map(p => `
            <div class="group-unassigned-row" onclick="addServiceToGroup(${groupId}, ${p.id})">
              <span>${typeIcons[p.type] || '🌐'} ${escapeHtml(p.name)}</span>
              <span class="badge badge-${p.status}" style="font-size:11px;">${statusLabel(p.status)}</span>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="color:var(--danger);">프로젝트 목록 로드 실패</div>';
    }
}

function closeAddServiceModal() {
    document.getElementById('add-service-modal').classList.remove('active');
    addServiceGroupId = null;
}

async function addServiceToGroup(groupId, projectId) {
    try {
        const res = await fetch(`${API}/groups/${groupId}/services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectId })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast('서비스가 그룹에 추가되었습니다!', 'success');
        closeAddServiceModal();
        // Refresh group overview
        const groupRes = await fetch(`${API}/groups/${groupId}`);
        currentGroup = await groupRes.json();
        renderGroupOverview();
    } catch (e) { toast(e.message, 'error'); }
}

function confirmRemoveService(btn) {
    if (btn.dataset.confirming === 'true') {
        // Second click — do the removal
        const groupId = btn.dataset.group;
        const projectId = btn.dataset.project;
        removeServiceFromGroup(groupId, projectId);
        return;
    }
    // First click — show confirmation state
    btn.dataset.confirming = 'true';
    btn.textContent = '삭제?';
    btn.style.color = 'var(--danger)';
    btn.style.fontWeight = '600';
    btn.style.fontSize = '12px';
    // Auto-reset after 3 seconds
    setTimeout(() => {
        if (btn.dataset.confirming === 'true') {
            btn.dataset.confirming = 'false';
            btn.textContent = '✕';
            btn.style.color = '';
            btn.style.fontWeight = '';
            btn.style.fontSize = '11px';
        }
    }, 3000);
}

async function removeServiceFromGroup(groupId, projectId) {
    try {
        const res = await fetch(`${API}/groups/${groupId}/services/${projectId}`, { method: 'DELETE' });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast('서비스가 그룹에서 제거되었습니다.', 'success');
        const groupRes = await fetch(`${API}/groups/${groupId}`);
        currentGroup = await groupRes.json();
        renderGroupOverview();
    } catch (e) { toast(e.message, 'error'); }
}

// --- Config Service Modal ---
let configServiceGroupId = null;

function openConfigServiceModal(groupId) {
    configServiceGroupId = groupId;
    document.getElementById('config-service-modal').classList.add('active');
    // Reset fields
    ['cfg-svc-key', 'cfg-svc-name', 'cfg-svc-runtime', 'cfg-svc-rootdir', 'cfg-svc-build', 'cfg-svc-start', 'cfg-svc-envvars',
        'cfg-db-host', 'cfg-db-port', 'cfg-db-name', 'cfg-db-user', 'cfg-db-pass'].forEach(id => {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
    const typeSelect = document.getElementById('cfg-svc-type');
    typeSelect.onchange = function () {
        const isDb = this.value === 'db_postgres';
        document.getElementById('cfg-db-fields').style.display = isDb ? 'block' : 'none';
        
        // 데이터베이스일 경우 불필요한 필드 숨기기 (런타임, Root Directory, 빌드/시작 명령어)
        ['cfg-svc-runtime', 'cfg-svc-rootdir', 'cfg-svc-build', 'cfg-svc-start'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.parentElement) {
                el.parentElement.style.display = isDb ? 'none' : 'block';
            }
        });

        // PostgreSQL 선택 시 개발자 편의를 위해 자동으로 모든 필드 채우기
        if (isDb) {
            const setIfEmpty = (id, val) => {
                const el = document.getElementById(id);
                if (el && !el.value) el.value = val;
            };
            
            setIfEmpty('cfg-svc-key', 'db');
            setIfEmpty('cfg-svc-name', 'PostgreSQL Database');
            setIfEmpty('cfg-db-host', 'db');
            setIfEmpty('cfg-db-port', '5432');
            setIfEmpty('cfg-db-name', 'postgres');
            setIfEmpty('cfg-db-user', 'postgres');
            
            const passEl = document.getElementById('cfg-db-pass');
            if (passEl && !passEl.value) {
                passEl.value = 'pass_' + Math.random().toString(36).substr(2, 6) + '!';
            }
        }
    };
    typeSelect.value = 'web';
    typeSelect.dispatchEvent(new Event('change'));
}

function closeConfigServiceModal() {
    document.getElementById('config-service-modal').classList.remove('active');
    configServiceGroupId = null;
}

async function submitConfigService() {
    var key = document.getElementById('cfg-svc-key').value.trim();
    var name = document.getElementById('cfg-svc-name').value.trim();
    if (!key || !name) { toast('키와 이름은 필수입니다.', 'error'); return; }

    var type = document.getElementById('cfg-svc-type').value;
    var runtime = document.getElementById('cfg-svc-runtime').value.trim();
    var root_dir = document.getElementById('cfg-svc-rootdir').value.trim();
    var build_command = document.getElementById('cfg-svc-build').value.trim();
    var start_command = document.getElementById('cfg-svc-start').value.trim();

    // Parse env vars
    var envVarsText = document.getElementById('cfg-svc-envvars').value.trim();
    var env_vars = {};
    if (envVarsText) {
        envVarsText.split('\n').forEach(function (line) {
            var eqIdx = line.indexOf('=');
            if (eqIdx > 0) {
                env_vars[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
            }
        });
    }

    // DB connection info for PostgreSQL type
    var connection_info = null;
    if (type === 'db_postgres') {
        connection_info = {
            hostname: document.getElementById('cfg-db-host').value.trim() || 'dev-postgres',
            port: parseInt(document.getElementById('cfg-db-port').value.trim()) || 5432,
            database: document.getElementById('cfg-db-name').value.trim() || 'sodamfn',
            username: document.getElementById('cfg-db-user').value.trim() || 'devuser',
            password: document.getElementById('cfg-db-pass').value.trim() || 'devpass123'
        };
    }

    try {
        var res = await fetch(API + '/groups/' + configServiceGroupId + '/config/service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, name, type, runtime, root_dir, build_command, start_command, env_vars, connection_info })
        });
        if (!res.ok) { var err = await res.json(); throw new Error(err.error); }
        toast(name + ' 서비스가 추가되었습니다.', 'success');
        closeConfigServiceModal();
        // Refresh group overview
        var groupRes = await fetch(API + '/groups/' + configServiceGroupId);
        currentGroup = await groupRes.json();
        renderGroupOverview();
    } catch (e) { toast(e.message, 'error'); }
}

async function removeConfigService(groupId, key) {
    try {
        var res = await fetch(API + '/groups/' + groupId + '/config/service/' + key, { method: 'DELETE' });
        if (!res.ok) { var err = await res.json(); throw new Error(err.error); }
        toast('서비스가 제거되었습니다.', 'success');
        var groupRes = await fetch(API + '/groups/' + groupId);
        currentGroup = await groupRes.json();
        renderGroupOverview();
    } catch (e) { toast(e.message, 'error'); }
}

// ============ ADMIN DASHBOARD ============

let adminSystemSSE = null;

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}일 ${h}시간 ${m}분`;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

function gaugeCircle(percent, label, color, detail) {
    const p = Math.min(100, Math.max(0, parseFloat(percent) || 0));
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (p / 100) * circumference;
    return `
    <div style="text-align:center; min-width:120px;">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="8"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 50 50)" style="transition:stroke-dashoffset 0.5s ease;"/>
        <text x="50" y="46" text-anchor="middle" fill="var(--text-primary)" font-size="18" font-weight="700">${p}%</text>
        <text x="50" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="10">${detail || ''}</text>
      </svg>
      <div style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-top:4px;">${label}</div>
    </div>`;
}

function renderAdminSystem() {
    const el = document.getElementById('admin-system-content');
    el.innerHTML = `
    <div style="background:linear-gradient(135deg, rgba(88,166,255,0.08), rgba(189,147,249,0.05)); border:1px solid var(--border); border-radius:12px; padding:24px; margin-bottom:24px;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
        <span style="font-size:24px;">🖥</span>
        <div>
          <div style="font-size:18px; font-weight:700; color:var(--text-primary);">Orbitron 서버 상태</div>
          <div style="font-size:13px; color:var(--text-muted);">실시간 시스템 메트릭</div>
        </div>
      </div>
      <div id="admin-gauges" style="display:flex; justify-content:center; gap:32px; flex-wrap:wrap;">
        ${gaugeCircle(0, 'CPU', '#58a6ff', '--')}
        ${gaugeCircle(0, 'RAM', '#3fb950', '--')}
        ${gaugeCircle(0, 'Disk', '#d29922', '--')}
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px;">
        <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--text-primary);">📊 서버 정보</div>
        <div id="admin-server-info" style="font-size:13px; color:var(--text-secondary); line-height:2;">로딩 중...</div>
      </div>
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px;">
        <div style="font-size:14px; font-weight:600; margin-bottom:12px; color:var(--text-primary);">🐳 Docker 상태</div>
        <div id="admin-docker-info" style="font-size:13px; color:var(--text-secondary); line-height:2;">로딩 중...</div>
      </div>
    </div>
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:14px; font-weight:600; color:var(--text-primary);">📋 서버 로그</div>
        <button class="btn btn-sm btn-ghost" onclick="loadAdminLogs()">🔄 새로고침</button>
      </div>
      <div id="admin-log-viewer" class="log-viewer" style="max-height:300px; font-size:12px;">로딩 중...</div>
    </div>`;

    // Start SSE stream
    startAdminSSE();
    loadAdminDocker();
    loadAdminLogs();
}

function startAdminSSE() {
    if (adminSystemSSE) adminSystemSSE.close();
    const token = getToken();
    adminSystemSSE = new EventSource(`${API}/admin/system/stream?token=${token}`);
    adminSystemSSE.onmessage = (e) => {
        try {
            const d = JSON.parse(e.data);
            if (d.error) return;
            // Update gauges
            const gaugesEl = document.getElementById('admin-gauges');
            if (gaugesEl) {
                gaugesEl.innerHTML =
                    gaugeCircle(d.cpu.usage, 'CPU', '#58a6ff', `${d.cpu.cores} cores`) +
                    gaugeCircle(d.memory.percent, 'RAM', '#3fb950', `${formatBytes(d.memory.used)} / ${formatBytes(d.memory.total)}`) +
                    gaugeCircle(d.disk.percent, 'Disk', '#d29922', `${formatBytes(d.disk.used)} / ${formatBytes(d.disk.total)}`);
            }
            // Update server info
            const infoEl = document.getElementById('admin-server-info');
            if (infoEl) {
                infoEl.innerHTML = `
                  <div>🕐 서버 업타임: <strong>${formatUptime(d.system.uptime)}</strong></div>
                  <div>⚙️ Node.js: <strong>${d.process.nodeVersion}</strong> | PID: <strong>${d.process.pid}</strong></div>
                  <div>💾 프로세스 메모리: <strong>${formatBytes(d.process.memoryUsage.rss)}</strong></div>
                  <div>📡 Load Average: <strong>${d.system.loadAvg.map(l => l.toFixed(2)).join(' / ')}</strong></div>
                  <div>🌐 네트워크 I/O: ↓ <strong>${formatBytes(d.network.rxBytes)}</strong> / ↑ <strong>${formatBytes(d.network.txBytes)}</strong></div>
                  <div>🖥 호스트: <strong>${d.system.hostname}</strong> (${d.system.platform}/${d.system.arch})</div>`;
            }
        } catch (err) { /* ignore parse errors */ }
    };
    adminSystemSSE.onerror = () => {
        // Will auto-reconnect
    };
}

// Stop SSE when navigating away
const origNavigateTo = navigateTo;
navigateTo = function (page) {
    if (!page.startsWith('admin-system') && adminSystemSSE) {
        adminSystemSSE.close();
        adminSystemSSE = null;
    }
    return origNavigateTo(page);
};

async function loadAdminDocker() {
    try {
        const res = await fetch(`${API}/admin/docker`);
        if (!res.ok) throw new Error('Failed');
        const d = await res.json();
        const el = document.getElementById('admin-docker-info');
        if (el) {
            el.innerHTML = `
              <div>📦 컨테이너: <strong style="color:var(--success);">${d.containers.running}</strong> 실행 / <strong>${d.containers.total}</strong> 전체</div>
              <div>💿 이미지: <strong>${d.images.total}</strong>개</div>
              <div>💾 볼륨: <strong>${d.volumes.total}</strong>개</div>
              <div style="margin-top:8px; font-size:12px; color:var(--text-muted);">실행 중인 컨테이너:</div>
              ${d.containers.list.filter(c => c.status?.startsWith('Up')).map(c =>
                `<div style="font-size:12px; padding:2px 0;"><code style="color:var(--accent);">${c.name}</code> <span style="color:var(--text-muted);">${c.status}</span></div>`
            ).join('')}`;
        }
    } catch (e) {
        const el = document.getElementById('admin-docker-info');
        if (el) el.innerHTML = '<span style="color:var(--danger);">Docker 정보를 불러올 수 없습니다.</span>';
    }
}

async function loadAdminLogs() {
    try {
        const res = await fetch(`${API}/admin/logs?lines=80`);
        if (!res.ok) throw new Error('Failed');
        const d = await res.json();
        const el = document.getElementById('admin-log-viewer');
        if (el) {
            el.textContent = d.logs || 'No logs available';
            el.scrollTop = el.scrollHeight;
        }
    } catch (e) {
        const el = document.getElementById('admin-log-viewer');
        if (el) el.textContent = '로그를 불러올 수 없습니다.';
    }
}

// ============ ADMIN USERS ============

let adminUserSearch = '';
let adminUserFilterRole = '';
let adminUserFilterPlan = '';
let adminUserSort = 'created_at';
let adminUserOrder = 'asc';
let adminUserPage = 1;

async function renderAdminUsers(page) {
    if (page !== undefined) adminUserPage = page;
    const el = document.getElementById('admin-users-content');
    const params = new URLSearchParams();
    if (adminUserSearch) params.set('search', adminUserSearch);
    if (adminUserFilterRole) params.set('role', adminUserFilterRole);
    if (adminUserFilterPlan) params.set('plan', adminUserFilterPlan);
    params.set('sort', adminUserSort);
    params.set('order', adminUserOrder);
    params.set('page', adminUserPage);
    params.set('limit', 30);

    try {
        const res = await fetch(`${API}/admin/users?${params}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const users = data.users;
        const { page: curPage, total, totalPages } = data.pagination;
        const planColors = { starter: '#8b949e', pro: '#58a6ff', team: '#3fb950', enterprise: '#d29922' };
        const planLabels = { starter: 'Starter', pro: 'Pro', team: 'Team', enterprise: 'Enterprise' };
        const planIcons = { starter: '🌱', pro: '⚡', team: '🏢', enterprise: '👑' };

        const sortIcon = (col) => adminUserSort === col ? (adminUserOrder === 'asc' ? ' ▲' : ' ▼') : '';
        const sortClick = (col) => `onclick="adminSortUsers('${col}')"`;

        el.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:200px; position:relative;">
            <input id="admin-user-search" type="text" placeholder="🔍 이름 또는 이메일 검색..." value="${escapeHtml(adminUserSearch)}"
              style="width:100%; padding:10px 14px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); border-radius:8px; font-size:13px; box-sizing:border-box;"
              oninput="adminUserSearchDebounce(this.value)">
          </div>
          <select id="admin-filter-role" onchange="adminUserFilterRole=this.value; adminUserPage=1; renderAdminUsers();"
            style="padding:8px 10px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); border-radius:8px; font-size:13px;">
            <option value="" ${!adminUserFilterRole ? 'selected' : ''}>모든 역할</option>
            <option value="superadmin" ${adminUserFilterRole === 'superadmin' ? 'selected' : ''}>👑 Super Admin</option>
            <option value="admin" ${adminUserFilterRole === 'admin' ? 'selected' : ''}>🛡 Admin</option>
            <option value="user" ${adminUserFilterRole === 'user' ? 'selected' : ''}>👤 User</option>
            <option value="viewer" ${adminUserFilterRole === 'viewer' ? 'selected' : ''}>👁 Viewer</option>
          </select>
          <select id="admin-filter-plan" onchange="adminUserFilterPlan=this.value; adminUserPage=1; renderAdminUsers();"
            style="padding:8px 10px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); border-radius:8px; font-size:13px;">
            <option value="" ${!adminUserFilterPlan ? 'selected' : ''}>모든 요금제</option>
            <option value="starter" ${adminUserFilterPlan === 'starter' ? 'selected' : ''}>🌱 Starter</option>
            <option value="pro" ${adminUserFilterPlan === 'pro' ? 'selected' : ''}>⚡ Pro</option>
            <option value="team" ${adminUserFilterPlan === 'team' ? 'selected' : ''}>🏢 Team</option>
            <option value="enterprise" ${adminUserFilterPlan === 'enterprise' ? 'selected' : ''}>👑 Enterprise</option>
          </select>
          <div style="font-size:12px; color:var(--text-muted); padding:4px;">총 <strong>${total}</strong>명</div>
        </div>
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow-x:auto;">
          <table style="width:100%; min-width:850px; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:rgba(255,255,255,0.03); text-align:left;">
                <th style="padding:10px; font-weight:600; color:var(--text-secondary); cursor:pointer;" ${sortClick('id')}>ID${sortIcon('id')}</th>
                <th style="padding:10px; font-weight:600; color:var(--text-secondary); cursor:pointer;" ${sortClick('username')}>사용자명${sortIcon('username')}</th>
                <th style="padding:10px; font-weight:600; color:var(--text-secondary); cursor:pointer;" ${sortClick('email')}>이메일${sortIcon('email')}</th>
                <th style="padding:10px; font-weight:600; color:var(--text-secondary); cursor:pointer;" ${sortClick('role')}>역할${sortIcon('role')}</th>
                <th style="padding:10px; font-weight:600; color:var(--text-secondary); cursor:pointer;" ${sortClick('plan')}>요금제${sortIcon('plan')}</th>
                <th style="padding:10px; font-weight:600; color:var(--text-secondary); cursor:pointer; text-align:center;" ${sortClick('project_count')}>프로젝트${sortIcon('project_count')}</th>
                <th style="padding:10px; font-weight:600; color:var(--text-secondary); cursor:pointer;" ${sortClick('created_at')}>가입일${sortIcon('created_at')}</th>
                <th style="padding:10px; font-weight:600; color:var(--text-secondary);">관리</th>
              </tr>
            </thead>
            <tbody>
              ${users.length === 0 ? `<tr><td colspan="8" style="padding:30px; text-align:center; color:var(--text-muted);">검색 결과가 없습니다.</td></tr>` : users.map(u => {
            const plan = u.plan || 'starter';
            return `
              <tr style="border-top:1px solid var(--border);">
                <td style="padding:8px 10px; color:var(--text-muted);">${u.id}</td>
                <td style="padding:8px 10px; font-weight:600; white-space:nowrap;">${escapeHtml(u.username)}</td>
                <td style="padding:8px 10px; color:var(--text-secondary); font-size:12px; max-width:200px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(u.email)}</td>
                <td style="padding:8px 10px;">
                  <span style="background:${u.role === 'superadmin' ? 'rgba(255,100,100,0.2);color:#ff6464;' : u.role === 'admin' ? 'rgba(189,147,249,0.2);color:#bd93f9;' : u.role === 'viewer' ? 'rgba(255,184,0,0.15);color:#ffb800;' : 'rgba(255,255,255,0.08);color:var(--text-secondary);'}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; white-space:nowrap;">
                    ${u.role === 'superadmin' ? '👑 Super Admin' : u.role === 'admin' ? '🛡 Admin' : u.role === 'viewer' ? '👁 Viewer' : '👤 User'}
                  </span>
                </td>
                <td style="padding:8px 10px;">
                  <span style="background:rgba(${plan === 'starter' ? '139,148,158' : plan === 'pro' ? '88,166,255' : plan === 'team' ? '63,185,80' : '210,153,34'},0.15); color:${planColors[plan]}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; white-space:nowrap;">
                    ${planIcons[plan]} ${planLabels[plan]}
                  </span>
                </td>
                <td style="padding:8px 10px; text-align:center;"><strong>${u.project_count}</strong></td>
                <td style="padding:8px 10px; color:var(--text-muted); font-size:12px; white-space:nowrap;">${new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                <td style="padding:8px 10px;">
                  <div style="display:flex; gap:4px; align-items:center;">
                    <select onchange="changeUserRole(${u.id}, this.value)" style="padding:3px 4px; background:var(--bg-primary); border:1px solid var(--border); color:var(--text-primary); border-radius:6px; font-size:11px;">
                      <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                      <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                      <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                      <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>Super Admin</option>
                    </select>
                    <select onchange="changeUserPlan(${u.id}, this.value)" style="padding:3px 4px; background:var(--bg-primary); border:1px solid var(--border); color:var(--text-primary); border-radius:6px; font-size:11px;">
                      <option value="starter" ${plan === 'starter' ? 'selected' : ''}>🌱 Starter</option>
                      <option value="pro" ${plan === 'pro' ? 'selected' : ''}>⚡ Pro</option>
                      <option value="team" ${plan === 'team' ? 'selected' : ''}>🏢 Team</option>
                      <option value="enterprise" ${plan === 'enterprise' ? 'selected' : ''}>👑 Enterprise</option>
                    </select>
                    ${isSuperAdmin() && u.role !== 'superadmin' ? `<button onclick="adminDeleteUser(${u.id}, '${escapeHtml(u.username).replace(/'/g, "\\'")}')"
                      style="padding:3px 6px; background:transparent; border:1px solid var(--danger); color:var(--danger); border-radius:6px; font-size:11px; cursor:pointer; white-space:nowrap;"
                      onmouseenter="this.style.background='var(--danger)';this.style.color='#fff'"
                      onmouseleave="this.style.background='transparent';this.style.color='var(--danger)'"
                      title="유저 삭제">🗑</button>` : ''}
                  </div>
                </td>
              </tr>`;
        }).join('')}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
        <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:16px;">
          <button onclick="renderAdminUsers(1)" ${curPage <= 1 ? 'disabled' : ''}
            style="padding:6px 10px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); border-radius:6px; cursor:pointer; font-size:12px;">«</button>
          <button onclick="renderAdminUsers(${curPage - 1})" ${curPage <= 1 ? 'disabled' : ''}
            style="padding:6px 10px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); border-radius:6px; cursor:pointer; font-size:12px;">‹ 이전</button>
          <span style="font-size:13px; color:var(--text-secondary); padding:0 8px;">
            <strong>${curPage}</strong> / ${totalPages} 페이지
          </span>
          <button onclick="renderAdminUsers(${curPage + 1})" ${curPage >= totalPages ? 'disabled' : ''}
            style="padding:6px 10px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); border-radius:6px; cursor:pointer; font-size:12px;">다음 ›</button>
          <button onclick="renderAdminUsers(${totalPages})" ${curPage >= totalPages ? 'disabled' : ''}
            style="padding:6px 10px; background:var(--surface); border:1px solid var(--border); color:var(--text-primary); border-radius:6px; cursor:pointer; font-size:12px;">»</button>
        </div>` : `<div style="margin-top:12px; font-size:12px; color:var(--text-muted); text-align:center;">총 ${total}명의 사용자</div>`}`;

        // Restore focus to search input
        const searchInput = document.getElementById('admin-user-search');
        if (searchInput && document.activeElement?.id !== 'admin-user-search') {
            // Don't steal focus
        }
    } catch (e) {
        el.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">유저 정보를 불러올 수 없습니다.</div>`;
    }
}

let _adminSearchTimer = null;
function adminUserSearchDebounce(val) {
    clearTimeout(_adminSearchTimer);
    _adminSearchTimer = setTimeout(() => {
        adminUserSearch = val;
        adminUserPage = 1;
        renderAdminUsers();
    }, 300);
}

function adminSortUsers(col) {
    if (adminUserSort === col) {
        adminUserOrder = adminUserOrder === 'asc' ? 'desc' : 'asc';
    } else {
        adminUserSort = col;
        adminUserOrder = 'asc';
    }
    adminUserPage = 1;
    renderAdminUsers();
}

async function changeUserRole(userId, role) {
    try {
        const res = await fetch(`${API}/admin/users/${userId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast(`역할이 ${role}로 변경되었습니다.`, 'success');
        renderAdminUsers();
    } catch (e) { toast(e.message, 'error'); renderAdminUsers(); }
}

async function changeUserPlan(userId, plan) {
    try {
        const res = await fetch(`${API}/admin/users/${userId}/plan`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        const planLabels = { starter: 'Starter', pro: 'Pro', team: 'Team', enterprise: 'Enterprise' };
        toast(`요금제가 ${planLabels[plan]}로 변경되었습니다.`, 'success');
        renderAdminUsers();
    } catch (e) { toast(e.message, 'error'); renderAdminUsers(); }
}

async function adminDeleteUser(userId, username) {
    if (!confirm(`정말로 사용자 "${username}"을(를) 삭제하시겠습니까?\n\n⚠️ 해당 사용자의 모든 프로젝트와 데이터가 함께 삭제됩니다!`)) return;
    try {
        const res = await fetch(`${API}/admin/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(data.message, 'success');
        renderAdminUsers();
    } catch (e) { toast(e.message, 'error'); }
}

// ============ ADMIN ALL PROJECTS ============

let adminProjectsCache = [];

async function renderAdminProjects() {
    const el = document.getElementById('admin-projects-content');
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">로딩 중...</div>';
    try {
        const res = await fetch(`${API}/admin/projects`);
        if (!res.ok) throw new Error('Failed');
        adminProjectsCache = await res.json();
        renderAdminProjectsTable(adminProjectsCache);
    } catch (e) {
        el.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">프로젝트 정보를 불러올 수 없습니다.</div>`;
    }
}

function renderAdminProjectsTable(projects) {
    const el = document.getElementById('admin-projects-content');
    const _sc = { running: '#3fb950', stopped: '#484f58', building: '#d29922', failed: '#f85149' };
    const _sl = { running: '실행 중', stopped: '중지됨', building: '빌드 중', failed: '실패' };

    // Stats from full cache
    const total = adminProjectsCache.length;
    const running = adminProjectsCache.filter(p => p.status === 'running').length;
    const stopped = adminProjectsCache.filter(p => p.status === 'stopped' || p.status === 'failed').length;

    // Get unique owners
    const owners = [...new Set(adminProjectsCache.map(p => p.owner_name).filter(Boolean))].sort();

    // Preserve current filter values
    const searchVal = document.getElementById('admin-proj-search')?.value || '';
    const statusVal = document.getElementById('admin-proj-status')?.value || '';
    const ownerVal = document.getElementById('admin-proj-owner')?.value || '';

    el.innerHTML = `
    <div style="display:flex; gap:16px; margin-bottom:24px;">
      <div style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:var(--text-primary);">${total}</div>
        <div style="font-size:13px; color:var(--text-muted);">전체 프로젝트</div>
      </div>
      <div style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:var(--success);">${running}</div>
        <div style="font-size:13px; color:var(--text-muted);">실행 중</div>
      </div>
      <div style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:var(--danger);">${stopped}</div>
        <div style="font-size:13px; color:var(--text-muted);">중지됨</div>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h3 style="margin:0; display:flex; align-items:center; gap:8px;">🌐 전체 프로젝트</h3>
      <button class="btn btn-primary" onclick="openNewProjectModal()">+ 새 프로젝트 생성</button>
    </div>
    <div class="admin-search-bar">
      <input type="text" id="admin-proj-search" placeholder="🔍 프로젝트 이름, 소유자 검색..." value="${escapeHtml(searchVal)}" oninput="debounceAdminProjectSearch()">
      <select id="admin-proj-status" onchange="applyAdminProjectFilter()">
        <option value="">전체 상태</option>
        <option value="running"${statusVal === 'running' ? ' selected' : ''}>🟢 실행 중</option>
        <option value="stopped"${statusVal === 'stopped' ? ' selected' : ''}>⚫ 중지됨</option>
        <option value="building"${statusVal === 'building' ? ' selected' : ''}>🟡 빌드 중</option>
        <option value="failed"${statusVal === 'failed' ? ' selected' : ''}>🔴 실패</option>
      </select>
      <select id="admin-proj-owner" onchange="applyAdminProjectFilter()">
        <option value="">전체 소유자</option>
        ${owners.map(o => `<option value="${escapeHtml(o)}"${ownerVal === o ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}
      </select>
      <span style="font-size:12px; color:var(--text-muted); white-space:nowrap;">${projects.length}/${total}건</span>
    </div>
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:rgba(255,255,255,0.03); text-align:left;">
            <th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">상태</th>
            <th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">프로젝트</th>
            <th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">소유자</th>
            <th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">타입</th>
            <th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">포트</th>
            <th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">URL</th>
            <th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">업데이트</th>
            ${isSuperAdmin() ? '<th style="padding:12px 14px; font-weight:600; color:var(--text-secondary);">관리</th>' : ''}
          </tr>
        </thead>
        <tbody>
        ${projects.length === 0 ? `<tr><td colspan="${isSuperAdmin() ? 8 : 7}" style="padding:30px; text-align:center; color:var(--text-muted);">검색 결과가 없습니다.</td></tr>` :
            projects.map(p => `
          <tr style="border-top:1px solid var(--border); cursor:pointer;" onclick="openProject(${p.id})">
            <td style="padding:10px 14px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${_sc[p.status] || '#484f58'}; ${p.status === 'running' ? 'box-shadow:0 0 6px ' + _sc.running + ';' : ''}"></span>
              <span style="margin-left:6px; font-size:12px; color:${_sc[p.status] || 'var(--text-muted)'};"> ${_sl[p.status] || p.status}</span>
            </td>
            <td style="padding:10px 14px; font-weight:600;">${escapeHtml(p.name)}</td>
            <td style="padding:10px 14px; color:var(--text-secondary);">${escapeHtml(p.owner_name)}</td>
            <td style="padding:10px 14px; color:var(--text-muted);">${p.type || 'web'}</td>
            <td style="padding:10px 14px; font-family:var(--font-mono); color:var(--text-muted);">${p.port || '-'}</td>
            <td style="padding:10px 14px;">${p.tunnel_url ? `<a href="${p.tunnel_url}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent); font-size:12px;">${p.tunnel_url.replace('https://', '')}</a>` : '<span style="color:var(--text-muted);">-</span>'}</td>
            <td style="padding:10px 14px; color:var(--text-muted); font-size:12px;">${timeAgo(p.updated_at || p.created_at)}</td>
            ${isSuperAdmin() ? `<td style="padding:10px 14px;" onclick="event.stopPropagation()">
              <button onclick="adminDeleteProject(${p.id}, '${escapeHtml(p.name).replace(/'/g, "\\'")}')"
                style="padding:3px 8px; background:transparent; border:1px solid var(--danger); color:var(--danger); border-radius:6px; font-size:11px; cursor:pointer;"
                onmouseenter="this.style.background='var(--danger)';this.style.color='#fff'"
                onmouseleave="this.style.background='transparent';this.style.color='var(--danger)'"
                title="프로젝트 삭제">🗑</button>
            </td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

let adminSearchTimer = null;
function debounceAdminProjectSearch() {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = setTimeout(applyAdminProjectFilter, 200);
}

function applyAdminProjectFilter() {
    const q = (document.getElementById('admin-proj-search')?.value || '').toLowerCase().trim();
    const status = document.getElementById('admin-proj-status')?.value || '';
    const owner = document.getElementById('admin-proj-owner')?.value || '';

    let filtered = adminProjectsCache;
    if (q) {
        filtered = filtered.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.owner_name || '').toLowerCase().includes(q) ||
            (p.subdomain || '').toLowerCase().includes(q)
        );
    }
    if (status) {
        filtered = filtered.filter(p => p.status === status);
    }
    if (owner) {
        filtered = filtered.filter(p => p.owner_name === owner);
    }
    renderAdminProjectsTable(filtered);
}

async function adminDeleteProject(projectId, projectName) {
    if (!confirm(`정말로 프로젝트 "${projectName}"을(를) 삭제하시겠습니까?\n\n⚠️ Docker 컨테이너, 배포 기록 등 모든 데이터가 삭제됩니다!`)) return;
    try {
        const res = await fetch(`${API}/admin/projects/${projectId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(data.message, 'success');
        renderAdminProjects();
    } catch (e) { toast(e.message, 'error'); }
}

// ============ ISSUES BOARD ============

async function loadIssues() {
    const el = document.getElementById('issues-list');
    const category = document.getElementById('issue-filter-category')?.value || '';
    const status = document.getElementById('issue-filter-status')?.value || '';
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (status) params.set('status', status);

    try {
        const res = await fetch(`${API}/issues?${params}`);
        if (!res.ok) throw new Error('Failed');
        const issues = await res.json();

        if (issues.length === 0) {
            el.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);">
                <div style="font-size:48px; margin-bottom:16px;">🐛</div>
                <h3 style="color:var(--text-secondary); margin-bottom:8px;">이슈가 없습니다</h3>
                <p>"+ 새 이슈" 버튼을 눌러 첫 이슈를 등록하세요.</p>
            </div>`;
            return;
        }

        el.innerHTML = issues.map(issue => renderIssueCard(issue)).join('');
    } catch (e) {
        el.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">이슈를 불러올 수 없습니다.</div>`;
    }
}

function renderIssueCard(issue) {
    const catIcons = { bug: '🐛', error: '❌', feature: '✨', improvement: '🔧' };
    const catLabels = { bug: '버그', error: '오류', feature: '기능개선', improvement: '개선' };
    const statusColors = { open: '#f85149', in_progress: '#d29922', resolved: '#3fb950', closed: '#484f58' };
    const statusLabels = { open: '미해결', in_progress: '진행중', resolved: '해결됨', closed: '닫힘' };
    const priorityIcons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
    const priorityLabels = { critical: '긴급', high: '높음', medium: '보통', low: '낮음' };

    const cat = issue.category || 'bug';
    const st = issue.status || 'open';
    const pri = issue.priority || 'medium';
    const desc = (issue.description || '').substring(0, 200);
    const sol = issue.solution || '';
    const date = new Date(issue.created_at).toLocaleDateString('ko-KR');

    return `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:12px; transition:border-color 0.2s;"
         onmouseenter="this.style.borderColor='var(--accent)'" onmouseleave="this.style.borderColor='var(--border)'">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                <span style="font-size:16px;">${catIcons[cat]}</span>
                <span style="font-weight:600; font-size:15px; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(issue.title)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:12px;">
                <span style="font-size:12px; padding:2px 8px; border-radius:12px; background:rgba(255,255,255,0.06); color:var(--text-secondary);">
                    ${priorityIcons[pri]} ${priorityLabels[pri]}
                </span>
                <span style="font-size:12px; padding:2px 8px; border-radius:12px; background:rgba(${st === 'open' ? '248,81,73' : st === 'in_progress' ? '210,153,34' : st === 'resolved' ? '63,185,80' : '72,79,88'},0.15); color:${statusColors[st]};">
                    ${statusLabels[st]}
                </span>
            </div>
        </div>
        ${desc ? `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:8px; line-height:1.5;">${escapeHtml(desc)}${issue.description?.length > 200 ? '...' : ''}</div>` : ''}
        ${sol ? `<div style="font-size:12px; color:var(--success); background:rgba(63,185,80,0.08); border:1px solid rgba(63,185,80,0.2); border-radius:6px; padding:8px 10px; margin-bottom:8px;"><strong>💡 해결:</strong> ${escapeHtml(sol.substring(0, 150))}${sol.length > 150 ? '...' : ''}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:12px; font-size:12px; color:var(--text-muted);">
                <span>${catLabels[cat]}</span>
                ${issue.project_name ? `<span>📦 ${escapeHtml(issue.project_name)}</span>` : ''}
                <span>${date}</span>
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn btn-sm btn-ghost" onclick="editIssue(${issue.id})" title="수정">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteIssue(${issue.id})" title="삭제" style="color:var(--danger);">🗑</button>
            </div>
        </div>
    </div>`;
}

function openIssueModal(issue = null) {
    const modal = document.getElementById('issue-modal');
    modal.classList.add('active');

    // Populate project dropdown
    const projSelect = document.getElementById('issue-project');
    projSelect.innerHTML = '<option value="">없음</option>';
    if (allProjectsCache) {
        allProjectsCache.forEach(p => {
            projSelect.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
        });
    }

    if (issue) {
        document.getElementById('issue-modal-title').textContent = '✏️ 이슈 수정';
        document.getElementById('issue-edit-id').value = issue.id;
        document.getElementById('issue-title').value = issue.title || '';
        document.getElementById('issue-category').value = issue.category || 'bug';
        document.getElementById('issue-priority').value = issue.priority || 'medium';
        document.getElementById('issue-status').value = issue.status || 'open';
        document.getElementById('issue-project').value = issue.project_id || '';
        document.getElementById('issue-description').value = issue.description || '';
        document.getElementById('issue-solution').value = issue.solution || '';
    } else {
        document.getElementById('issue-modal-title').textContent = '🐛 새 이슈 등록';
        document.getElementById('issue-edit-id').value = '';
        document.getElementById('issue-title').value = '';
        document.getElementById('issue-category').value = 'bug';
        document.getElementById('issue-priority').value = 'medium';
        document.getElementById('issue-status').value = 'open';
        document.getElementById('issue-project').value = '';
        document.getElementById('issue-description').value = '';
        document.getElementById('issue-solution').value = '';
    }
    document.getElementById('issue-title').focus();
}

function closeIssueModal() {
    document.getElementById('issue-modal').classList.remove('active');
}

async function saveIssue() {
    const editId = document.getElementById('issue-edit-id').value;
    const data = {
        title: document.getElementById('issue-title').value.trim(),
        category: document.getElementById('issue-category').value,
        priority: document.getElementById('issue-priority').value,
        status: document.getElementById('issue-status').value,
        project_id: document.getElementById('issue-project').value || null,
        description: document.getElementById('issue-description').value.trim(),
        solution: document.getElementById('issue-solution').value.trim(),
    };
    if (!data.title) { toast('제목은 필수입니다.', 'error'); return; }

    try {
        const url = editId ? `${API}/issues/${editId}` : `${API}/issues`;
        const method = editId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast(editId ? '이슈가 수정되었습니다.' : '이슈가 등록되었습니다!', 'success');
        closeIssueModal();
        loadIssues();
    } catch (e) { toast(e.message, 'error'); }
}

async function editIssue(id) {
    try {
        const res = await fetch(`${API}/issues`);
        const issues = await res.json();
        const issue = issues.find(i => i.id === id);
        if (issue) openIssueModal(issue);
    } catch (e) { toast('이슈를 불러올 수 없습니다.', 'error'); }
}

async function deleteIssue(id) {
    if (!confirm('이 이슈를 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`${API}/issues/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        toast('이슈가 삭제되었습니다.', 'success');
        loadIssues();
    } catch (e) { toast('삭제 실패', 'error'); }
}

// ============ SUPERADMIN BUG FIXES (KNOWLEDGE BASE) ============

async function loadAdminBugs() {
    try {
        const res = await fetch(`${API}/admin/bugs`);
        if (!res.ok) throw new Error('Failed to load bugs');
        const bugs = await res.json();
        
        const listEl = document.getElementById('admin-bugs-list');
        if (bugs.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">등록된 버그 수정 기록이 없습니다.</div>';
            return;
        }

        listEl.innerHTML = bugs.map(b => `
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4 style="margin:0 0 8px 0; font-size:16px; color:var(--text-primary);">${escapeHtml(b.title)}</h4>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-sm btn-ghost" onclick="editBug(${b.id})">✏️ 수정</button>
                        <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="deleteBug(${b.id})">🗑 삭제</button>
                    </div>
                </div>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
                    작성자: ${escapeHtml(b.created_by_name || '알 수 없음')} | 작성일: ${new Date(b.created_at).toLocaleString()}
                </div>
                ${b.description ? `<div style="margin-bottom:8px;"><strong>에러 내용:</strong> <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; font-family:monospace; font-size:12px; margin-top:4px; white-space:pre-wrap;">${escapeHtml(b.description)}</div></div>` : ''}
                ${b.cause ? `<div style="margin-bottom:8px;"><strong>발생 원인:</strong> <div style="color:var(--text-secondary); margin-top:4px; font-size:13px; white-space:pre-wrap;">${escapeHtml(b.cause)}</div></div>` : ''}
                ${b.resolution ? `<div style="margin-bottom:8px;"><strong>해결 방법:</strong> <div style="color:var(--success); margin-top:4px; font-size:13px; white-space:pre-wrap;">${escapeHtml(b.resolution)}</div></div>` : ''}
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('admin-bugs-list').innerHTML = `<div style="color:var(--danger);">${e.message}</div>`;
    }
}

function openBugModal() {
    document.getElementById('bug-id').value = '';
    document.getElementById('bug-title').value = '';
    document.getElementById('bug-description').value = '';
    document.getElementById('bug-cause').value = '';
    document.getElementById('bug-resolution').value = '';
    document.getElementById('bug-modal-title').textContent = '🐞 새 버그 기록';
    document.getElementById('bug-form-modal').classList.add('active');
}

function closeBugModal() {
    document.getElementById('bug-form-modal').classList.remove('active');
}

async function editBug(id) {
    try {
        const res = await fetch(`${API}/admin/bugs`);
        const bugs = await res.json();
        const b = bugs.find(x => x.id === id);
        if (!b) return;

        document.getElementById('bug-id').value = b.id;
        document.getElementById('bug-title').value = b.title || '';
        document.getElementById('bug-description').value = b.description || '';
        document.getElementById('bug-cause').value = b.cause || '';
        document.getElementById('bug-resolution').value = b.resolution || '';
        document.getElementById('bug-modal-title').textContent = '🐞 버그 기록 수정';
        document.getElementById('bug-form-modal').classList.add('active');
    } catch (e) {
        toast('버그 정보를 불러올 수 없습니다.', 'error');
    }
}

async function saveBug() {
    const id = document.getElementById('bug-id').value;
    const data = {
        title: document.getElementById('bug-title').value.trim(),
        description: document.getElementById('bug-description').value.trim(),
        cause: document.getElementById('bug-cause').value.trim(),
        resolution: document.getElementById('bug-resolution').value.trim()
    };

    if (!data.title) {
        toast('제목을 입력해주세요.', 'error');
        return;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API}/admin/bugs/${id}` : `${API}/admin/bugs`;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!res.ok) throw new Error('저장 실패');
        
        toast('저장되었습니다.', 'success');
        closeBugModal();
        loadAdminBugs();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function deleteBug(id) {
    if (!confirm('정말 이 버그 기록을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`${API}/admin/bugs/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('삭제 실패');
        toast('삭제되었습니다.', 'success');
        loadAdminBugs();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ============ BUSINESS PLAN PAGE ============

function renderBusinessPlan() {
    const el = document.getElementById('business-plan-content');
    if (!el) return;

    const sectionStyle = `background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:28px; margin-bottom:24px;`;
    const h2Style = `margin:0 0 20px 0; font-size:20px; color:var(--text-primary); display:flex; align-items:center; gap:10px;`;
    const h3Style = `margin:24px 0 12px 0; font-size:16px; color:var(--accent); font-weight:600;`;
    const pStyle = `font-size:14px; color:var(--text-secondary); line-height:1.8; margin:8px 0;`;
    const tableStyle = `width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;`;
    const thStyle = `background:rgba(88,166,255,0.08); padding:10px 14px; text-align:left; font-weight:600; color:var(--text-primary); border-bottom:2px solid var(--border);`;
    const tdStyle = `padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text-secondary);`;
    const tdRStyle = `padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text-secondary); text-align:right; font-family:var(--font-mono); font-weight:600;`;
    const highlightBox = `background:rgba(88,166,255,0.06); border:1px solid rgba(88,166,255,0.15); border-radius:8px; padding:16px; margin:16px 0;`;
    const warnBox = `background:rgba(210,153,34,0.08); border:1px solid rgba(210,153,34,0.2); border-radius:8px; padding:16px; margin:16px 0;`;
    const successBox = `background:rgba(63,185,80,0.08); border:1px solid rgba(63,185,80,0.2); border-radius:8px; padding:16px; margin:16px 0;`;
    const badgeBlue = `display:inline-block; background:rgba(88,166,255,0.15); color:#58a6ff; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:600;`;
    const badgeGreen = `display:inline-block; background:rgba(63,185,80,0.15); color:#3fb950; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:600;`;
    const badgeOrange = `display:inline-block; background:rgba(210,153,34,0.15); color:#d29922; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:600;`;

    el.innerHTML = `
    <!-- Header -->
    <div style="text-align:center; margin-bottom:36px; padding:40px 20px; background:linear-gradient(135deg, rgba(88,166,255,0.08), rgba(189,147,249,0.08)); border-radius:16px; border:1px solid rgba(88,166,255,0.1);">
        <div style="font-size:48px; margin-bottom:12px;">🪐</div>
        <h1 style="margin:0 0 8px 0; font-size:28px; color:var(--text-primary); font-weight:700;">Orbitron 상용 서비스 전환 계획서</h1>
        <p style="margin:0; font-size:14px; color:var(--text-muted);">Server Migration & Commercial Service Launch Plan</p>
        <div style="margin-top:16px; display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <span style="${badgeBlue}">v1.0</span>
            <span style="${badgeGreen}">작성일: 2026-04-03</span>
            <span style="${badgeOrange}">Phase 1 ~ Phase 3 로드맵</span>
        </div>
    </div>

    <!-- Executive Summary -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">📌 Executive Summary</h2>
        <p style="${pStyle}">
            <strong>Orbitron</strong>은 GitHub 연동, Docker 기반 자동 배포, AI 오류 분석, Unreal/Unity 게임 스트리밍을 통합한
            <strong>올인원 클라우드 배포 플랫폼</strong>입니다. 현재 온프레미스(로컬 서버)에서 운영 중인 시스템을
            GPU 클라우드 인프라(128GB+ VRAM)로 이전하고, SaaS(Software as a Service) 모델로 상용화하여
            개인 개발자, 스타트업, 게임 스튜디오, 교육기관을 대상으로 서비스를 제공합니다.
        </p>
        <div style="${highlightBox}">
            <strong style="color:var(--text-primary);">핵심 가치 제안 (Value Proposition)</strong>
            <ul style="${pStyle} padding-left:20px;">
                <li><strong>원클릭 배포</strong> — GitHub URL 또는 ZIP 업로드만으로 Docker 컨테이너 자동 빌드 & 배포</li>
                <li><strong>AI 자동 오류 진단</strong> — Claude/Gemini 기반 빌드 에러 분석 + 자동 수정 제안</li>
                <li><strong>게임 스트리밍</strong> — Unreal Engine Pixel Streaming, Unity WebGL 원클릭 배포</li>
                <li><strong>제로 설정 HTTPS</strong> — Cloudflare Tunnel을 통한 자동 SSL + 커스텀 도메인</li>
                <li><strong>AI 코드 에디터</strong> — 웹 IDE에서 인라인 AI 수정, Diff 뷰, 멀티파일 리팩토링 (특허 기술)</li>
                <li><strong>풀스택 대시보드</strong> — 소스 에디터, 콘솔, 환경변수, 로그, 모니터링 통합</li>
            </ul>
        </div>
    </div>

    <!-- 1. Current System Analysis -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">1. 현재 시스템 분석</h2>

        <h3 style="${h3Style}">1.1 기술 스택</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">구성 요소</th><th style="${thStyle}">기술</th><th style="${thStyle}">역할</th></tr>
            <tr><td style="${tdStyle}">런타임</td><td style="${tdStyle}">Node.js (Express)</td><td style="${tdStyle}">API 서버, SSE 스트리밍, SPA 서빙</td></tr>
            <tr><td style="${tdStyle}">컨테이너</td><td style="${tdStyle}">Docker + Docker Compose</td><td style="${tdStyle}">프로젝트 격리 배포, 멀티스테이지 빌드</td></tr>
            <tr><td style="${tdStyle}">리버스 프록시</td><td style="${tdStyle}">Nginx</td><td style="${tdStyle}">라우팅, WebSocket 업그레이드, 대용량 버퍼</td></tr>
            <tr><td style="${tdStyle}">터널링</td><td style="${tdStyle}">Cloudflare Tunnel</td><td style="${tdStyle}">HTTPS 자동 설정, DNS 라우팅</td></tr>
            <tr><td style="${tdStyle}">데이터베이스</td><td style="${tdStyle}">PostgreSQL</td><td style="${tdStyle}">프로젝트/배포/사용자 데이터, AES-256 암호화</td></tr>
            <tr><td style="${tdStyle}">AI 엔진</td><td style="${tdStyle}">Claude 4.6 Sonnet + Gemini 2.5 Flash</td><td style="${tdStyle}">오류 분석, 자동 수정, 코드 어시스턴트</td></tr>
            <tr><td style="${tdStyle}">GPU 서비스</td><td style="${tdStyle}">Pixel Streaming (GTX 1080 x2)</td><td style="${tdStyle}">UE5 게임 6세션 동시 스트리밍</td></tr>
            <tr><td style="${tdStyle}">인증</td><td style="${tdStyle}">JWT + bcrypt + RBAC</td><td style="${tdStyle}">4단계 역할 기반 접근 제어</td></tr>
        </table>

        <h3 style="${h3Style}">1.2 현재 운영 현황</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">항목</th><th style="${thStyle}">현재 상태</th><th style="${thStyle}">제한 사항</th></tr>
            <tr><td style="${tdStyle}">서버</td><td style="${tdStyle}">로컬 온프레미스</td><td style="${tdStyle}">단일 장애점(SPOF), 확장 불가</td></tr>
            <tr><td style="${tdStyle}">GPU</td><td style="${tdStyle}">GTX 1080 x2 (8GB x2 = 16GB VRAM)</td><td style="${tdStyle}">NVENC 2세션/GPU 제한, AI 모델 구동 불가</td></tr>
            <tr><td style="${tdStyle}">배포 프로젝트</td><td style="${tdStyle}">7개 (twinverse, sodamfn 등)</td><td style="${tdStyle}">리소스 경합, 동시 빌드 제한</td></tr>
            <tr><td style="${tdStyle}">스토리지</td><td style="${tdStyle}">~5GB (배포) + DB + 미디어</td><td style="${tdStyle}">백업 미자동화, 재해 복구 없음</td></tr>
            <tr><td style="${tdStyle}">SLA</td><td style="${tdStyle}">없음</td><td style="${tdStyle}">전원/네트워크 장애 시 완전 중단</td></tr>
            <tr><td style="${tdStyle}">스케일링</td><td style="${tdStyle}">수직 확장만 가능</td><td style="${tdStyle}">사용자 증가 대응 불가</td></tr>
        </table>

        <h3 style="${h3Style}">1.3 핵심 기능 상세 분석</h3>

        <div style="${highlightBox}">
            <strong style="color:var(--text-primary);">A. 배포 자동화 엔진 (deployer.js + docker.js)</strong>
            <p style="${pStyle}">
                6단계 파이프라인 (clone → build → container → nginx → tunnel → done) 으로 완전 자동 배포를 수행합니다.
                Node.js, Python, Next.js, 정적 사이트, 풀스택, Docker Compose 등 <strong>10종 이상의 프로젝트 타입을 자동 감지</strong>하며,
                멀티스테이지 Docker 빌드로 캐시 활용 시 2~3배 빌드 속도 향상을 달성합니다.
                Blue-Green 배포로 무중단 업데이트가 가능하며, GitHub Webhook 연동으로 push 시 자동 배포됩니다.
            </p>
            <p style="${pStyle}"><strong>경쟁력:</strong> Vercel, Railway, Render 등과 달리 <u>자체 인프라에서 Docker 네이티브로 모든 언어/프레임워크를 지원</u>하며,
            컨테이너 수준의 완전한 제어권을 제공합니다.</p>
        </div>

        <div style="${highlightBox}">
            <strong style="color:var(--text-primary);">B. AI 오류 분석 & 자동 수정 (aiAnalyzer.js + aiAutoRepair.js)</strong>
            <p style="${pStyle}">
                빌드/런타임 오류 발생 시 Claude 4.6 Sonnet(1차) → Gemini 2.5 Flash(폴백) 듀얼 LLM 라우팅으로 분석합니다.
                에러 로그에서 핵심 50줄을 자동 추출하고, 에러 지식베이스(errorKnowledge.js)의 RAG 패턴 매칭과 결합하여
                <strong>근본 원인 분석 + 코드 패치 제안</strong>을 자동 생성합니다.
                성공률 추적(success_count)으로 지식베이스가 지속 학습됩니다.
            </p>
            <p style="${pStyle}"><strong>경쟁력:</strong> 기존 PaaS에는 없는 고유 기능. Heroku, Render 등은 에러 로그만 보여주지만,
            Orbitron은 <u>원인 분석 + 수정 코드까지 제안</u>합니다.</p>
        </div>

        <div style="${highlightBox}">
            <strong style="color:var(--text-primary);">C. 게임 스트리밍 (pixelStreaming.js)</strong>
            <p style="${pStyle}">
                Unreal Engine Pixel Streaming을 GPU 슬롯 기반으로 관리합니다. 현재 6동시 세션(GPU당 3슬롯)을 지원하며,
                자동 좀비 컨테이너 정리(60초 주기), 최대 1시간 세션 제한, GPU 로드밸런싱을 수행합니다.
                Unity WebGL 빌드도 원클릭 배포를 지원합니다.
            </p>
            <p style="${pStyle}"><strong>경쟁력:</strong> 게임 배포 + 웹앱 배포를 <u>단일 플랫폼에서 통합</u>하며, 직접 경쟁 제품이 없는 영역.
            AWS GameLift, Parsec 등은 게임 전용이며, Vercel/Render는 게임 배포를 지원하지 않습니다.</p>
        </div>

        <div style="${highlightBox}">
            <strong style="color:var(--text-primary);">D. 통합 개발 환경 (소스 에디터, 콘솔, 환경변수)</strong>
            <p style="${pStyle}">
                Monaco Editor 기반 웹 IDE로 배포된 소스코드를 직접 편집하고, 컨테이너 내부 콘솔로 실시간 명령을 실행하며,
                AES-256-GCM 암호화된 환경변수를 안전하게 관리합니다. 배포 로그 실시간 SSE 스트리밍,
                프로젝트 그룹핑, 이슈 보드까지 포함된 올인원 대시보드입니다.
            </p>
        </div>

        <div style="${highlightBox} border-color:rgba(255,121,198,0.3); background:rgba(255,121,198,0.04);">
            <strong style="color:#ff79c6;">E. AI 코드 에디터 — 웹 IDE 내장 LLM 연동 (특허 제6호 출원 예정)</strong>
            <p style="${pStyle}">
                Monaco Editor에 LLM을 직접 연동한 <strong>인라인 AI 코드 수정 시스템</strong>입니다.
                코드 선택 → Ctrl+I 또는 우클릭 컨텍스트 메뉴 → AI 지시 → 수정안 생성 → Diff 비교 → 수락/거부 워크플로우를 제공합니다.
                프로젝트 전체 소스를 분석한 <strong>멀티파일 일괄 리팩토링</strong>과 체크박스 기반 선택적 패치 적용을 지원합니다.
                Claude(1차) → Gemini(폴백) 듀얼 LLM 라우팅으로 안정성을 확보합니다.
            </p>
            <p style="${pStyle}"><strong>경쟁력:</strong> GitHub Copilot, Cursor 등은 데스크톱 IDE 전용. <u>웹 브라우저에서 배포된 서버 코드를 AI로 직접 편집</u>하는 서비스는
            현재 직접적인 경쟁 제품이 확인되지 않으며, 이 기능에 대한 특허를 출원합니다.</p>
        </div>
    </div>

    <!-- 2. Migration Plan -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">2. 서버 이전 계획</h2>

        <h3 style="${h3Style}">2.1 목표 인프라 사양</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">항목</th><th style="${thStyle}">현재</th><th style="${thStyle}">이전 후</th></tr>
            <tr><td style="${tdStyle}">GPU</td><td style="${tdStyle}">GTX 1080 x2 (16GB)</td><td style="${tdStyle} font-weight:600; color:#3fb950;">MI300X 192GB / H100 x2 160GB</td></tr>
            <tr><td style="${tdStyle}">VRAM</td><td style="${tdStyle}">16GB</td><td style="${tdStyle} font-weight:600; color:#3fb950;">128~192GB (8~12배 증가)</td></tr>
            <tr><td style="${tdStyle}">CPU</td><td style="${tdStyle}">로컬 CPU</td><td style="${tdStyle}">32~64 vCPU</td></tr>
            <tr><td style="${tdStyle}">RAM</td><td style="${tdStyle}">제한적</td><td style="${tdStyle}">128~256GB</td></tr>
            <tr><td style="${tdStyle}">스토리지</td><td style="${tdStyle}">로컬 SSD</td><td style="${tdStyle}">NVMe SSD 500GB + 오브젝트 스토리지</td></tr>
            <tr><td style="${tdStyle}">네트워크</td><td style="${tdStyle}">가정용</td><td style="${tdStyle}">1~10 Gbps 전용</td></tr>
            <tr><td style="${tdStyle}">SLA</td><td style="${tdStyle}">없음</td><td style="${tdStyle} font-weight:600; color:#3fb950;">99.99% (연간 다운타임 &lt;53분)</td></tr>
            <tr><td style="${tdStyle}">DDoS 보호</td><td style="${tdStyle}">없음</td><td style="${tdStyle}">기본 포함</td></tr>
            <tr><td style="${tdStyle}">백업</td><td style="${tdStyle}">수동</td><td style="${tdStyle}">자동 일일/주간 백업</td></tr>
        </table>

        <h3 style="${h3Style}">2.2 클라우드 업체 선정 — 종량제 비교</h3>
        <table style="${tableStyle}">
            <tr>
                <th style="${thStyle}">업체</th><th style="${thStyle}">GPU 구성</th><th style="${thStyle}">VRAM</th>
                <th style="${thStyle}">시간당</th><th style="${thStyle}">8h/일</th><th style="${thStyle}">16h/일</th><th style="${thStyle}">24/7</th>
                <th style="${thStyle}">SLA</th><th style="${thStyle}">평가</th>
            </tr>
            <tr style="background:rgba(63,185,80,0.05);">
                <td style="${tdStyle} font-weight:700; color:#3fb950;">Vultr (추천)</td><td style="${tdStyle}">1x MI300X</td><td style="${tdStyle}">192GB</td>
                <td style="${tdRStyle}">₩2,775</td><td style="${tdRStyle}">₩67만</td><td style="${tdRStyle}">₩133만</td><td style="${tdRStyle}">₩200만</td>
                <td style="${tdStyle}">99.99%</td><td style="${tdStyle}"><span style="${badgeGreen}">최적</span></td>
            </tr>
            <tr>
                <td style="${tdStyle}">RunPod Secure</td><td style="${tdStyle}">2x A100 80GB</td><td style="${tdStyle}">160GB</td>
                <td style="${tdRStyle}">₩4,620</td><td style="${tdRStyle}">₩111만</td><td style="${tdRStyle}">₩222만</td><td style="${tdRStyle}">₩333만</td>
                <td style="${tdStyle}">미공개</td><td style="${tdStyle}"><span style="${badgeBlue}">대안</span></td>
            </tr>
            <tr>
                <td style="${tdStyle}">Lambda Labs</td><td style="${tdStyle}">2x A100 80GB</td><td style="${tdStyle}">160GB</td>
                <td style="${tdRStyle}">₩1,050</td><td style="${tdRStyle}">₩25만</td><td style="${tdRStyle}">₩50만</td><td style="${tdRStyle}">₩76만</td>
                <td style="${tdStyle}">Enterprise</td><td style="${tdStyle}"><span style="${badgeOrange}">재고 부족</span></td>
            </tr>
            <tr>
                <td style="${tdStyle}">GCP a3-highgpu-2g</td><td style="${tdStyle}">2x H100</td><td style="${tdStyle}">160GB</td>
                <td style="${tdRStyle}">₩9,000</td><td style="${tdRStyle}">₩216만</td><td style="${tdRStyle}">₩432만</td><td style="${tdRStyle}">₩648만</td>
                <td style="${tdStyle}">99.95%</td><td style="${tdStyle}"><span style="${badgeBlue}">엔터프라이즈</span></td>
            </tr>
            <tr>
                <td style="${tdStyle}">AWS g6e.12xlarge</td><td style="${tdStyle}">4x L40S</td><td style="${tdStyle}">192GB</td>
                <td style="${tdRStyle}">₩15,735</td><td style="${tdRStyle}">₩378만</td><td style="${tdRStyle}">₩755만</td><td style="${tdRStyle}">₩1,133만</td>
                <td style="${tdStyle}">99.99%</td><td style="${tdStyle}"><span style="${badgeOrange}">고비용</span></td>
            </tr>
        </table>

        <div style="${successBox}">
            <strong style="color:#3fb950;">선정 결론: Vultr MI300X (192GB VRAM)</strong>
            <p style="${pStyle}">
                단일 GPU 192GB로 멀티 GPU 관리 복잡도를 제거하고, 99.99% SLA, DDoS 보호, 32개 글로벌 리전을 활용합니다.
                Full VM(Ubuntu + systemd + Docker + root)으로 <strong>기존 Orbitron 아키텍처를 변경 없이 그대로 이전</strong> 가능합니다.
                초기 종량제(시간당 ₩2,775)로 시작하여 사용량에 따라 예약 인스턴스로 전환합니다.
            </p>
        </div>

        <h3 style="${h3Style}">2.3 이전 타임라인</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">단계</th><th style="${thStyle}">기간</th><th style="${thStyle}">작업 내용</th><th style="${thStyle}">산출물</th></tr>
            <tr><td style="${tdStyle}">1. 환경 구축</td><td style="${tdStyle}">1주차</td><td style="${tdStyle}">Vultr 인스턴스 프로비저닝, Ubuntu + Docker + Nginx + PostgreSQL 설치, 보안 설정(SSH 키, 방화벽, fail2ban)</td><td style="${tdStyle}">서버 구성 완료</td></tr>
            <tr><td style="${tdStyle}">2. 데이터 마이그레이션</td><td style="${tdStyle}">2주차</td><td style="${tdStyle}">PostgreSQL pg_dump/restore, 배포 디렉토리 rsync, 환경변수 이전, Docker 이미지 재빌드</td><td style="${tdStyle}">데이터 이전 완료</td></tr>
            <tr><td style="${tdStyle}">3. 서비스 이전</td><td style="${tdStyle}">2~3주차</td><td style="${tdStyle}">Cloudflare Tunnel 재설정, DNS 변경, Nginx 설정 이전, SSL 인증서 확인, GitHub Webhook URL 업데이트</td><td style="${tdStyle}">서비스 라이브</td></tr>
            <tr><td style="${tdStyle}">4. GPU 서비스 이전</td><td style="${tdStyle}">3주차</td><td style="${tdStyle}">MI300X GPU 드라이버 설치, Pixel Streaming 슬롯 확장(6→20+), AI 이미지 생성(Flux.1) GPU 최적화</td><td style="${tdStyle}">GPU 서비스 정상</td></tr>
            <tr><td style="${tdStyle}">5. 검증 & 안정화</td><td style="${tdStyle}">4주차</td><td style="${tdStyle}">부하 테스트, 모니터링 설정(Prometheus + Grafana), 자동 백업 설정, 장애 복구 테스트</td><td style="${tdStyle}">상용 준비 완료</td></tr>
        </table>
    </div>

    <!-- 3. Commercial Service Plan -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">3. 상용 서비스 설계</h2>

        <h3 style="${h3Style}">3.1 타겟 시장 & 고객 세그먼트</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">세그먼트</th><th style="${thStyle}">대상</th><th style="${thStyle}">핵심 니즈</th><th style="${thStyle}">예상 비중</th></tr>
            <tr><td style="${tdStyle}">인디 개발자</td><td style="${tdStyle}">개인/프리랜서 개발자</td><td style="${tdStyle}">저렴한 배포, 간편한 설정, Docker 지원</td><td style="${tdStyle}">40%</td></tr>
            <tr><td style="${tdStyle}">스타트업</td><td style="${tdStyle}">5~20명 규모 팀</td><td style="${tdStyle}">빠른 프로토타입 배포, 팀 협업, CI/CD</td><td style="${tdStyle}">30%</td></tr>
            <tr><td style="${tdStyle}">게임 스튜디오</td><td style="${tdStyle}">UE5/Unity 개발사</td><td style="${tdStyle}">Pixel Streaming 데모, WebGL 퍼블리싱</td><td style="${tdStyle}">15%</td></tr>
            <tr><td style="${tdStyle}">교육기관</td><td style="${tdStyle}">대학, 부트캠프</td><td style="${tdStyle}">학생 프로젝트 호스팅, 교육용 환경</td><td style="${tdStyle}">10%</td></tr>
            <tr><td style="${tdStyle}">에이전시</td><td style="${tdStyle}">웹 에이전시, SI업체</td><td style="${tdStyle}">고객 프로젝트 데모, 스테이징 환경</td><td style="${tdStyle}">5%</td></tr>
        </table>

        <h3 style="${h3Style}">3.2 가격 정책 (Pricing Tiers)</h3>
        <table style="${tableStyle}">
            <tr>
                <th style="${thStyle}">플랜</th><th style="${thStyle}">월 요금</th><th style="${thStyle}">프로젝트</th>
                <th style="${thStyle}">빌드 시간</th><th style="${thStyle}">스토리지</th><th style="${thStyle}">대역폭</th>
                <th style="${thStyle}">기능</th>
            </tr>
            <tr style="background:rgba(255,255,255,0.02);">
                <td style="${tdStyle} font-weight:700;">Free</td>
                <td style="${tdRStyle} color:#3fb950;">₩0</td>
                <td style="${tdStyle}">1개</td><td style="${tdStyle}">100분/월</td>
                <td style="${tdStyle}">500MB</td><td style="${tdStyle}">1GB</td>
                <td style="${tdStyle}">기본 배포, 커뮤니티 지원</td>
            </tr>
            <tr style="background:rgba(88,166,255,0.03);">
                <td style="${tdStyle} font-weight:700; color:#58a6ff;">Starter</td>
                <td style="${tdRStyle} color:#58a6ff;">₩15,000</td>
                <td style="${tdStyle}">5개</td><td style="${tdStyle}">1,000분/월</td>
                <td style="${tdStyle}">5GB</td><td style="${tdStyle}">50GB</td>
                <td style="${tdStyle}">커스텀 도메인, AI 오류 분석 (20회/월), 환경변수 암호화</td>
            </tr>
            <tr style="background:rgba(189,147,249,0.05);">
                <td style="${tdStyle} font-weight:700; color:#bd93f9;">Pro</td>
                <td style="${tdRStyle} color:#bd93f9;">₩49,000</td>
                <td style="${tdStyle}">20개</td><td style="${tdStyle}">무제한</td>
                <td style="${tdStyle}">25GB</td><td style="${tdStyle}">200GB</td>
                <td style="${tdStyle}">AI 어시스턴트 무제한, 자동 배포, 프로젝트 그룹, 팀원 3명</td>
            </tr>
            <tr style="background:rgba(210,153,34,0.05);">
                <td style="${tdStyle} font-weight:700; color:#d29922;">Team</td>
                <td style="${tdRStyle} color:#d29922;">₩129,000</td>
                <td style="${tdStyle}">50개</td><td style="${tdStyle}">무제한</td>
                <td style="${tdStyle}">100GB</td><td style="${tdStyle}">1TB</td>
                <td style="${tdStyle}">팀원 10명, RBAC, DB 호스팅, 우선 빌드 큐, 이메일 지원</td>
            </tr>
            <tr style="background:rgba(63,185,80,0.05);">
                <td style="${tdStyle} font-weight:700; color:#3fb950;">Enterprise</td>
                <td style="${tdRStyle} color:#3fb950;">커스텀</td>
                <td style="${tdStyle}">무제한</td><td style="${tdStyle}">무제한</td>
                <td style="${tdStyle}">무제한</td><td style="${tdStyle}">무제한</td>
                <td style="${tdStyle}">전용 인프라, SLA 보장, SSO, 감사 로그, 전담 지원</td>
            </tr>
        </table>

        <h3 style="${h3Style}">3.3 부가 서비스 (Add-ons)</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">서비스</th><th style="${thStyle}">가격</th><th style="${thStyle}">설명</th></tr>
            <tr><td style="${tdStyle}">Pixel Streaming 세션</td><td style="${tdRStyle}">₩3,500/시간</td><td style="${tdStyle}">UE5 게임 GPU 스트리밍 (세션당 과금)</td></tr>
            <tr><td style="${tdStyle}">AI 이미지 생성</td><td style="${tdRStyle}">₩70/장</td><td style="${tdStyle}">Flux.1-schnell 기반 이미지 생성 API</td></tr>
            <tr><td style="${tdStyle}">추가 스토리지</td><td style="${tdRStyle}">₩200/GB/월</td><td style="${tdStyle}">프로젝트 스토리지 추가</td></tr>
            <tr><td style="${tdStyle}">추가 대역폭</td><td style="${tdRStyle}">₩130/GB</td><td style="${tdStyle}">기본 포함량 초과 시</td></tr>
            <tr><td style="${tdStyle}">PostgreSQL DB</td><td style="${tdRStyle}">₩9,000/월~</td><td style="${tdStyle}">관리형 DB 인스턴스 (256MB~4GB)</td></tr>
            <tr><td style="${tdStyle}">Redis Cache</td><td style="${tdRStyle}">₩7,000/월~</td><td style="${tdStyle}">관리형 캐시 인스턴스</td></tr>
        </table>
    </div>

    <!-- 4. Competitive Analysis -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">4. 경쟁사 분석</h2>

        <table style="${tableStyle}">
            <tr>
                <th style="${thStyle}">기능</th>
                <th style="${thStyle} color:#3fb950;">Orbitron</th>
                <th style="${thStyle}">Vercel</th>
                <th style="${thStyle}">Railway</th>
                <th style="${thStyle}">Render</th>
                <th style="${thStyle}">Heroku</th>
            </tr>
            <tr><td style="${tdStyle} font-weight:600;">Docker 네이티브</td><td style="${tdStyle} color:#3fb950;">O (완전 제어)</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle}">O (제한적)</td><td style="${tdStyle}">O (제한적)</td><td style="${tdStyle}">부분적</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">AI 오류 분석</td><td style="${tdStyle} color:#3fb950;">O (자동 수정)</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">게임 스트리밍</td><td style="${tdStyle} color:#3fb950;">O (UE5 + Unity)</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">웹 IDE (소스 에디터)</td><td style="${tdStyle} color:#3fb950;">O (Monaco)</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle}">Shell만</td><td style="${tdStyle} color:#f85149;">X</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">컨테이너 콘솔</td><td style="${tdStyle} color:#3fb950;">O</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle}">O</td><td style="${tdStyle}">O</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">Docker Compose</td><td style="${tdStyle} color:#3fb950;">O</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">GPU 지원</td><td style="${tdStyle} color:#3fb950;">O (192GB)</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle}">유료 Addon</td></tr>
            <tr><td style="${tdStyle} font-weight:600; color:#ff79c6;">AI 인라인 코드 에디터</td><td style="${tdStyle} color:#3fb950;">O (웹 IDE+LLM)</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td></tr>
            <tr><td style="${tdStyle} font-weight:600; color:#ff79c6;">멀티파일 AI 리팩토링</td><td style="${tdStyle} color:#3fb950;">O (선택적 적용)</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td><td style="${tdStyle} color:#f85149;">X</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">Starter 가격</td><td style="${tdStyle} font-weight:700; color:#3fb950;">₩15,000/월</td><td style="${tdStyle}">₩30,000/월</td><td style="${tdStyle}">₩7,500/월~</td><td style="${tdStyle}">₩10,500/월~</td><td style="${tdStyle}">₩7,500/월~</td></tr>
            <tr><td style="${tdStyle} font-weight:600;">Pro 가격</td><td style="${tdStyle} font-weight:700; color:#3fb950;">₩49,000/월</td><td style="${tdStyle}">₩30,000/유저</td><td style="${tdStyle}">₩30,000/유저</td><td style="${tdStyle}">₩28,500/서비스</td><td style="${tdStyle}">₩37,500/dyno</td></tr>
        </table>

        <div style="${highlightBox}">
            <strong style="color:var(--text-primary);">Orbitron 차별화 포인트</strong>
            <ol style="${pStyle} padding-left:20px;">
                <li><strong>AI 네이티브</strong> — 유일하게 LLM 기반 오류 분석 + 자동 수정을 내장</li>
                <li><strong>AI 코드 에디터</strong> — 웹 IDE에서 인라인 AI 수정 + Diff 뷰 + 멀티파일 리팩토링 (특허 제6호)</li>
                <li><strong>게임 + 웹앱 통합</strong> — 하나의 플랫폼에서 UE5/Unity 게임과 웹앱을 모두 배포</li>
                <li><strong>완전한 Docker 제어</strong> — Dockerfile, Compose, GPU passthrough 모두 지원</li>
                <li><strong>올인원 대시보드</strong> — IDE, 콘솔, 모니터링, 이슈 트래킹까지 통합</li>
            </ol>
        </div>
    </div>

    <!-- 5. Revenue Projection -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">5. 수익 분석 & 재무 예측</h2>

        <h3 style="${h3Style}">5.1 비용 구조 (월간)</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">항목</th><th style="${thStyle}">Phase 1 (1~6개월)</th><th style="${thStyle}">Phase 2 (7~12개월)</th><th style="${thStyle}">Phase 3 (13~24개월)</th></tr>
            <tr><td style="${tdStyle}">GPU 서버 (Vultr MI300X)</td><td style="${tdRStyle}">₩133만 (16h/일)</td><td style="${tdRStyle}">₩200만 (24/7)</td><td style="${tdRStyle}">₩400만 (x2)</td></tr>
            <tr><td style="${tdStyle}">스토리지 + 백업</td><td style="${tdRStyle}">₩5만</td><td style="${tdRStyle}">₩12만</td><td style="${tdRStyle}">₩30만</td></tr>
            <tr><td style="${tdStyle}">AI API (Claude + Gemini)</td><td style="${tdRStyle}">₩8만</td><td style="${tdRStyle}">₩30만</td><td style="${tdRStyle}">₩75만</td></tr>
            <tr><td style="${tdStyle}">Cloudflare (Pro)</td><td style="${tdRStyle}">₩3만</td><td style="${tdRStyle}">₩3만</td><td style="${tdRStyle}">₩30만 (Business)</td></tr>
            <tr><td style="${tdStyle}">도메인 + 기타</td><td style="${tdRStyle}">₩5만</td><td style="${tdRStyle}">₩5만</td><td style="${tdRStyle}">₩8만</td></tr>
            <tr><td style="${tdStyle}">마케팅</td><td style="${tdRStyle}">₩15만</td><td style="${tdRStyle}">₩75만</td><td style="${tdRStyle}">₩225만</td></tr>
            <tr style="background:rgba(88,166,255,0.05);">
                <td style="${tdStyle} font-weight:700; color:var(--text-primary);">총 월 비용</td>
                <td style="${tdRStyle} font-weight:700; color:#f85149;">₩169만</td>
                <td style="${tdRStyle} font-weight:700; color:#f85149;">₩325만</td>
                <td style="${tdRStyle} font-weight:700; color:#f85149;">₩768만</td>
            </tr>
        </table>

        <h3 style="${h3Style}">5.2 사용자 성장 시나리오</h3>
        <div style="${warnBox}">
            <strong style="color:#d29922;">산출 근거</strong>
            <p style="${pStyle}">
                PaaS 시장의 일반적 전환율과 Orbitron의 차별화 기능을 기반으로 <strong>보수적(Conservative)</strong>,
                <strong>기본(Base)</strong>, <strong>낙관적(Optimistic)</strong> 3가지 시나리오로 추정합니다.
                인디해커, Product Hunt, 개발자 커뮤니티(Reddit r/selfhosted, Hacker News) 마케팅을 가정합니다.
                Free → Paid 전환율은 업계 평균 2~5%를 적용했습니다.
            </p>
        </div>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">기간</th><th style="${thStyle}" colspan="2">보수적</th><th style="${thStyle}" colspan="2">기본</th><th style="${thStyle}" colspan="2">낙관적</th></tr>
            <tr><th style="${thStyle}"></th><th style="${thStyle}">Free</th><th style="${thStyle}">유료</th><th style="${thStyle}">Free</th><th style="${thStyle}">유료</th><th style="${thStyle}">Free</th><th style="${thStyle}">유료</th></tr>
            <tr><td style="${tdStyle}">3개월차</td><td style="${tdRStyle}">50</td><td style="${tdRStyle}">3</td><td style="${tdRStyle}">120</td><td style="${tdRStyle}">8</td><td style="${tdRStyle}">300</td><td style="${tdRStyle}">20</td></tr>
            <tr><td style="${tdStyle}">6개월차</td><td style="${tdRStyle}">150</td><td style="${tdRStyle}">10</td><td style="${tdRStyle}">400</td><td style="${tdRStyle}">30</td><td style="${tdRStyle}">1,000</td><td style="${tdRStyle}">70</td></tr>
            <tr><td style="${tdStyle}">12개월차</td><td style="${tdRStyle}">400</td><td style="${tdRStyle}">30</td><td style="${tdRStyle}">1,200</td><td style="${tdRStyle}">90</td><td style="${tdRStyle}">3,000</td><td style="${tdRStyle}">250</td></tr>
            <tr><td style="${tdStyle}">24개월차</td><td style="${tdRStyle}">1,000</td><td style="${tdRStyle}">80</td><td style="${tdRStyle}">3,500</td><td style="${tdRStyle}">280</td><td style="${tdRStyle}">10,000</td><td style="${tdRStyle}">800</td></tr>
        </table>

        <h3 style="${h3Style}">5.3 매출 예측 (기본 시나리오 — 유료 유저 ARPU ₩38,000 기준)</h3>
        <div style="${pStyle}">ARPU 산출: Free ₩0, Starter ₩15,000(50%), Pro ₩49,000(35%), Team ₩129,000(12%), Add-on ₩7,000(평균) = <strong>가중 ARPU ₩38,000</strong></div>
        <table style="${tableStyle}">
            <tr>
                <th style="${thStyle}">기간</th><th style="${thStyle}">유료 유저</th><th style="${thStyle}">구독 매출</th>
                <th style="${thStyle}">Add-on 매출</th><th style="${thStyle}">총 매출</th><th style="${thStyle}">비용</th><th style="${thStyle}">순이익</th>
            </tr>
            <tr>
                <td style="${tdStyle}">3개월차</td><td style="${tdRStyle}">8</td><td style="${tdRStyle}">₩30만</td>
                <td style="${tdRStyle}">₩6만</td><td style="${tdRStyle}">₩36만</td><td style="${tdRStyle}">₩169만</td>
                <td style="${tdRStyle} color:#f85149;">-₩133만</td>
            </tr>
            <tr>
                <td style="${tdStyle}">6개월차</td><td style="${tdRStyle}">30</td><td style="${tdRStyle}">₩114만</td>
                <td style="${tdRStyle}">₩27만</td><td style="${tdRStyle}">₩141만</td><td style="${tdRStyle}">₩169만</td>
                <td style="${tdRStyle} color:#f85149;">-₩28만</td>
            </tr>
            <tr style="background:rgba(63,185,80,0.05);">
                <td style="${tdStyle} font-weight:600;">7개월차 (BEP)</td><td style="${tdRStyle}">35</td><td style="${tdRStyle}">₩133만</td>
                <td style="${tdRStyle}">₩32만</td><td style="${tdRStyle} color:#3fb950; font-weight:700;">₩175만</td><td style="${tdRStyle}">₩169만</td>
                <td style="${tdRStyle} color:#3fb950; font-weight:700;">+₩6만</td>
            </tr>
            <tr>
                <td style="${tdStyle}">12개월차</td><td style="${tdRStyle}">90</td><td style="${tdRStyle}">₩342만</td>
                <td style="${tdRStyle}">₩95만</td><td style="${tdRStyle}">₩437만</td><td style="${tdRStyle}">₩325만</td>
                <td style="${tdRStyle} color:#3fb950; font-weight:700;">+₩112만</td>
            </tr>
            <tr>
                <td style="${tdStyle}">18개월차</td><td style="${tdRStyle}">180</td><td style="${tdRStyle}">₩684만</td>
                <td style="${tdRStyle}">₩216만</td><td style="${tdRStyle}">₩900만</td><td style="${tdRStyle}">₩525만</td>
                <td style="${tdRStyle} color:#3fb950; font-weight:700;">+₩375만</td>
            </tr>
            <tr style="background:rgba(63,185,80,0.08);">
                <td style="${tdStyle} font-weight:700;">24개월차</td><td style="${tdRStyle}">280</td><td style="${tdRStyle}">₩1,064만</td>
                <td style="${tdRStyle}">₩420만</td><td style="${tdRStyle} font-weight:700; color:#3fb950;">₩1,484만</td><td style="${tdRStyle}">₩768만</td>
                <td style="${tdRStyle} font-weight:700; color:#3fb950;">+₩716만</td>
            </tr>
        </table>

        <h3 style="${h3Style}">5.4 누적 손익 추이</h3>
        <div style="display:flex; align-items:flex-end; gap:4px; height:200px; padding:20px; background:rgba(0,0,0,0.2); border-radius:8px; margin:16px 0;">
            ${[
                {m:'1', h:8, c:'#f85149'},  {m:'2', h:12, c:'#f85149'}, {m:'3', h:16, c:'#f85149'},
                {m:'4', h:22, c:'#f85149'},  {m:'5', h:30, c:'#f85149'}, {m:'6', h:42, c:'#d29922'},
                {m:'7', h:50, c:'#3fb950'},  {m:'8', h:58, c:'#3fb950'}, {m:'9', h:66, c:'#3fb950'},
                {m:'10', h:74, c:'#3fb950'}, {m:'11', h:82, c:'#3fb950'},{m:'12', h:92, c:'#3fb950'},
                {m:'15', h:110, c:'#3fb950'},{m:'18', h:135, c:'#3fb950'},{m:'21', h:160, c:'#3fb950'},
                {m:'24', h:185, c:'#3fb950'}
            ].map(d => `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <div style="width:100%; height:${d.h}px; background:${d.c}; border-radius:4px 4px 0 0; min-width:16px; opacity:0.8;"></div>
                    <span style="font-size:10px; color:var(--text-muted);">${d.m}M</span>
                </div>
            `).join('')}
        </div>
        <div style="display:flex; gap:16px; justify-content:center; font-size:12px; color:var(--text-muted);">
            <span><span style="display:inline-block; width:12px; height:12px; background:#f85149; border-radius:2px; vertical-align:middle;"></span> 적자</span>
            <span><span style="display:inline-block; width:12px; height:12px; background:#d29922; border-radius:2px; vertical-align:middle;"></span> 손익분기점 근접</span>
            <span><span style="display:inline-block; width:12px; height:12px; background:#3fb950; border-radius:2px; vertical-align:middle;"></span> 흑자</span>
        </div>

        <h3 style="${h3Style}">5.5 초기 투자금 회수 분석</h3>
        <table style="${tableStyle}">
            <tr><th style="${thStyle}">항목</th><th style="${thStyle}">금액</th></tr>
            <tr><td style="${tdStyle}">이전 비용 (1개월 서버 + 설정 작업)</td><td style="${tdRStyle}">~₩225만</td></tr>
            <tr><td style="${tdStyle}">1~6개월 누적 적자</td><td style="${tdRStyle}">~₩525만</td></tr>
            <tr style="background:rgba(88,166,255,0.05);">
                <td style="${tdStyle} font-weight:700;">총 초기 투자 필요 금액</td><td style="${tdRStyle} font-weight:700; color:#58a6ff;">~₩750만</td>
            </tr>
            <tr><td style="${tdStyle}">손익분기점 (BEP)</td><td style="${tdRStyle} color:#3fb950; font-weight:700;">7개월차 (유료 35명)</td></tr>
            <tr><td style="${tdStyle}">투자금 회수 시점</td><td style="${tdRStyle} color:#3fb950; font-weight:700;">12~14개월차</td></tr>
            <tr><td style="${tdStyle}">24개월 누적 순이익</td><td style="${tdRStyle} color:#3fb950; font-weight:700;">~₩2,700만+</td></tr>
        </table>
    </div>

    <!-- 6. Expected Effects -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">6. 기대 효과</h2>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin:16px 0;">
            <div style="${highlightBox}">
                <div style="font-size:24px; margin-bottom:8px;">⚡</div>
                <strong style="color:var(--text-primary);">성능 12배 향상</strong>
                <p style="${pStyle}">VRAM 16GB → 192GB로 12배 증가. Pixel Streaming 동시 세션 6 → 30+, AI 이미지 생성 속도 5배 이상 향상.
                대형 AI 모델(70B 파라미터) 로컬 호스팅 가능.</p>
            </div>
            <div style="${highlightBox}">
                <div style="font-size:24px; margin-bottom:8px;">🛡</div>
                <strong style="color:var(--text-primary);">엔터프라이즈급 안정성</strong>
                <p style="${pStyle}">99.99% SLA (연간 다운타임 53분 이하), DDoS 보호, 자동 백업, 장애 복구.
                SPOF(단일 장애점) 완전 제거.</p>
            </div>
            <div style="${highlightBox}">
                <div style="font-size:24px; margin-bottom:8px;">🌏</div>
                <strong style="color:var(--text-primary);">글로벌 서비스</strong>
                <p style="${pStyle}">Vultr 32개 글로벌 리전 + Cloudflare CDN으로 전세계 사용자에게 50ms 이하 응답시간 제공.
                한국, 일본, 미국, 유럽 등 주요 시장 커버.</p>
            </div>
            <div style="${highlightBox}">
                <div style="font-size:24px; margin-bottom:8px;">📈</div>
                <strong style="color:var(--text-primary);">확장성 확보</strong>
                <p style="${pStyle}">수직/수평 확장 모두 가능. 사용자 증가 시 인스턴스 추가로 선형 확장.
                쿠버네티스 전환 로드맵으로 무한 스케일링 준비.</p>
            </div>
            <div style="${highlightBox}">
                <div style="font-size:24px; margin-bottom:8px;">💰</div>
                <strong style="color:var(--text-primary);">수익 모델 확립</strong>
                <p style="${pStyle}">5단계 가격 정책(Free → Enterprise) + 종량제 Add-on으로 다층 수익 구조.
                ARPU ₩38,000, LTV(고객 생애 가치) 12개월 기준 ₩456,000 예상.</p>
            </div>
            <div style="${highlightBox}">
                <div style="font-size:24px; margin-bottom:8px;">🎯</div>
                <strong style="color:var(--text-primary);">시장 차별화</strong>
                <p style="${pStyle}">AI 오류 분석 + AI 인라인 코드 에디터 + 게임 스트리밍 + Docker 네이티브 통합은 현존 PaaS에서 직접 경쟁 제품이 확인되지 않는 조합.
                니치 마켓(게임 개발자, AI 스타트업) 선점 기회.</p>
            </div>
            <div style="${highlightBox} border-color:rgba(255,121,198,0.3);">
                <div style="font-size:24px; margin-bottom:8px;">🤖</div>
                <strong style="color:#ff79c6;">AI 코드 에디터 (특허 기술)</strong>
                <p style="${pStyle}">배포된 애플리케이션 코드를 브라우저에서 AI로 검토 · 수정 · 재배포하는 통합 워크플로우.
                인라인 수정, Diff 비교, 멀티파일 리팩토링, 듀얼 LLM 폴백 — 특허 제6호 출원 예정.
                GitHub Copilot, Cursor와 차별화된 웹 네이티브 AI IDE.</p>
            </div>
        </div>
    </div>

    <!-- 7. Risk Analysis -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">7. 리스크 분석 & 대응 전략</h2>

        <table style="${tableStyle}">
            <tr><th style="${thStyle}">리스크</th><th style="${thStyle}">영향도</th><th style="${thStyle}">발생 확률</th><th style="${thStyle}">대응 전략</th></tr>
            <tr>
                <td style="${tdStyle} font-weight:600;">사용자 확보 부진</td>
                <td style="${tdStyle}"><span style="${badgeOrange}">높음</span></td>
                <td style="${tdStyle}"><span style="${badgeOrange}">중간</span></td>
                <td style="${tdStyle}">Free 티어로 진입장벽 낮춤, Product Hunt 런칭, 개발자 커뮤니티 SEO 콘텐츠, 유튜브 데모 영상</td>
            </tr>
            <tr>
                <td style="${tdStyle} font-weight:600;">서버 비용 초과</td>
                <td style="${tdStyle}"><span style="${badgeOrange}">높음</span></td>
                <td style="${tdStyle}"><span style="${badgeBlue}">낮음</span></td>
                <td style="${tdStyle}">종량제로 시작, 사용량 기반 자동 스케일링, 비용 알림 설정, 유휴 시 자동 축소</td>
            </tr>
            <tr>
                <td style="${tdStyle} font-weight:600;">대형 경쟁사 기능 추격</td>
                <td style="${tdStyle}"><span style="${badgeBlue}">중간</span></td>
                <td style="${tdStyle}"><span style="${badgeOrange}">중간</span></td>
                <td style="${tdStyle}">AI + 게임 통합이라는 니치에 집중, 커뮤니티 기반 락인, 빠른 기능 반복</td>
            </tr>
            <tr>
                <td style="${tdStyle} font-weight:600;">GPU 공급 불안정</td>
                <td style="${tdStyle}"><span style="${badgeBlue}">중간</span></td>
                <td style="${tdStyle}"><span style="${badgeBlue}">낮음</span></td>
                <td style="${tdStyle}">멀티 클라우드 전략(Vultr + Lambda 백업), 예약 인스턴스 확보</td>
            </tr>
            <tr>
                <td style="${tdStyle} font-weight:600;">보안 사고</td>
                <td style="${tdStyle}"><span style="display:inline-block; background:rgba(248,81,73,0.15); color:#f85149; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:600;">매우 높음</span></td>
                <td style="${tdStyle}"><span style="${badgeBlue}">낮음</span></td>
                <td style="${tdStyle}">컨테이너 격리, 네트워크 세그멘테이션, AES-256 암호화, 정기 보안 감사, WAF 적용</td>
            </tr>
        </table>
    </div>

    <!-- 8. Roadmap -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">8. 실행 로드맵</h2>

        <div style="position:relative; padding-left:32px; margin:20px 0;">
            <div style="position:absolute; left:12px; top:0; bottom:0; width:2px; background:var(--border);"></div>

            <div style="position:relative; margin-bottom:32px;">
                <div style="position:absolute; left:-27px; top:0; width:14px; height:14px; background:#58a6ff; border-radius:50%; border:3px solid var(--bg-secondary);"></div>
                <div style="${highlightBox}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#58a6ff; font-size:16px;">Phase 1: 인프라 이전 & MVP</strong>
                        <span style="${badgeBlue}">Month 1~2</span>
                    </div>
                    <ul style="${pStyle} padding-left:20px; margin-top:12px;">
                        <li>Vultr MI300X 인스턴스 프로비저닝 & 환경 구축</li>
                        <li>기존 데이터/서비스 전체 마이그레이션</li>
                        <li>결제 시스템 통합 (Stripe)</li>
                        <li>사용자 가입/로그인 개선 (OAuth: GitHub, Google)</li>
                        <li>Free/Starter/Pro 티어 구현 및 리소스 제한</li>
                        <li>모니터링 시스템 구축 (Prometheus + Grafana)</li>
                    </ul>
                </div>
            </div>

            <div style="position:relative; margin-bottom:32px;">
                <div style="position:absolute; left:-27px; top:0; width:14px; height:14px; background:#3fb950; border-radius:50%; border:3px solid var(--bg-secondary);"></div>
                <div style="${successBox}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#3fb950; font-size:16px;">Phase 2: 공개 런칭 & 성장</strong>
                        <span style="${badgeGreen}">Month 3~8</span>
                    </div>
                    <ul style="${pStyle} padding-left:20px; margin-top:12px;">
                        <li>Product Hunt 런칭, Hacker News Show HN 게시</li>
                        <li>팀 기능 (Team 플랜): 초대, RBAC, 공유 프로젝트</li>
                        <li>API 공개 (REST + Webhook) — 외부 CI/CD 연동</li>
                        <li>커스텀 도메인 자동화 (Let's Encrypt + Cloudflare)</li>
                        <li>Pixel Streaming 과금 시스템 (세션 기반)</li>
                        <li>AI 이미지 생성 API 공개 (Flux.1 기반)</li>
                        <li>문서 사이트 + 튜토리얼 + YouTube 데모 시리즈</li>
                    </ul>
                </div>
            </div>

            <div style="position:relative; margin-bottom:32px;">
                <div style="position:absolute; left:-27px; top:0; width:14px; height:14px; background:#bd93f9; border-radius:50%; border:3px solid var(--bg-secondary);"></div>
                <div style="background:rgba(189,147,249,0.08); border:1px solid rgba(189,147,249,0.2); border-radius:8px; padding:16px; margin:16px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#bd93f9; font-size:16px;">Phase 3: 확장 & 엔터프라이즈</strong>
                        <span style="display:inline-block; background:rgba(189,147,249,0.15); color:#bd93f9; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:600;">Month 9~24</span>
                    </div>
                    <ul style="${pStyle} padding-left:20px; margin-top:12px;">
                        <li>Kubernetes 전환 (Docker Swarm → K8s) — 무한 스케일링</li>
                        <li>멀티 리전 배포 (Asia, US, EU)</li>
                        <li>Enterprise 플랜: SSO(SAML/OIDC), 감사 로그, 전용 인프라</li>
                        <li>마켓플레이스: 원클릭 템플릿 (WordPress, Strapi, Supabase 등)</li>
                        <li>CLI 툴 출시 (orbitron deploy, orbitron logs)</li>
                        <li>GitHub App 마켓플레이스 등록</li>
                        <li>시리즈 A 또는 수익 기반 자생 확장 결정</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <!-- 9. Conclusion -->
    <div style="${sectionStyle}">
        <h2 style="${h2Style}">9. 결론</h2>
        <div style="${successBox}">
            <p style="${pStyle}">
                Orbitron은 이미 <strong>완전 동작하는 배포 자동화 플랫폼</strong>입니다.
                10종 프로젝트 타입 자동감지, AI 오류 분석, AI 인라인 코드 에디터, 게임 스트리밍, Docker Compose 지원 등
                경쟁사 대비 명확한 기술적 차별점을 보유하고 있습니다. <strong>6건의 핵심 기술 특허</strong>를 출원하여 기술 우위를 법적으로 보호합니다.
            </p>
            <p style="${pStyle}">
                128GB+ GPU 클라우드(Vultr MI300X)로 이전하고 5억원 투자를 유치하여,
                7명 조직으로 법인을 설립하고 18개월 내 시리즈 A 투자를 유치합니다.
            </p>
            <p style="${pStyle}">
                AI 네이티브 + AI 코드 에디터(특허) + 게임 스트리밍 통합이라는 <strong>차별화된 포지셔닝</strong>과
                이미 검증된 기술 스택을 바탕으로, 인디 개발자/스타트업/게임 스튜디오 시장에서
                빠른 성장이 가능합니다.
            </p>
            <p style="${pStyle} font-weight:700; color:var(--text-primary); font-size:16px; text-align:center; margin-top:20px;">
                "프로젝트를 궤도에 올리세요" — Orbitron, Launch Ready.
            </p>
        </div>
    </div>

    <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">
        본 계획서는 2026년 4월 기준 시장 데이터를 바탕으로 작성되었으며, 실제 결과는 시장 상황에 따라 달라질 수 있습니다.<br>
        Orbitron v1.0 &copy; 2026
    </div>
    `;
}
