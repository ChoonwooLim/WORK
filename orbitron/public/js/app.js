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

function logout() {
    localStorage.removeItem('orbitron_token');
    document.cookie = 'orbitron_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/';
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
        'group-overview': `📂 ${currentGroup?.name || ''} — 서비스 목록`,
    };
    document.getElementById('topbar-title').textContent = titles[page] || '';

    // Update topbar actions
    const actions = document.getElementById('topbar-actions');
    if (page.startsWith('project-') && currentProject) {
        // Redundant project actions removed at user's request
    }

    actions.innerHTML = `
        <a class="btn btn-sm btn-ghost" href="/" style="text-decoration:none; display:flex; align-items:center; gap:6px;">🏠 홈</a>
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
}

// ============ PROJECT LIST ============

async function loadProjects() {
    try {
        const res = await fetch(`${API}/projects`);
        if (!res.ok) {
            if (res.status === 401) return; // Will be handled by the global fetch interceptor
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const projects = await res.json();

        // Update Sidebar Options
        const selectEl = document.getElementById('global-project-select');
        if (selectEl) {
            selectEl.innerHTML = '<option value="" disabled>프로젝트를 선택하세요...</option>' +
                projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

            if (currentProject) {
                // Keep the current project selected if it exists
                selectEl.value = currentProject.id;
            } else if (projects.length > 0) {
                // Auto-select the first project by default, but stay on Dashboard page
                selectEl.value = projects[0].id;
                await onGlobalProjectSelect(projects[0].id, false);
            } else {
                selectEl.innerHTML = '<option value="" disabled selected>생성된 프로젝트 없음</option>';
            }
        }

        renderProjects(projects);
        updateStats(projects);
        loadDashboardResourceStats();
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// Sidebar Global Selection Event
async function onGlobalProjectSelect(id, navigate = true) {
    if (!id) return;
    try {
        const res = await fetch(`${API}/projects/${id}`);
        const data = await res.json();
        if (res.ok) {
            currentProject = data;
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
      <input type="text" id="set-custom-domain" value="${escapeHtml(p.custom_domain || '')}" placeholder="예: myapp.example.com">
      <div class="form-hint">도메인의 DNS A 레코드를 이 서버 IP로 설정한 후 입력하세요</div>
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
            openDeployModal(project.id);
            res.json().catch(() => { }); // Ignore further reads if needed, wait, already parsed await res.json() inline
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
        const selectEl = document.getElementById('global-project-select');
        if (selectEl) {
            selectEl.value = project.id;
        }
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
        const custom_domain = document.getElementById('set-custom-domain')?.value?.trim() || null;
        const ai_model = document.getElementById('set-ai-model')?.value || 'claude-4-6-opus-20260205';

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
            custom_domain,
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
        currentProject.custom_domain = custom_domain;
        currentProject.ai_model = ai_model;
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
                const uptime = formatUptime(stats.uptime || 0);
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
setInterval(loadDashboardResourceStats, 5000);

// ============ PROJECT GROUPS ============

let currentGroup = null;

async function loadGroups() {
    try {
        const res = await fetch(`${API}/groups`);
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
        html += `
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:20px; margin-bottom:16px;">
          <div style="font-weight:600; font-size:15px; margin-bottom:16px; display:flex; align-items:center; gap:8px;">🔗 ${escapeHtml(s.name)} — DATABASE_URL</div>
          ${dbConnBlock('DATABASE_URL', s.database_url, true)}
        </div>`;
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
        const selectEl = document.getElementById('global-project-select');
        if (selectEl) selectEl.value = projectId;
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
        const res = await fetch(`${API}/groups/unassigned/projects`);
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
    document.getElementById('cfg-svc-type').value = 'web';
    document.getElementById('cfg-db-fields').style.display = 'none';
    // Add event listener for type change to show/hide DB fields
    document.getElementById('cfg-svc-type').onchange = function () {
        document.getElementById('cfg-db-fields').style.display = this.value === 'db_postgres' ? 'block' : 'none';
    };
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
