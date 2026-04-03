// ============================================================
// Check-in Routes — Game check-in + no-show tracking
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Check in to a game ----------
router.post('/:gameId', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const gid = parseInt(req.params.gameId, 10);

        // Verify user is a confirmed participant
        const [part] = await pool.query(
            `SELECT user_id FROM game_participants WHERE game_id = ? AND user_id = ? AND participation_status = 'confirmed'`,
            [gid, uid]
        );
        if (!part.length) return res.status(400).json({ error: 'You must be a confirmed participant to check in.' });

        await pool.query(
            'INSERT IGNORE INTO game_checkins (game_id, user_id) VALUES (?, ?)',
            [gid, uid]
        );

        // Increment check-in count
        await pool.query('UPDATE users SET games_checked_in = games_checked_in + 1 WHERE user_id = ?', [uid]);

        // Log activity
        await pool.query(
            `INSERT INTO activity_feed (user_id, activity_type, reference_id, description) VALUES (?, 'checkin', ?, 'Checked in to a game')`,
            [uid, gid]
        ).catch(() => {});

        res.json({ message: 'Checked in!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get check-ins for a game ----------
router.get('/:gameId', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT gc.*, u.username, u.first_name, u.display_name
            FROM game_checkins gc JOIN users u ON u.user_id = gc.user_id
            WHERE gc.game_id = ? ORDER BY gc.checked_in_at
        `, [req.params.gameId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Report no-shows (host only, after game) ----------
router.post('/:gameId/no-shows', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const gid = parseInt(req.params.gameId, 10);

        const [game] = await pool.query('SELECT host_user_id FROM games WHERE game_id = ?', [gid]);
        if (!game.length || game[0].host_user_id !== uid) {
            return res.status(403).json({ error: 'Only the host can report no-shows.' });
        }

        const { user_ids } = req.body;
        if (!Array.isArray(user_ids) || user_ids.length === 0) {
            return res.status(400).json({ error: 'Provide user_ids array.' });
        }

        for (const noShowId of user_ids) {
            // Only flag if they were a confirmed participant but didn't check in
            const [checked] = await pool.query(
                'SELECT checkin_id FROM game_checkins WHERE game_id = ? AND user_id = ?', [gid, noShowId]
            );
            if (checked.length === 0) {
                await pool.query('UPDATE users SET no_show_count = no_show_count + 1 WHERE user_id = ?', [noShowId]);
            }
        }

        res.json({ message: 'No-shows reported.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
