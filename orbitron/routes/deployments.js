const express = require('express');
const router = express.Router();
const db = require('../db/db');
const dockerService = require('../services/docker');
const deployer = require('../services/deployer');
const nginxService = require('../services/nginx');

// Helper: Get project with admin bypass (routes/projects.js·domains.js 와 동일 패턴)
async function getProjectForUser(projectId, user) {
    if (user.role === 'admin' || user.role === 'superadmin') {
        return db.queryOne('SELECT * FROM projects WHERE id = $1', [projectId]);
    }
    return db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, user.userId]);
}

// GET /api/deployments/:projectId - Get deployments for a project
router.get('/:projectId', async (req, res) => {
    try {
        const deployments = await db.queryAll(
            'SELECT id, project_id, commit_hash, commit_message, status, image_tag, started_at, finished_at, LENGTH(logs) as log_size FROM deployments WHERE project_id = $1 ORDER BY started_at DESC LIMIT 20',
            [req.params.projectId]
        );
        res.json(deployments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/deployments/:id/rollback - 원클릭 이미지 롤백 (Task 2.1)
// 202: 롤백 배포 시작 (deployment_id = 새 배포 행)
// 400: 롤백 불가 (image_tag 없음 / 성공 배포 아님 / 이미지 이미 정리됨 — code 로 구분)
// 404: 배포 없음 또는 소유자 아님 (존재 노출 방지 위해 동일 응답)
// 409: nginx conf 수동 관리 프로젝트, 또는 배포/롤백 이미 진행 중
router.post('/:id/rollback', async (req, res) => {
    try {
        const deployment = await db.queryOne('SELECT * FROM deployments WHERE id = $1', [req.params.id]);
        if (!deployment) {
            return res.status(404).json({ error: '배포 기록을 찾을 수 없습니다. / Deployment not found.' });
        }

        const project = await getProjectForUser(deployment.project_id, req.user);
        if (!project) {
            return res.status(404).json({ error: '배포 기록을 찾을 수 없습니다. / Deployment not found.' });
        }

        // 수동 관리 nginx conf — 되돌릴 수 없는 스왑 전에 라우트 초입에서 거부 (domains.js 패턴)
        if (nginxService.isProjectConfProtected(project.subdomain)) {
            return res.status(409).json({ error: new nginxService.ManualConfProtectedError(project.subdomain).message });
        }

        const result = await deployer.rollbackTo(project, deployment);
        if (!result.success) {
            const status = result.code === 'DEPLOY_IN_PROGRESS' ? 409 : 400;
            return res.status(status).json({ error: result.error, code: result.code });
        }

        // 검증 통과 — 배포는 백그라운드 진행 (일반 배포 엔드포인트와 동일하게 비동기)
        res.status(202).json({
            message: 'Rollback started',
            deployment_id: result.deploymentId,
            rollback_of: deployment.id,
            project_id: project.id,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/deployments/:projectId/log/:deploymentId - Get full deployment log
router.get('/:projectId/log/:deploymentId', async (req, res) => {
    try {
        const deployment = await db.queryOne(
            'SELECT id, project_id, commit_hash, commit_message, status, logs, started_at, finished_at FROM deployments WHERE id = $1 AND project_id = $2',
            [req.params.deploymentId, req.params.projectId]
        );
        if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
        res.json(deployment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/deployments/:projectId/logs - Get live container logs
router.get('/:projectId/logs', async (req, res) => {
    try {
        const project = await db.queryOne('SELECT * FROM projects WHERE id = $1', [req.params.projectId]);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const containerName = `orbitron-${project.subdomain}`;
        const logs = await dockerService.getContainerLogs(containerName, req.query.lines || 100);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
