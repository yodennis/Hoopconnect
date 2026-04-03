// ============================================================
// Game Comments / Discussion Thread Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Get comments for a game
router.get('/:gameId', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 30;
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(
            `SELECT gc.*, u.username, u.display_name, u.first_name, u.profile_image
             FROM game_comments gc JOIN users u ON gc.user_id = u.user_id
             WHERE gc.game_id = ?
             ORDER BY gc.created_at ASC
             LIMIT ? OFFSET ?`,
            [req.params.gameId, limit, offset]
        );

        const [[{ total }]] = await pool.query(
            'SELECT COUNT(*) as total FROM game_comments WHERE game_id = ?',
            [req.params.gameId]
        );

        res.json({ comments: rows, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Post a comment
router.post('/:gameId', requireAuth, async (req, res) => {
    try {
        const { comment_text } = req.body;
        if (!comment_text || !comment_text.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });
        if (comment_text.length > 500) return res.status(400).json({ error: 'Comment too long (max 500 chars).' });

        await pool.query(
            'INSERT INTO game_comments (game_id, user_id, comment_text) VALUES (?, ?, ?)',
            [req.params.gameId, req.session.user.user_id, comment_text.trim()]
        );

        res.json({ message: 'Comment posted!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Delete own comment
router.delete('/:commentId', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT user_id FROM game_comments WHERE comment_id = ?', [req.params.commentId]);
        if (!rows.length) return res.status(404).json({ error: 'Comment not found.' });
        if (rows[0].user_id !== req.session.user.user_id) return res.status(403).json({ error: 'Not your comment.' });

        await pool.query('DELETE FROM game_comments WHERE comment_id = ?', [req.params.commentId]);
        res.json({ message: 'Comment deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
