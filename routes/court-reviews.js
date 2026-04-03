// ============================================================
// Court Review Routes — Rate and review courts/locations
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Get reviews for a location ----------
router.get('/:locationId', async (req, res) => {
    try {
        const [reviews] = await pool.query(`
            SELECT cr.*, u.username, u.first_name, u.display_name, u.profile_image
            FROM court_reviews cr JOIN users u ON u.user_id = cr.user_id
            WHERE cr.location_id = ? ORDER BY cr.created_at DESC
        `, [req.params.locationId]);

        const [[avg]] = await pool.query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as total,
                    AVG(surface_quality) as avg_surface, AVG(lighting) as avg_lighting,
                    AVG(hoop_condition) as avg_hoops
             FROM court_reviews WHERE location_id = ?`,
            [req.params.locationId]
        );

        res.json({
            avg_rating: avg.avg_rating ? parseFloat(avg.avg_rating).toFixed(1) : null,
            avg_surface: avg.avg_surface ? parseFloat(avg.avg_surface).toFixed(1) : null,
            avg_lighting: avg.avg_lighting ? parseFloat(avg.avg_lighting).toFixed(1) : null,
            avg_hoops: avg.avg_hoops ? parseFloat(avg.avg_hoops).toFixed(1) : null,
            total_reviews: avg.total,
            reviews
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Add/update court review ----------
router.post('/:locationId', requireAuth, async (req, res) => {
    try {
        const { rating, surface_quality, lighting, hoop_condition, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required.' });

        const uid = req.session.user.user_id;
        const lid = parseInt(req.params.locationId, 10);

        await pool.query(`
            INSERT INTO court_reviews (location_id, user_id, rating, surface_quality, lighting, hoop_condition, comment)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE rating=VALUES(rating), surface_quality=VALUES(surface_quality),
            lighting=VALUES(lighting), hoop_condition=VALUES(hoop_condition), comment=VALUES(comment),
            created_at=CURRENT_TIMESTAMP
        `, [lid, uid, rating, surface_quality || null, lighting || null, hoop_condition || null, comment?.substring(0, 500) || null]);

        res.json({ message: 'Court review saved.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Delete court review ----------
router.delete('/:locationId', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM court_reviews WHERE location_id = ? AND user_id = ?',
            [req.params.locationId, req.session.user.user_id]);
        res.json({ message: 'Review deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
