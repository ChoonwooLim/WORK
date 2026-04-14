/**
 * /api/system/* — server-wide configuration endpoints that are NOT scoped to a project.
 * Mounted separately from /api/projects so they don't collide with `/:id` route patterns.
 */

const express = require('express');
const router = express.Router();
const publicIp = require('../services/publicIp');

// GET /api/system/public-ip  — anyone signed in can read (it's not secret; A records are public DNS)
router.get('/public-ip', async (_req, res) => {
    const current = await publicIp.get();
    res.json({
        current,
        diagnostics: publicIp.diagnostics(),
        howToFix: current ? null : [
            '1) .env 에 `PUBLIC_IP=<서버공인IP>` 추가 후 PM2 reload — 가장 영구적',
            '2) 또는 어드민 UI의 "수동 입력" 버튼으로 즉시 설정 (재시작까지 유효)',
            '3) 외부 IP 조회 API에 대한 아웃바운드 네트워크가 막혀있지 않은지 확인',
            '4) curl https://api.ipify.org 로 서버에서 직접 테스트',
        ],
    });
});

// POST /api/system/public-ip — admin sets manual override at runtime
router.post('/public-ip', async (req, res) => {
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');
    if (!isAdmin) return res.status(403).json({ error: '어드민 권한이 필요합니다.' });

    if (req.body && req.body.clear) {
        publicIp.clearManual();
        return res.json({ success: true, cleared: true, current: await publicIp.get() });
    }
    const ip = (req.body && req.body.ip || '').trim();
    try {
        publicIp.setManual(ip);
        res.json({ success: true, current: ip, message: `공인 IP를 ${ip}로 설정했습니다 (재시작까지 유효). 영구 적용은 .env의 PUBLIC_IP에 저장하세요.` });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/system/public-ip/refresh — force a fresh auto-detect
router.post('/public-ip/refresh', async (_req, res) => {
    const ip = await publicIp.autoDetect(true);
    res.json({ success: !!ip, current: ip, diagnostics: publicIp.diagnostics() });
});

module.exports = router;
