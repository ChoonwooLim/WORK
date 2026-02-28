// RemoteAGT Dashboard — Frontend JS
const API_BASE = '';

// State
let currentPage = 'dashboard';
let metricsInterval = null;

// ==================== Navigation ====================
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navEl = document.getElementById(`nav-${page}`);
    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    currentPage = page;

    // Update topbar title
    const titles = {
        dashboard: '📊 대시보드',
        containers: '🐳 컨테이너',
        projects: '📦 프로젝트',
        tasks: '📋 작업 이력',
        plan: '📖 구축계획서',
        telegram: '💬 텔레그램 연동',
    };
    document.getElementById('topbar-title').textContent = titles[page] || page;

    // Load page-specific data
    if (page === 'dashboard') loadDashboard();
    else if (page === 'containers') loadContainers();
    else if (page === 'projects') loadProjects();
    else if (page === 'tasks') loadTasks();
    else if (page === 'plan') loadPlan();
    else if (page === 'telegram') loadTelegramStatus();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ==================== API Calls ====================
async function apiFetch(url) {
    try {
        const res = await fetch(`${API_BASE}${url}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    } catch (err) {
        console.error(`API Error: ${url}`, err);
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

        // Color warning
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
        return `
      <div class="container-card">
        <div class="head">
          <span class="name">${name}</span>
          <span class="badge ${c.state}">${c.state === 'running' ? '✅ 실행 중' : '🔴 ' + c.state}</span>
        </div>
        <div class="meta">
          <span>이미지: ${c.image}</span>
          <span>포트: ${c.ports || '없음'}</span>
          <span>상태: ${c.status}</span>
        </div>
      </div>
    `;
    }).join('');
}

// ==================== Containers Page ====================
async function loadContainers() {
    const data = await apiFetch('/api/metrics');
    if (!data?.containers) return;

    const wrap = document.getElementById('all-containers');
    wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>상태</th>
          <th>이름</th>
          <th>이미지</th>
          <th>상태 정보</th>
          <th>포트</th>
        </tr>
      </thead>
      <tbody>
        ${data.containers.map(c => `
          <tr>
            <td><span class="badge ${c.state}">${c.state}</span></td>
            <td style="font-weight:600; color:var(--text-primary)">${c.name}</td>
            <td>${c.image}</td>
            <td>${c.status}</td>
            <td>${c.ports || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ==================== Projects Page ====================
async function loadProjects() {
    const data = await apiFetch('/api/orbitron/projects');
    const grid = document.getElementById('project-grid');

    if (!data || !Array.isArray(data) || data.length === 0) {
        grid.innerHTML = '<div class="empty-state">Orbitron에 등록된 프로젝트가 없거나 연결할 수 없습니다.</div>';
        return;
    }

    grid.innerHTML = data.map(p => `
    <div class="project-card">
      <div class="title">
        ${p.status === 'running' ? '✅' : '🔴'} ${p.name}
      </div>
      <div class="info">
        <span>서브도메인: ${p.subdomain || '-'}</span>
        <span>상태: ${p.status}</span>
        ${p.tunnel_url ? `<span>🔗 <a href="${p.tunnel_url}" target="_blank" style="color:var(--cyan)">${p.tunnel_url}</a></span>` : ''}
        ${p.github_url ? `<span>📂 ${p.github_url}</span>` : ''}
      </div>
      <div class="actions">
        <button class="btn btn-primary" onclick="deployProject(${p.id}, '${p.name}')">🚀 배포</button>
        <button class="btn btn-outline" onclick="viewProjectLogs(${p.id}, '${p.subdomain}')">📋 로그</button>
      </div>
    </div>
  `).join('');
}

async function deployProject(id, name) {
    if (!confirm(`"${name}" 프로젝트를 배포하시겠습니까?`)) return;
    showToast(`🚀 ${name} 배포 시작...`, 'info');
    const res = await fetch(`/api/orbitron/projects/${id}/deploy`, { method: 'POST' });
    const data = await res.json();
    if (data.error) {
        showToast(`❌ 배포 실패: ${data.error}`, 'error');
    } else {
        showToast(`✅ ${name} 배포가 시작되었습니다!`, 'success');
    }
}

async function viewProjectLogs(id, subdomain) {
    try {
        const res = await apiFetch(`/api/orbitron/projects/${id}/logs?subdomain=${subdomain}`);
        if (res?.logs) {
            alert(res.logs.substring(0, 3000));
        } else {
            alert('로그를 가져올 수 없습니다.');
        }
    } catch {
        alert('로그 조회 실패');
    }
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
        return `
      <div class="task-item">
        <span class="status-icon">${icon}</span>
        <div class="task-info">
          <div class="task-cmd">${t.command_raw}</div>
          <div class="task-meta">${time} · ${t.intent || t.status} · #${t.id}</div>
        </div>
      </div>
    `;
    }).join('');
}

// ==================== Plan Page ====================
async function loadPlan() {
    const container = document.getElementById('plan-content');

    try {
        const res = await fetch('/api/plan');
        const data = await res.json();

        if (data.html) {
            container.innerHTML = data.html;
        } else {
            container.innerHTML = '<div class="empty-state">구축계획서를 불러올 수 없습니다.</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="empty-state">구축계획서 로딩 실패</div>';
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
    const now = new Date();
    document.getElementById('topbar-time').textContent = now.toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);

    loadDashboard();

    // Auto-refresh metrics every 30s
    metricsInterval = setInterval(() => {
        if (currentPage === 'dashboard') loadDashboard();
    }, 30000);
});
