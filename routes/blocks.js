// ============================================================
// Block Routes — Block/unblock players
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Block a user ----------
router.post('/:userId', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const targetId = parseInt(req.params.userId, 10);
        if (uid === targetId) return res.status(400).json({ error: 'Cannot block yourself.' });

        await pool.query('INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', [uid, targetId]);
        // Also unfollow both directions
        await pool.query('DELETE FROM follows WHERE (follower_id = ? AND followed_id = ?) OR (follower_id = ? AND followed_id = ?)',
            [uid, targetId, targetId, uid]);

        res.json({ message: 'User blocked.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Unblock a user ----------
router.delete('/:userId', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
            [req.session.user.user_id, parseInt(req.params.userId, 10)]);
        res.json({ message: 'User unblocked.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Check if blocked ----------
router.get('/:userId/status', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const tid = parseInt(req.params.userId, 10);
        const [rows] = await pool.query(
            'SELECT blocker_id FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
            [uid, tid]
        );
        res.json({ blocked: rows.length > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get blocked list ----------
router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.user_id, u.username, u.first_name, u.display_name, b.created_at
            FROM blocks b JOIN users u ON u.user_id = b.blocked_id
            WHERE b.blocker_id = ? ORDER BY b.created_at DESC
        `, [req.session.user.user_id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
