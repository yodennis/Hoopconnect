// ============================================================
// Review Routes — Player ratings & comments
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/sanitize');

// ---------- Get reviews written BY the logged-in user ----------
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const [reviews] = await pool.query(
            `SELECT r.review_id, r.rating, r.comment, r.created_at, r.updated_at,
                    u.user_id AS reviewed_id, u.username AS reviewed_username,
                    u.first_name AS reviewed_first_name
             FROM reviews r
             JOIN users u ON r.reviewed_id = u.user_id
             WHERE r.reviewer_id = ?
             ORDER BY r.created_at DESC`,
            [req.session.user.user_id]
        );
        res.json({ reviews });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get reviews for a user ----------
router.get('/:userId', async (req, res) => {
    try {
        const [reviews] = await pool.query(
            `SELECT r.review_id, r.rating, r.comment, r.created_at, r.updated_at,
                    u.user_id AS reviewer_id, u.username AS reviewer_username,
                    u.first_name AS reviewer_first_name
             FROM reviews r
             JOIN users u ON r.reviewer_id = u.user_id
             WHERE r.reviewed_id = ?
             ORDER BY r.created_at DESC`,
            [req.params.userId]
        );

        // Average rating
        const [avg] = await pool.query(
            `SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total
             FROM reviews WHERE reviewed_id = ?`,
            [req.params.userId]
        );

        res.json({
            reviews,
            avg_rating: avg[0].avg_rating || 0,
            total_reviews: avg[0].total || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Submit or update a review ----------
router.post('/:userId', requireAuth, sanitizeInput({
    rating: 'integer:1,5',
    comment: 'optional_text'
}), async (req, res) => {
    try {
        const reviewed_id = parseInt(req.params.userId);
        const reviewer_id = req.session.user.user_id;
        const { rating, comment } = req.body;

        if (reviewer_id === reviewed_id) {
            return res.status(400).json({ error: "You can't review yourself." });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }

        // Upsert — insert or update if already reviewed
        await pool.query(
            `INSERT INTO reviews (reviewer_id, reviewed_id, rating, comment)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = NOW()`,
            [reviewer_id, reviewed_id, rating, comment || null]
        );

        res.json({ message: 'Review saved!' });

        // Snapshot rating history (non-blocking)
        pool.query(
            `INSERT INTO rating_history (user_id, avg_rating, review_count, snapshot_date)
             SELECT ?, COALESCE(AVG(rating),0), COUNT(*), CURDATE() FROM reviews WHERE reviewed_id = ?
             ON DUPLICATE KEY UPDATE avg_rating = VALUES(avg_rating), review_count = VALUES(review_count)`,
            [reviewed_id, reviewed_id]
        ).catch(() => {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Delete own review ----------
router.delete('/:userId', requireAuth, async (req, res) => {
    try {
        const [result] = await pool.query(
            'DELETE FROM reviews WHERE reviewer_id = ? AND reviewed_id = ?',
            [req.session.user.user_id, req.params.userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Review not found.' });
        }
        res.json({ message: 'Review deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
