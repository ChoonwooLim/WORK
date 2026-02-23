const express = require('express');
const router = express.Router();
const pixelStreamingService = require('../services/pixelStreaming');

// Matchmaker API - Start Session
router.post('/match', async (req, res) => {
    try {
        const { project } = req.query; // get project name from query args
        const session = await pixelStreamingService.startSession(project);
        res.json({ success: true, session });
    } catch (error) {
        if (error.message.includes('Server Full')) {
            return res.status(503).json({ success: false, error: 'Server Full / Please Wait' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Explicitly end session
router.post('/disconnect', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId required' });
    }

    await pixelStreamingService.endSession(sessionId);
    res.json({ success: true, message: 'Disconnected successfully' });
});

// Admin / Dashboard Status
router.get('/status', (req, res) => {
    const activeSessions = Array.from(pixelStreamingService.sessions.values()).map(s => ({
        id: s.id,
        port: s.port,
        gpu: s.gpu,
        uptime: Date.now() - s.createdAt
    }));

    res.json({
        totalSlots: 6,
        availableSlots: 6 - activeSessions.length,
        activeSessions
    });
});

module.exports = router;
