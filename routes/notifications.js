// ============================================================
// Notifications Routes — in-app notification system
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Get notifications for current user ----------
router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 30
        `, [req.session.user.user_id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Unread count ----------
router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const [[row]] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [req.session.user.user_id]
        );
        res.json({ count: row.count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Mark one notification as read ----------
router.put('/:id/read', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
            [req.params.id, req.session.user.user_id]
        );
        res.json({ message: 'Marked as read.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Mark all as read ----------
router.put('/read-all', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [req.session.user.user_id]
        );
        res.json({ message: 'All marked as read.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Delete a notification ----------
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM notifications WHERE notification_id = ? AND user_id = ?',
            [req.params.id, req.session.user.user_id]
        );
        res.json({ message: 'Deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
