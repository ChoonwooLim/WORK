// src/notifications/formatter.js
// Formats messages for different SNS platforms
import collector from '../monitor/collector.js';

function progressBar(percent, length = 10) {
    const filled = Math.round((percent / 100) * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + units[i];
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}일 ${h}시간`;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

// Format system status for Telegram (markdown)
export function formatStatus(metrics) {
    if (!metrics?.system) {
        return '❌ 시스템 메트릭을 수집할 수 없습니다.';
    }

    const { system, containers } = metrics;
    const runningContainers = containers?.filter(c => c.state === 'running') || [];
    const orbitronContainers = containers?.filter(c => c.isOrbitron) || [];
    const runningOrbitron = orbitronContainers.filter(c => c.state === 'running');

    let msg = `╔══════════════════════════════╗\n`;
    msg += `║  🪐 시스템 상태 리포트         ║\n`;
    msg += `╠══════════════════════════════╣\n\n`;

    // System
    msg += `🖥️ *서버*\n`;
    msg += `CPU: ${progressBar(system.cpu.usage)} ${system.cpu.usage}%\n`;
    msg += `RAM: ${progressBar(system.memory.usagePercent)} ${system.memory.usagePercent}% (${system.memory.usedGB}/${system.memory.totalGB}GB)\n`;
    msg += `DISK: ${progressBar(system.disk.usagePercent)} ${system.disk.usagePercent}% (${system.disk.usedGB}/${system.disk.totalGB}GB)\n\n`;

    // Containers
    msg += `🐳 *컨테이너* (${runningOrbitron.length}/${orbitronContainers.length} 실행 중)\n`;
    for (const c of orbitronContainers) {
        const icon = c.state === 'running' ? '✅' : '🔴';
        const name = c.name.replace('orbitron-', '');
        msg += `${icon} ${name} — ${c.state === 'running' ? '정상' : c.state}\n`;
    }

    if (orbitronContainers.length === 0) {
        msg += `ℹ️ Orbitron 컨테이너 없음\n`;
    }

    msg += `\n╚══════════════════════════════╝`;

    return msg;
}

// Format container list
export function formatContainerList(containers) {
    if (!containers || containers.length === 0) {
        return '📭 실행 중인 컨테이너가 없습니다.';
    }

    let msg = '🐳 *전체 컨테이너 목록*\n━━━━━━━━━━━━━━━━━━━━\n\n';
    for (const c of containers) {
        const icon = c.state === 'running' ? '✅' : c.state === 'exited' ? '🔴' : '🟡';
        msg += `${icon} *${c.name}*\n`;
        msg += `   이미지: ${c.image}\n`;
        msg += `   상태: ${c.status}\n`;
        msg += `   포트: ${c.ports || '없음'}\n\n`;
    }
    return msg;
}

// Format task result
export function formatTaskResult(task) {
    const statusIcon = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '🔄';
    let msg = `${statusIcon} *작업 #${task.id} ${task.status === 'completed' ? '완료' : task.status === 'failed' ? '실패' : '진행중'}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 명령: ${task.command_raw}\n`;
    msg += `⏰ 시작: ${task.started_at || '-'}\n`;

    if (task.completed_at) {
        msg += `⏱ 완료: ${task.completed_at}\n`;
    }
    if (task.error_message) {
        msg += `❌ 에러: ${task.error_message}\n`;
    }
    if (task.result) {
        msg += `📄 결과: ${typeof task.result === 'string' ? task.result : JSON.stringify(task.result)}\n`;
    }

    return msg;
}

// Format help message
export function formatHelp() {
    return `🪐 *RemoteAGT 명령어*
━━━━━━━━━━━━━━━━━━━━

📊 *모니터링*
/status — 시스템 상태 전체 리포트
/containers — 전체 컨테이너 목록
/disk — 디스크 사용량 상세

🚀 *배포*
/projects — Orbitron 프로젝트 목록
/deploy <프로젝트> — 프로젝트 배포
/logs <프로젝트> — 컨테이너 로그

📋 *작업*
/tasks — 진행 중인 작업 목록
/task <설명> — 새 작업 지시

📖 *정보*
/plan — 프로젝트 구축계획서 보기
/help — 이 도움말

⚙️ *시스템*
/uptime — 서버 가동 시간`;
}

// Format project list
export function formatProjectList(projects) {
    if (!projects || projects.length === 0) {
        return '📭 등록된 프로젝트가 없습니다.';
    }

    let msg = '📦 *Orbitron 프로젝트 목록*\n━━━━━━━━━━━━━━━━━━━━\n\n';
    for (const p of projects) {
        const icon = p.status === 'running' ? '✅' : p.status === 'stopped' ? '🔴' : '🟡';
        msg += `${icon} *${p.name}*\n`;
        msg += `   서브도메인: ${p.subdomain || '-'}\n`;
        msg += `   상태: ${p.status}\n`;
        if (p.tunnel_url) {
            msg += `   🔗 ${p.tunnel_url}\n`;
        }
        msg += `\n`;
    }
    return msg;
}

// Format disk info
export function formatDiskInfo(system) {
    if (!system) return '❌ 디스크 정보를 가져올 수 없습니다.';

    let msg = `💾 *디스크 사용량*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `${progressBar(system.disk.usagePercent, 20)} ${system.disk.usagePercent}%\n\n`;
    msg += `전체: ${system.disk.totalGB} GB\n`;
    msg += `사용: ${system.disk.usedGB} GB\n`;
    msg += `여유: ${((system.disk.total - system.disk.used) / 1073741824).toFixed(1)} GB\n`;

    return msg;
}

export default {
    formatStatus,
    formatContainerList,
    formatTaskResult,
    formatHelp,
    formatProjectList,
    formatDiskInfo,
};
