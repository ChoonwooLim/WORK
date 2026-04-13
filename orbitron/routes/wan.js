/**
 * Orbitron API routes that proxy to the remote Wan 2.2 video service.
 *
 * Mounted under /api/wan in server.js.
 *
 *   GET  /api/wan/status             — service status (GPU, loaded models)
 *   POST /api/wan/t2v                — JSON body, text-to-video
 *   POST /api/wan/i2v                — multipart/form-data, image-to-video
 *   GET  /api/wan/video/:filename    — stream MP4 (proxied, no direct LAN leak)
 */

const express = require('express');
const multer = require('multer');
const wan = require('../services/wanVideo');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/status', async (_req, res) => {
    try {
        const s = await wan.status();
        res.json({ ok: true, host: wan.WAN_VIDEO_HOST, ...s });
    } catch (e) {
        res.status(502).json({ ok: false, host: wan.WAN_VIDEO_HOST, error: e.message });
    }
});

router.get('/healthz', async (_req, res) => {
    const h = await wan.healthz();
    res.status(h.ok ? 200 : 502).json(h);
});

router.post('/t2v', async (req, res) => {
    try {
        const out = await wan.t2v(req.body || {});
        // Never leak the raw LAN URL — rewrite to go through /api/wan/video/:filename
        out.videoUrl = `/api/wan/video/${out.filename}`;
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/i2v', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'image file required (multipart field "image")' });
        const opts = {
            image: req.file,
            prompt: req.body.prompt || '',
            negative_prompt: req.body.negative_prompt || '',
            num_frames: Number(req.body.num_frames) || 33,
            num_inference_steps: Number(req.body.num_inference_steps) || 20,
            guidance_scale: Number(req.body.guidance_scale) || 5.0,
            fps: Number(req.body.fps) || 16,
            model: req.body.model || 'i2v-14b',
            seed: req.body.seed,
        };
        const out = await wan.i2v(opts);
        out.videoUrl = `/api/wan/video/${out.filename}`;
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/video/:filename', async (req, res) => {
    try {
        const { stream, headers } = await wan.fetchVideo(req.params.filename);
        res.set('Content-Type', headers.get('content-type') || 'video/mp4');
        const cl = headers.get('content-length');
        if (cl) res.set('Content-Length', cl);
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
        res.end();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
