// ============================================================
// Sports Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { cacheMiddleware } = require('../middleware/cache');

// List all sports (cached for 30 minutes since sports data is static)
router.get('/', cacheMiddleware(30 * 60 * 1000), async (req, res) => {
    try {
        const [rows] = await pool.cachedQuery('SELECT * FROM sports ORDER BY sport_name', [], 'sports:all', 30 * 60 * 1000);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
