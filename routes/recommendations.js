// ============================================================
// Smart Recommendations Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Get recommended games for current user
router.get('/games', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;

        // Get user preferences
        const [[user]] = await pool.query('SELECT city, state, skill_level FROM users WHERE user_id = ?', [uid]);
        const [userSports] = await pool.query('SELECT sport_id FROM user_sports WHERE user_id = ?', [uid]);
        const sportIds = userSports.map(s => s.sport_id);

        let sql = `SELECT g.*, s.sport_name, u.username AS host_name, u.display_name AS host_display,
                          l.location_name, l.city AS location_city
                   FROM games g
                   JOIN sports s ON g.sport_id = s.sport_id
                   JOIN users u ON g.host_user_id = u.user_id
                   JOIN locations l ON g.location_id = l.location_id
                   WHERE g.status = 'open'
                     AND g.game_date >= CURDATE()
                     AND g.host_user_id != ?
                     AND g.game_id NOT IN (SELECT game_id FROM game_participants WHERE user_id = ?)`;
        const params = [uid, uid];

        // Score and sort by relevance
        let orderParts = [];

        if (sportIds.length > 0) {
            orderParts.push(`(g.sport_id IN (${sportIds.map(() => '?').join(',')})) DESC`);
            params.push(...sportIds);
        }

        if (user?.city) {
            orderParts.push(`(l.city = ?) DESC`);
            params.push(user.city);
        }

        if (user?.skill_level && user.skill_level !== 'any') {
            orderParts.push(`(g.skill_level = ? OR g.skill_level = 'any') DESC`);
            params.push(user.skill_level);
        }

        orderParts.push('g.game_date ASC');
        sql += ' ORDER BY ' + orderParts.join(', ');
        sql += ' LIMIT 10';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get recommended players to follow
router.get('/players', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [[user]] = await pool.query('SELECT city, state FROM users WHERE user_id = ?', [uid]);

        const [rows] = await pool.query(`
            SELECT u.user_id, u.username, u.display_name, u.first_name, u.city, u.state,
                   u.skill_level, u.profile_image, u.is_pro,
                   COUNT(DISTINCT gp.game_id) as games_played,
                   COALESCE((SELECT AVG(rating) FROM reviews WHERE reviewed_id = u.user_id), 0) as avg_rating
            FROM users u
            LEFT JOIN game_participants gp ON u.user_id = gp.user_id
            WHERE u.user_id != ?
              AND u.user_id NOT IN (SELECT followed_id FROM follows WHERE follower_id = ?)
            GROUP BY u.user_id
            ORDER BY (u.city = ?) DESC, games_played DESC, avg_rating DESC
            LIMIT 10
        `, [uid, uid, user?.city || '']);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
