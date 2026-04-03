// ============================================================
// Follow Routes — Follow/unfollow players
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Follow a user ----------
router.post('/:userId', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const targetId = parseInt(req.params.userId, 10);
        if (uid === targetId) return res.status(400).json({ error: 'Cannot follow yourself.' });

        await pool.query(
            'INSERT IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)',
            [uid, targetId]
        );

        // Notification
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, link) VALUES (?, 'New Follower', ?, ?)`,
            [targetId, `${req.session.user.first_name || req.session.user.username} followed you`, `/player/${uid}`]
        ).catch(() => {});

        res.json({ message: 'Followed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Unfollow a user ----------
router.delete('/:userId', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM follows WHERE follower_id = ? AND followed_id = ?',
            [req.session.user.user_id, parseInt(req.params.userId, 10)]
        );
        res.json({ message: 'Unfollowed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Check if following ----------
router.get('/:userId/status', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT follow_id FROM follows WHERE follower_id = ? AND followed_id = ?',
            [req.session.user.user_id, parseInt(req.params.userId, 10)]
        );
        res.json({ following: rows.length > 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get followers ----------
router.get('/:userId/followers', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.user_id, u.username, u.display_name, u.first_name, u.profile_image, u.is_pro, f.created_at
            FROM follows f JOIN users u ON u.user_id = f.follower_id
            WHERE f.followed_id = ? ORDER BY f.created_at DESC
        `, [req.params.userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get following ----------
router.get('/:userId/following', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.user_id, u.username, u.display_name, u.first_name, u.profile_image, u.is_pro, f.created_at
            FROM follows f JOIN users u ON u.user_id = f.followed_id
            WHERE f.follower_id = ? ORDER BY f.created_at DESC
        `, [req.params.userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
