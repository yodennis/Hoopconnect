// ============================================================
// Game Waitlist Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Join waitlist for a full game
router.post('/:gameId', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const gid = parseInt(req.params.gameId, 10);

        const [game] = await pool.query('SELECT * FROM games WHERE game_id = ?', [gid]);
        if (!game.length) return res.status(404).json({ error: 'Game not found.' });

        // Check not already a participant
        const [part] = await pool.query(
            `SELECT user_id FROM game_participants WHERE game_id = ? AND user_id = ?`, [gid, uid]
        );
        if (part.length) return res.status(400).json({ error: 'You are already in this game.' });

        await pool.query(
            'INSERT INTO game_waitlist (game_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP',
            [gid, uid]
        );

        res.json({ message: 'Added to waitlist! You\'ll be notified if a spot opens.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Leave waitlist
router.delete('/:gameId', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM game_waitlist WHERE game_id = ? AND user_id = ?',
            [req.params.gameId, req.session.user.user_id]);
        res.json({ message: 'Removed from waitlist.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get waitlist for a game
router.get('/:gameId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT gw.*, u.username, u.display_name, u.first_name, u.profile_image
             FROM game_waitlist gw JOIN users u ON gw.user_id = u.user_id
             WHERE gw.game_id = ? ORDER BY gw.created_at ASC`,
            [req.params.gameId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Check if current user is on waitlist
router.get('/:gameId/status', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT waitlist_id FROM game_waitlist WHERE game_id = ? AND user_id = ?',
            [req.params.gameId, req.session.user.user_id]
        );
        res.json({ on_waitlist: rows.length > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
