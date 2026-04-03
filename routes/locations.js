// ============================================================
// Location Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

// ---------- List / search locations ----------
// Cache for 10 minutes since locations are relatively static but can be added
router.get('/', cacheMiddleware(10 * 60 * 1000), async (req, res) => {
    try {
        const { city, sport_id, indoor_outdoor } = req.query;
        let sql = `SELECT l.*, GROUP_CONCAT(s.sport_name SEPARATOR ', ') AS sports_supported
                   FROM locations l
                   LEFT JOIN location_sports ls ON l.location_id = ls.location_id
                   LEFT JOIN sports s ON ls.sport_id = s.sport_id`;
        const conditions = [];
        const params = [];

        if (city) { conditions.push('l.city LIKE ?'); params.push(`%${city}%`); }
        if (sport_id) { conditions.push('ls.sport_id = ?'); params.push(sport_id); }
        if (indoor_outdoor) { conditions.push('l.indoor_outdoor = ?'); params.push(indoor_outdoor); }

        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' GROUP BY l.location_id ORDER BY l.location_name';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Single location ----------
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM locations WHERE location_id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Location not found.' });

        const [sports] = await pool.query(
            `SELECT s.sport_id, s.sport_name
             FROM location_sports ls JOIN sports s ON ls.sport_id = s.sport_id
             WHERE ls.location_id = ?`,
            [req.params.id]
        );
        res.json({ ...rows[0], sports });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Create location ----------
router.post('/', requireAuth, async (req, res) => {
    try {
        const { location_name, address, city, state, zip_code, latitude, longitude, indoor_outdoor, notes, sport_ids } = req.body;
        if (!location_name || !city || !state) {
            return res.status(400).json({ error: 'Location name, city, and state are required.' });
        }

        const [result] = await pool.query(
            `INSERT INTO locations (location_name, address, city, state, zip_code, latitude, longitude, indoor_outdoor, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [location_name, address || null, city, state, zip_code || null, latitude || null, longitude || null, indoor_outdoor || 'outdoor', notes || null]
        );

        if (Array.isArray(sport_ids)) {
            for (const sid of sport_ids) {
                await pool.query('INSERT INTO location_sports (location_id, sport_id) VALUES (?, ?)', [result.insertId, sid]);
            }
        }

        res.json({ message: 'Location created.', location_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
