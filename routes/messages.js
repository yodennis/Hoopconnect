// ============================================================
// Message Routes — In-app DM system
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/sanitize');

// ---------- Get conversations list ----------
router.get('/conversations', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [rows] = await pool.query(`
            SELECT u.user_id, u.username, u.display_name, u.first_name, u.profile_image, u.is_pro,
                   m.message_text AS last_message, m.created_at AS last_message_at,
                   (SELECT COUNT(*) FROM messages WHERE sender_id = u.user_id AND receiver_id = ? AND is_read = FALSE) AS unread_count
            FROM (
                SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_id,
                       MAX(message_id) AS max_id
                FROM messages
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY other_id
            ) conv
            JOIN messages m ON m.message_id = conv.max_id
            JOIN users u ON u.user_id = conv.other_id
            LEFT JOIN blocks b ON (b.blocker_id = ? AND b.blocked_id = u.user_id)
            WHERE b.block_id IS NULL
            ORDER BY m.created_at DESC
        `, [uid, uid, uid, uid, uid]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Unread message count ----------
router.get('/unread/count', requireAuth, async (req, res) => {
    try {
        const [[row]] = await pool.query(
            'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE',
            [req.session.user.user_id]
        );
        res.json({ count: row.count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get messages with a specific user ----------
router.get('/:userId', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const otherId = parseInt(req.params.userId, 10);

        // Check not blocked
        const [blocked] = await pool.query(
            'SELECT block_id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
            [uid, otherId, otherId, uid]
        );
        if (blocked.length) return res.status(403).json({ error: 'Cannot message this user.' });

        const [messages] = await pool.query(`
            SELECT m.*, u.username AS sender_name, u.first_name AS sender_first
            FROM messages m
            JOIN users u ON u.user_id = m.sender_id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
            LIMIT 100
        `, [uid, otherId, otherId, uid]);

        // Mark as read
        await pool.query(
            'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE',
            [otherId, uid]
        );

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Send a message ----------
router.post('/:userId', requireAuth, sanitizeInput({
    message_text: 'text'
}), async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const receiverId = parseInt(req.params.userId, 10);
        const { message_text } = req.body;

        if (!message_text || !message_text.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });
        if (uid === receiverId) return res.status(400).json({ error: 'Cannot message yourself.' });

        // Check not blocked
        const [blocked] = await pool.query(
            'SELECT block_id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
            [uid, receiverId, receiverId, uid]
        );
        if (blocked.length) return res.status(403).json({ error: 'Cannot message this user.' });

        await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, message_text) VALUES (?, ?, ?)',
            [uid, receiverId, message_text.trim().substring(0, 1000)]
        );

        // Create notification
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, link) VALUES (?, 'New Message', ?, '/messages')`,
            [receiverId, `${req.session.user.first_name || req.session.user.username} sent you a message`]
        ).catch(() => {});

        res.json({ message: 'Message sent.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
