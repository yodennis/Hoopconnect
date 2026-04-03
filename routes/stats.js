// ============================================================
// Player Stats Routes — computed stats + leaderboard
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Rating history for a user ----------
router.get('/:userId/rating-history', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });
    try {
        const [rows] = await pool.query(
            'SELECT avg_rating, review_count, snapshot_date FROM rating_history WHERE user_id = ? ORDER BY snapshot_date ASC',
            [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get stats for a specific user ----------
router.get('/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });

    try {
        // Compute stats live from actual data
        const [[gamesPlayed]] = await pool.query(
            'SELECT COUNT(*) as count FROM game_participants WHERE user_id = ?', [userId]
        );
        const [[gamesHosted]] = await pool.query(
            'SELECT COUNT(*) as count FROM games WHERE host_user_id = ?', [userId]
        );
        const [[teamsJoined]] = await pool.query(
            'SELECT COUNT(*) as count FROM team_members WHERE user_id = ? AND membership_status = ?',
            [userId, 'active']
        );
        const [[reviewsGiven]] = await pool.query(
            'SELECT COUNT(*) as count FROM reviews WHERE reviewer_id = ?', [userId]
        );
        const [[reviewStats]] = await pool.query(
            'SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE reviewed_id = ?',
            [userId]
        );
        const [[teamsCaptained]] = await pool.query(
            'SELECT COUNT(*) as count FROM teams WHERE captain_id = ?', [userId]
        );

        // Sports played (unique sports from games + teams)
        const [sportsRows] = await pool.query(`
            SELECT DISTINCT s.sport_name FROM sports s
            WHERE s.sport_id IN (
                SELECT g.sport_id FROM games g
                JOIN game_participants gp ON g.game_id = gp.game_id
                WHERE gp.user_id = ?
                UNION
                SELECT t.sport_id FROM teams t
                JOIN team_members tm ON t.team_id = tm.team_id
                WHERE tm.user_id = ? AND tm.membership_status = 'active'
            )
        `, [userId, userId]);

        res.json({
            games_played:     gamesPlayed.count,
            games_hosted:     gamesHosted.count,
            teams_joined:     teamsJoined.count,
            teams_captained:  teamsCaptained.count,
            reviews_given:    reviewsGiven.count,
            reviews_received: reviewStats.count,
            avg_rating:       parseFloat(reviewStats.avg_rating).toFixed(2),
            sports_played:    sportsRows.map(r => r.sport_name)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Leaderboard — top players ----------
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                u.user_id,
                u.username,
                u.display_name,
                u.first_name,
                u.is_pro,
                u.city,
                u.state,
                COUNT(DISTINCT gp.game_id) as games_played,
                COUNT(DISTINCT tm.team_id) as teams_joined,
                COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.reviewed_id = u.user_id), 0) as avg_rating,
                COALESCE((SELECT COUNT(*) FROM reviews r2 WHERE r2.reviewed_id = u.user_id), 0) as review_count
            FROM users u
            LEFT JOIN game_participants gp ON u.user_id = gp.user_id
            LEFT JOIN team_members tm ON u.user_id = tm.user_id AND tm.membership_status = 'active'
            GROUP BY u.user_id
            ORDER BY games_played DESC, avg_rating DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
