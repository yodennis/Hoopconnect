// ============================================================
// Report Routes — safety / moderation
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Submit a report
router.post('/', requireAuth, async (req, res) => {
    try {
        const { reported_user_id, reported_team_id, reported_game_id, reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'A reason is required.' });

        await pool.query(
            `INSERT INTO reports (reporter_id, reported_user_id, reported_team_id, reported_game_id, reason)
             VALUES (?, ?, ?, ?, ?)`,
            [req.session.user.user_id, reported_user_id || null, reported_team_id || null, reported_game_id || null, reason]
        );
        res.json({ message: 'Report submitted. Thank you for helping keep the community safe.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
