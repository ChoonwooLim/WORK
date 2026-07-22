const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/db');
const deployer = require('../services/deployer');
const { isForkPr, routePrAction } = require('../services/previewRules');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'orbitron-secret';

// ── Task 3.1: pull_request 이벤트 → PR 프리뷰 배포/파괴 ─────────────────────
// opened/synchronize/reopened → deployPreview, closed → destroyPreview.
// preview_deploys 옵트인 프로젝트만 대상. fork PR 은 배포 스킵 (보안: fork
// 코드가 프로젝트 env 와 함께 호스트에서 실행됨 — v1 은 same-repo 브랜치만).
async function handlePullRequest(payload, res) {
    const action = payload.action;
    const route = routePrAction(action);
    if (route === 'ignore') {
        return res.json({ message: `Ignored PR action: ${action}` });
    }

    const pr = payload.pull_request;
    const prNumber = pr?.number;
    const baseRepo = pr?.base?.repo?.full_name || payload.repository?.full_name;
    if (!prNumber || !baseRepo) {
        return res.status(400).json({ error: 'Missing pull_request number or base repository' });
    }

    const projects = await db.queryAll(
        `SELECT * FROM projects WHERE github_url LIKE $1 AND preview_deploys = true`,
        [`%${baseRepo}%`]
    );
    if (projects.length === 0) {
        return res.json({ message: 'No preview-enabled projects for this repository' });
    }

    // fork PR: 배포는 스킵 (destroy 는 멱등 no-op 이므로 fork 여부 무관 실행)
    if (route === 'deploy' && isForkPr(payload)) {
        console.log(`⏭️ Skipping fork PR #${prNumber} preview for ${baseRepo} (head: ${pr?.head?.repo?.full_name || 'unknown'}) — same-repo branches only`);
        return res.json({ message: `Fork PR skipped (security: same-repo branches only)`, pr: prNumber });
    }

    const results = [];
    for (const project of projects) {
        if (route === 'deploy') {
            console.log(`🔍 Preview deploy trigger: ${project.name} PR #${prNumber} (${pr.head?.ref} @ ${pr.head?.sha?.substring(0, 7)})`);
            deployer.deployPreview(project, prNumber, pr.head?.ref, pr.head?.sha).catch(err => {
                console.error(`Preview deploy error for ${project.name} PR #${prNumber}:`, err);
            });
            results.push({ project: project.name, pr: prNumber, status: 'deploying' });
        } else {
            deployer.destroyPreview(project, prNumber).catch(err => {
                console.error(`Preview destroy error for ${project.name} PR #${prNumber}:`, err);
            });
            results.push({ project: project.name, pr: prNumber, status: 'destroying' });
        }
    }
    return res.json({ message: 'Preview actions triggered', results });
}

// POST /api/webhooks/github - Receive GitHub webhook
router.post('/github', async (req, res) => {
    try {
        const event = req.headers['x-github-event'];
        const signature = req.headers['x-hub-signature-256'];

        // Verify signature if secret is set (applies to ALL events — push and pull_request)
        if (WEBHOOK_SECRET && signature) {
            if (!req.rawBody) return res.status(400).json({ error: 'Raw body required for signature verification' });
            const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
            const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
            if (signature !== digest) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        // Only handle push + pull_request events
        if (event !== 'push' && event !== 'pull_request') {
            return res.json({ message: `Ignored event: ${event}` });
        }

        let payload = req.body;
        // GitHub sends URL-encoded webhooks as a 'payload' field containing a JSON string
        if (payload && payload.payload) {
            try {
                payload = JSON.parse(payload.payload);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid JSON in URL-encoded payload' });
            }
        }

        if (event === 'pull_request') {
            return await handlePullRequest(payload, res);
        }

        const repoUrl = payload.repository?.html_url || payload.repository?.clone_url;
        const branch = payload.ref?.replace('refs/heads/', '');
        const commitHash = payload.after;
        const commitMessage = payload.head_commit?.message || '';

        if (!repoUrl) {
            return res.status(400).json({ error: 'No repository URL in payload' });
        }

        // Find matching projects
        const projects = await db.queryAll(
            `SELECT * FROM projects WHERE github_url LIKE $1 AND branch = $2`,
            [`%${payload.repository.full_name}%`, branch]
        );

        if (projects.length === 0) {
            return res.json({ message: 'No matching projects found' });
        }

        // Deploy each matching project (if auto_deploy is enabled)
        const results = [];
        for (const project of projects) {
            if (project.auto_deploy === false) {
                console.log(`⏭️ Skipping auto-deploy for ${project.name} (auto_deploy disabled)`);
                results.push({ project: project.name, status: 'skipped' });
                continue;
            }
            console.log(`🚀 Auto-deploying: ${project.name} (commit: ${commitHash?.substring(0, 7)})`);
            deployer.deploy(project, commitHash, commitMessage).catch(err => {
                console.error(`Deploy error for ${project.name}:`, err);
            });
            results.push({ project: project.name, status: 'deploying' });
        }

        res.json({ message: 'Deployments triggered', results });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
