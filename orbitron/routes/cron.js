'use strict';

// 예약 작업(cron) CRUD + 수동 트리거 (Task 3.3)
//
// /api/projects 에 마운트되는 별도 라우터 (domains.js / source.js 와 같은
// 패턴 — projects.js 가 이미 1200줄이라 분리). 모든 라우트는 프로젝트
// 소유권(getProjectForUser)으로 보호되며, 미소유/미존재는 동일한 404 로
// 응답한다 (존재 노출 방지 — deployments.js 관례).

const express = require('express');
const router = express.Router();
const db = require('../db/db');
const cronRules = require('../services/cronRules');

// Helper: Get project with admin bypass (routes/projects.js·domains.js 와 동일 패턴)
async function getProjectForUser(projectId, user) {
    if (user.role === 'admin' || user.role === 'superadmin') {
        return db.queryOne('SELECT * FROM projects WHERE id = $1', [projectId]);
    }
    return db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, user.userId]);
}

const JOB_NOT_FOUND = '예약 작업을 찾을 수 없습니다. / Scheduled job not found.';

function isIntId(raw) {
    return /^\d+$/.test(String(raw));
}

// 응답용 정규화 — 목록/단건 공통. next_run_at 은 cronRules.nextRunAfter 로
// 서버에서 계산해 실어 보낸다 (대시보드 "다음 실행" 표시용).
function toJobResponse(job) {
    const parsed = cronRules.parseCronExpression(job.schedule);
    const next = parsed ? cronRules.nextRunAfter(parsed, new Date()) : null;
    return {
        id: job.id,
        project_id: job.project_id,
        name: job.name,
        schedule: job.schedule,
        command: job.command,
        enabled: job.enabled,
        last_run_at: job.last_run_at,
        last_status: job.last_status,
        last_output: job.last_output,
        created_at: job.created_at,
        updated_at: job.updated_at,
        next_run_at: next ? next.toISOString() : null,
    };
}

// GET /api/projects/:id/cron - 프로젝트의 예약 작업 목록
router.get('/:id/cron', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const jobs = await db.queryAll(
            'SELECT * FROM scheduled_jobs WHERE project_id = $1 ORDER BY name',
            [project.id]
        );
        res.json({ jobs: jobs.map(toJobResponse) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/cron - 예약 작업 생성 (프로젝트당 최대 10개)
router.post('/:id/cron', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { name, schedule, command } = req.body || {};
        const valid = cronRules.validateJobInput({ name, schedule, command });
        if (!valid.ok) return res.status(400).json({ error: valid.error });

        const countRow = await db.queryOne(
            'SELECT COUNT(*)::int AS count FROM scheduled_jobs WHERE project_id = $1',
            [project.id]
        );
        if (countRow && countRow.count >= cronRules.MAX_JOBS_PER_PROJECT) {
            return res.status(400).json({
                error: `프로젝트당 예약 작업은 최대 ${cronRules.MAX_JOBS_PER_PROJECT}개입니다. / Max ${cronRules.MAX_JOBS_PER_PROJECT} jobs per project.`,
            });
        }

        const enabled = req.body.enabled === undefined ? true : Boolean(req.body.enabled);
        try {
            const job = await db.queryOne(
                'INSERT INTO scheduled_jobs (project_id, name, schedule, command, enabled) ' +
                'VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [project.id, name, schedule, command, enabled]
            );
            res.status(201).json(toJobResponse(job));
        } catch (e) {
            if (e && e.code === '23505') { // UNIQUE(project_id, name)
                return res.status(409).json({ error: `같은 이름의 작업이 이미 있습니다: ${name} / A job with this name already exists.` });
            }
            throw e;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/projects/:id/cron/:jobId - 부분 수정 (name/schedule/command/enabled)
router.put('/:id/cron/:jobId', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!isIntId(req.params.jobId)) return res.status(404).json({ error: JOB_NOT_FOUND });

        const job = await db.queryOne(
            'SELECT * FROM scheduled_jobs WHERE id = $1 AND project_id = $2',
            [req.params.jobId, project.id]
        );
        if (!job) return res.status(404).json({ error: JOB_NOT_FOUND });

        const body = req.body || {};
        const merged = {
            name: body.name !== undefined ? body.name : job.name,
            schedule: body.schedule !== undefined ? body.schedule : job.schedule,
            command: body.command !== undefined ? body.command : job.command,
        };
        const valid = cronRules.validateJobInput(merged);
        if (!valid.ok) return res.status(400).json({ error: valid.error });
        const enabled = body.enabled !== undefined ? Boolean(body.enabled) : job.enabled;

        try {
            const updated = await db.queryOne(
                'UPDATE scheduled_jobs SET name = $1, schedule = $2, command = $3, enabled = $4, ' +
                'updated_at = NOW() WHERE id = $5 AND project_id = $6 RETURNING *',
                [merged.name, merged.schedule, merged.command, enabled, job.id, project.id]
            );
            res.json(toJobResponse(updated));
        } catch (e) {
            if (e && e.code === '23505') {
                return res.status(409).json({ error: `같은 이름의 작업이 이미 있습니다: ${merged.name} / A job with this name already exists.` });
            }
            throw e;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/projects/:id/cron/:jobId - 예약 작업 삭제
router.delete('/:id/cron/:jobId', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!isIntId(req.params.jobId)) return res.status(404).json({ error: JOB_NOT_FOUND });

        const deleted = await db.queryOne(
            'DELETE FROM scheduled_jobs WHERE id = $1 AND project_id = $2 RETURNING id',
            [req.params.jobId, project.id]
        );
        if (!deleted) return res.status(404).json({ error: JOB_NOT_FOUND });
        res.json({ message: 'Deleted', id: deleted.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/cron/:jobId/run - 수동 트리거 (동기 실행, 60s 타임아웃)
// CronRunner 의 겹침 가드를 공유 — 같은 작업이 이미 실행 중이면 409.
router.post('/:id/cron/:jobId/run', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!isIntId(req.params.jobId)) return res.status(404).json({ error: JOB_NOT_FOUND });

        const job = await db.queryOne(
            'SELECT * FROM scheduled_jobs WHERE id = $1 AND project_id = $2',
            [req.params.jobId, project.id]
        );
        if (!job) return res.status(404).json({ error: JOB_NOT_FOUND });

        if (project.status !== 'running' || !project.container_id) {
            return res.status(409).json({
                error: '프로젝트가 실행 중이 아니거나 컨테이너가 없습니다. / Project is not running (no container).',
            });
        }

        const cron = require('../services/cron');
        const result = await cron.runNow({
            ...job,
            container_id: project.container_id,
            subdomain: project.subdomain,
            project_name: project.name,
        });
        if (result.status === 'running') {
            return res.status(409).json({ error: '이 작업의 이전 실행이 아직 진행 중입니다. / A previous run of this job is still in progress.' });
        }
        res.json({ status: result.status, output: result.output });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
