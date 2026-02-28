// RemoteAGT Dashboard — Frontend JS (Auth-aware + Admin)
const API_BASE = '';

// State
let currentPage = 'dashboard';
let currentUser = null;
let metricsInterval = null;
let editingUserId = null;

// ==================== Auth ====================
function getToken() { return localStorage.getItem('ragt_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('ragt_user')); } catch { return null; }
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function checkAuth() {
  const token = getToken();
  currentUser = getUser();
  if (!token || !currentUser) {
    window.location.href = '/login';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('ragt_token');
  localStorage.removeItem('ragt_user');
  window.location.href = '/login';
}

function initUserUI() {
  if (!currentUser) return;

  // Sidebar user profile
  document.getElementById('sidebar-username').textContent = currentUser.username;
  const roleLabels = { superadmin: '🛡 최상위 관리자', admin: '⚙ 관리자', user: '👤 일반 사용자' };
  document.getElementById('sidebar-role').textContent = roleLabels[currentUser.role] || currentUser.role;

  // Topbar user
  document.getElementById('topbar-user').textContent = `${currentUser.username}`;

  // Show admin section if superadmin
  if (currentUser.role === 'superadmin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
}

// ==================== Navigation ====================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.getElementById(`nav-${page}`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  const titles = {
    dashboard: '📊 대시보드',
    containers: '🐳 컨테이너',
    projects: '📦 프로젝트',
    tasks: '📋 작업 이력',
    manual: '📘 사용 매뉴얼',
    telegram: '💬 텔레그램 연동',
    plan: '📖 구축계획서',
    'admin-overview': '🛡 관리자 대시보드',
    'admin-users': '👥 사용자 관리',
    'admin-audit': '📜 활동 로그',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  if (page === 'dashboard') loadDashboard();
  else if (page === 'containers') loadContainers();
  else if (page === 'projects') loadProjects();
  else if (page === 'tasks') loadTasks();
  else if (page === 'manual') loadManual();
  else if (page === 'plan') loadPlan();
  else if (page === 'telegram') loadTelegramStatus();
  else if (page === 'admin-overview') loadAdminOverview();
  else if (page === 'admin-users') loadAdminUsers();
  else if (page === 'admin-audit') loadAdminAudit();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ==================== API Calls ====================
async function apiFetch(url) {
  try {
    const res = await fetch(`${API_BASE}${url}`, { headers: authHeaders() });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.error(`API Error: ${url}`, err);
    return null;
  }
}

async function apiPost(url, body) {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) { logout(); return null; }
    return res.json();
  } catch (err) {
    console.error(`API POST Error: ${url}`, err);
    return null;
  }
}

async function apiPut(url, body) {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) { logout(); return null; }
    return res.json();
  } catch (err) {
    console.error(`API PUT Error: ${url}`, err);
    return null;
  }
}

// ==================== Dashboard ====================
async function loadDashboard() {
  const data = await apiFetch('/api/metrics');
  if (!data) return;

  if (data.system) {
    const { cpu, memory, disk } = data.system;
    document.getElementById('stat-cpu').textContent = `${cpu.usage}%`;
    document.getElementById('stat-mem').textContent = `${memory.usagePercent}%`;
    document.getElementById('stat-disk').textContent = `${disk.usagePercent}%`;
    document.getElementById('cpu-bar').style.width = `${cpu.usage}%`;
    document.getElementById('mem-bar').style.width = `${memory.usagePercent}%`;
    document.getElementById('disk-bar').style.width = `${disk.usagePercent}%`;

    if (cpu.usage > 80) document.getElementById('stat-cpu').style.color = '#ef4444';
    if (memory.usagePercent > 85) document.getElementById('stat-mem').style.color = '#ef4444';
    if (disk.usagePercent > 85) document.getElementById('stat-disk').style.color = '#ef4444';
  }

  if (data.containers) {
    const orbitronContainers = data.containers.filter(c => c.isOrbitron);
    const running = orbitronContainers.filter(c => c.state === 'running');
    document.getElementById('stat-containers').textContent = `${running.length}/${orbitronContainers.length}`;
    renderContainerGrid(orbitronContainers);
  }
}

function renderContainerGrid(containers) {
  const grid = document.getElementById('container-grid');
  if (!containers || containers.length === 0) {
    grid.innerHTML = '<div class="empty-state">Orbitron 컨테이너가 없습니다.</div>';
    return;
  }
  grid.innerHTML = containers.map(c => {
    const name = c.name.replace('orbitron-', '');
    return `<div class="container-card">
      <div class="head">
        <span class="name">${name}</span>
        <span class="badge ${c.state}">${c.state === 'running' ? '✅ 실행 중' : '🔴 ' + c.state}</span>
      </div>
      <div class="meta">
        <span>이미지: ${c.image}</span>
        <span>포트: ${c.ports || '없음'}</span>
        <span>상태: ${c.status}</span>
      </div>
    </div>`;
  }).join('');
}

// ==================== Containers Page ====================
async function loadContainers() {
  const data = await apiFetch('/api/metrics');
  if (!data?.containers) return;
  const wrap = document.getElementById('all-containers');
  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>상태</th><th>이름</th><th>이미지</th><th>상태 정보</th><th>포트</th>
  </tr></thead><tbody>${data.containers.map(c => `<tr>
    <td><span class="badge ${c.state}">${c.state}</span></td>
    <td style="font-weight:600;color:var(--text-primary)">${c.name}</td>
    <td>${c.image}</td><td>${c.status}</td><td>${c.ports || '-'}</td>
  </tr>`).join('')}</tbody></table>`;
}

// ==================== Projects Page ====================
async function loadProjects() {
  const data = await apiFetch('/api/orbitron/projects');
  const grid = document.getElementById('project-grid');
  if (!data || !Array.isArray(data) || data.length === 0) {
    grid.innerHTML = '<div class="empty-state">Orbitron에 등록된 프로젝트가 없거나 연결할 수 없습니다.</div>';
    return;
  }
  grid.innerHTML = data.map(p => `<div class="project-card">
    <div class="title">${p.status === 'running' ? '✅' : '🔴'} ${p.name}</div>
    <div class="info">
      <span>서브도메인: ${p.subdomain || '-'}</span>
      <span>상태: ${p.status}</span>
      ${p.tunnel_url ? `<span>🔗 <a href="${p.tunnel_url}" target="_blank" style="color:var(--cyan)">${p.tunnel_url}</a></span>` : ''}
    </div>
    <div class="actions">
      <button class="btn btn-primary" onclick="deployProject(${p.id}, '${p.name}')">🚀 배포</button>
      <button class="btn btn-outline" onclick="viewProjectLogs(${p.id}, '${p.subdomain}')">📋 로그</button>
    </div>
  </div>`).join('');
}

async function deployProject(id, name) {
  if (!confirm(`"${name}" 프로젝트를 배포하시겠습니까?`)) return;
  showToast(`🚀 ${name} 배포 시작...`, 'info');
  const data = await apiPost(`/api/orbitron/projects/${id}/deploy`);
  if (data?.error) showToast(`❌ 배포 실패: ${data.error}`, 'error');
  else showToast(`✅ ${name} 배포가 시작되었습니다!`, 'success');
}

async function viewProjectLogs(id, subdomain) {
  try {
    const res = await apiFetch(`/api/orbitron/projects/${id}/logs?subdomain=${subdomain}`);
    if (res?.logs) alert(res.logs.substring(0, 3000));
    else alert('로그를 가져올 수 없습니다.');
  } catch { alert('로그 조회 실패'); }
}

// ==================== Tasks Page ====================
async function loadTasks() {
  const data = await apiFetch('/api/tasks');
  const list = document.getElementById('all-tasks');
  if (!data || !Array.isArray(data) || data.length === 0) {
    list.innerHTML = '<div class="empty-state">작업 이력이 없습니다.</div>';
    return;
  }
  list.innerHTML = data.map(t => {
    const icon = t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'running' ? '🔄' : '⏳';
    const time = new Date(t.created_at).toLocaleString('ko-KR');
    return `<div class="task-item">
      <span class="status-icon">${icon}</span>
      <div class="task-info">
        <div class="task-cmd">${t.command_raw}</div>
        <div class="task-meta">${time} · ${t.intent || t.status} · #${t.id}</div>
      </div>
    </div>`;
  }).join('');
}

// ==================== User Manual Page ====================
async function loadManual() {
  const container = document.getElementById('manual-content');
  const data = await apiFetch('/api/manual');
  if (data?.html) {
    container.innerHTML = data.html;
  } else {
    container.innerHTML = '<div class="empty-state">사용 매뉴얼을 불러올 수 없습니다.</div>';
  }
}

// ==================== Plan Page (Admin Only) ====================
async function loadPlan() {
  const container = document.getElementById('plan-content');
  const data = await apiFetch('/api/plan');
  if (data?.html) {
    container.innerHTML = data.html;
  } else {
    container.innerHTML = '<div class="empty-state">구축계획서를 불러올 수 없습니다. (최상위 관리자 전용)</div>';
  }
}

// ==================== Telegram Status ====================
async function loadTelegramStatus() {
  const data = await apiFetch('/api/telegram/status');
  if (data) {
    const tokenEl = document.getElementById('bot-token-status');
    const adminEl = document.getElementById('admin-id-status');
    tokenEl.textContent = data.botConfigured ? '✅ 설정됨' : '❌ 미설정';
    tokenEl.className = `status-badge ${data.botConfigured ? 'configured' : 'missing'}`;
    adminEl.textContent = data.adminConfigured ? '✅ 설정됨' : '❌ 미설정';
    adminEl.className = `status-badge ${data.adminConfigured ? 'configured' : 'missing'}`;
  }
}

// ==================== Admin: Overview ====================
async function loadAdminOverview() {
  const data = await apiFetch('/api/admin/stats');
  if (!data) return;

  document.getElementById('admin-total-users').textContent = data.users.total;
  document.getElementById('admin-active-users').textContent = data.users.activeThisWeek;
  document.getElementById('admin-total-tasks').textContent = data.tasks.total;
  document.getElementById('admin-logins-today').textContent = data.users.loginsToday;

  if (data.system) {
    document.getElementById('admin-cpu').textContent = `${data.system.cpu.usage}%`;
    document.getElementById('admin-mem').textContent = `${data.system.memory.usagePercent}%`;
    document.getElementById('admin-disk').textContent = `${data.system.disk.usagePercent}%`;
    document.getElementById('admin-cpu-bar').style.width = `${data.system.cpu.usage}%`;
    document.getElementById('admin-mem-bar').style.width = `${data.system.memory.usagePercent}%`;
    document.getElementById('admin-disk-bar').style.width = `${data.system.disk.usagePercent}%`;
  }

  if (data.containers) {
    const running = data.containers.filter(c => c.state === 'running').length;
    document.getElementById('admin-containers').textContent = `${running}/${data.containers.length}`;
  }

  // Load recent users
  const usersData = await apiFetch('/api/admin/users?limit=5');
  if (usersData?.users) {
    document.getElementById('admin-recent-users').innerHTML = `<table class="data-table"><thead><tr>
      <th>사용자</th><th>이메일</th><th>역할</th><th>상태</th><th>가입일</th>
    </tr></thead><tbody>${usersData.users.map(u => `<tr>
      <td style="font-weight:600;color:var(--text-primary)">${u.username}</td>
      <td>${u.email}</td>
      <td><span class="role-badge ${u.role}">${roleLabel(u.role)}</span></td>
      <td>${u.is_active ? '<span style="color:var(--success)">활성</span>' : '<span style="color:var(--danger)">비활성</span>'}</td>
      <td>${formatDate(u.created_at)}</td>
    </tr>`).join('')}</tbody></table>`;
  }
}

// ==================== Admin: Users ====================
let adminUsersPage = 1;

async function loadAdminUsers(page = 1) {
  adminUsersPage = page;
  const search = document.getElementById('admin-user-search')?.value || '';
  const role = document.getElementById('admin-user-role-filter')?.value || '';
  const data = await apiFetch(`/api/admin/users?page=${page}&limit=15&search=${encodeURIComponent(search)}&role=${role}`);
  if (!data) return;

  const wrap = document.getElementById('admin-users-table');
  if (!data.users || data.users.length === 0) {
    wrap.innerHTML = '<div class="empty-state">사용자가 없습니다.</div>';
    document.getElementById('admin-users-pagination').innerHTML = '';
    return;
  }

  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>ID</th><th>사용자</th><th>이메일</th><th>역할</th><th>상태</th><th>로그인 수</th><th>마지막 로그인</th><th>가입일</th><th>관리</th>
  </tr></thead><tbody>${data.users.map(u => `<tr>
    <td>#${u.id}</td>
    <td style="font-weight:600;color:var(--text-primary)">${u.username}</td>
    <td>${u.email}</td>
    <td><span class="role-badge ${u.role}">${roleLabel(u.role)}</span></td>
    <td>${u.is_active ? '<span style="color:var(--success)">✅</span>' : '<span style="color:var(--danger)">🚫</span>'}</td>
    <td style="text-align:center">${u.login_count || 0}</td>
    <td>${u.last_login_at ? formatDate(u.last_login_at) : '없음'}</td>
    <td>${formatDate(u.created_at)}</td>
    <td>
      <button class="action-btn" onclick="openUserEdit(${u.id}, '${u.username}', '${u.role}', ${u.is_active})">✏️</button>
      ${u.id !== currentUser.id ? `<button class="action-btn danger" onclick="resetUserPassword(${u.id}, '${u.username}')">🔑</button>` : ''}
    </td>
  </tr>`).join('')}</tbody></table>`;

  // Pagination
  renderPagination('admin-users-pagination', data.page, data.totalPages, (p) => loadAdminUsers(p));
}

// ==================== Admin: Audit Log ====================
let adminAuditPage = 1;

async function loadAdminAudit(page = 1) {
  adminAuditPage = page;
  const data = await apiFetch(`/api/admin/audit?page=${page}&limit=30`);
  if (!data) return;

  const wrap = document.getElementById('admin-audit-table');
  if (!data.logs || data.logs.length === 0) {
    wrap.innerHTML = '<div class="empty-state">활동 로그가 없습니다.</div>';
    return;
  }

  const actionLabels = {
    login: '🔑 로그인',
    register: '📝 가입',
    deploy: '🚀 배포',
    admin_update_user: '✏️ 사용자 수정',
    admin_deactivate_user: '🚫 사용자 비활성화',
    admin_reset_password: '🔑 비밀번호 초기화',
  };

  wrap.innerHTML = `<table class="data-table"><thead><tr>
    <th>시간</th><th>사용자</th><th>행동</th><th>상세</th><th>IP</th>
  </tr></thead><tbody>${data.logs.map(l => `<tr>
    <td>${formatDateTime(l.created_at)}</td>
    <td style="font-weight:600;color:var(--text-primary)">${l.username || '—'}</td>
    <td>${actionLabels[l.action] || l.action}</td>
    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--text-muted);">${l.details ? JSON.stringify(l.details) : '—'}</td>
    <td style="font-size:12px;">${l.ip_address || '—'}</td>
  </tr>`).join('')}</tbody></table>`;

  renderPagination('admin-audit-pagination', data.page, data.totalPages, (p) => loadAdminAudit(p));
}

// ==================== User Edit Modal ====================
function openUserEdit(id, username, role, isActive) {
  editingUserId = id;
  document.getElementById('modal-user-title').textContent = `사용자 편집: ${username}`;
  document.getElementById('modal-user-role').value = role;
  document.getElementById('modal-user-active').value = String(isActive);
  document.getElementById('user-edit-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('user-edit-modal').style.display = 'none';
  editingUserId = null;
}

async function saveUserEdit() {
  if (!editingUserId) return;
  const role = document.getElementById('modal-user-role').value;
  const isActive = document.getElementById('modal-user-active').value === 'true';

  const result = await apiPut(`/api/admin/users/${editingUserId}`, { role, is_active: isActive });
  if (result?.error) {
    showToast(`❌ ${result.error}`, 'error');
  } else {
    showToast('✅ 사용자 정보가 업데이트되었습니다.', 'success');
    closeModal();
    loadAdminUsers(adminUsersPage);
  }
}

async function resetUserPassword(id, username) {
  const newPw = prompt(`"${username}" 의 새 비밀번호를 입력하세요 (6자 이상):`);
  if (!newPw || newPw.length < 6) {
    if (newPw !== null) showToast('❌ 비밀번호는 6자 이상이어야 합니다.', 'error');
    return;
  }
  const result = await apiPost(`/api/admin/users/${id}/reset-password`, { newPassword: newPw });
  if (result?.error) showToast(`❌ ${result.error}`, 'error');
  else showToast('✅ 비밀번호가 재설정되었습니다.', 'success');
}

// ==================== Helpers ====================
function roleLabel(role) {
  const labels = { superadmin: '🛡 최상위 관리자', admin: '⚙ 관리자', user: '👤 사용자' };
  return labels[role] || role;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function renderPagination(containerId, currentPage, totalPages, callback) {
  const container = document.getElementById(containerId);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  if (currentPage > 1) html += `<button onclick="(${callback.toString()})(${currentPage - 1})">‹ 이전</button>`;
  html += `<span class="page-info">${currentPage} / ${totalPages}</span>`;
  if (currentPage < totalPages) html += `<button onclick="(${callback.toString()})(${currentPage + 1})">다음 ›</button>`;
  container.innerHTML = html;
}

// ==================== Toast ====================
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==================== Clock ====================
function updateClock() {
  document.getElementById('topbar-time').textContent = new Date().toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  initUserUI();
  updateClock();
  setInterval(updateClock, 1000);
  loadDashboard();

  metricsInterval = setInterval(() => {
    if (currentPage === 'dashboard') loadDashboard();
  }, 30000);

  // Admin search listeners
  const searchInput = document.getElementById('admin-user-search');
  const roleFilter = document.getElementById('admin-user-role-filter');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => loadAdminUsers(1), 400);
    });
  }
  if (roleFilter) {
    roleFilter.addEventListener('change', () => loadAdminUsers(1));
  }
});
