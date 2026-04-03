// ============================================================
// Activity Feed Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Get user's own activity ----------
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT * FROM activity_feed WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 50
        `, [req.session.user.user_id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get feed from followed users ----------
router.get('/feed', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [rows] = await pool.query(`
            SELECT af.*, u.username, u.first_name, u.display_name, u.profile_image
            FROM activity_feed af
            JOIN users u ON u.user_id = af.user_id
            WHERE af.user_id IN (SELECT followed_id FROM follows WHERE follower_id = ?)
               OR af.user_id = ?
            ORDER BY af.created_at DESC LIMIT 50
        `, [uid, uid]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get any user's activity ----------
router.get('/user/:userId', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT * FROM activity_feed WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 30
        `, [req.params.userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Looking for game — toggle ----------
router.put('/looking', requireAuth, async (req, res) => {
    try {
        const { looking } = req.body;
        await pool.query('UPDATE users SET looking_for_game = ? WHERE user_id = ?',
            [!!looking, req.session.user.user_id]);
        res.json({ message: looking ? 'You\'re looking for a game!' : 'Status cleared.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Players looking for game ----------
router.get('/looking', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT user_id, username, display_name, first_name, city, state, skill_level, profile_image, is_pro
            FROM users WHERE looking_for_game = TRUE
            ORDER BY RAND() LIMIT 20
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Nearby players ----------
router.get('/nearby-players', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [[me]] = await pool.query('SELECT city, state FROM users WHERE user_id = ?', [uid]);
        if (!me?.city) return res.json([]);

        const [rows] = await pool.query(`
            SELECT user_id, username, display_name, first_name, city, state, skill_level,
                   profile_image, is_pro, looking_for_game,
                   (SELECT AVG(rating) FROM reviews WHERE reviewed_id = users.user_id) as avg_rating
            FROM users
            WHERE city = ? AND state = ? AND user_id != ?
            ORDER BY looking_for_game DESC, RAND()
            LIMIT 20
        `, [me.city, me.state, uid]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Analytics (Pro) ----------
router.get('/analytics', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [[user]] = await pool.query('SELECT is_pro FROM users WHERE user_id = ?', [uid]);
        if (!user?.is_pro) return res.status(403).json({ error: 'Pro feature.' });

        // Games per month (last 6 months)
        const [gamesPerMonth] = await pool.query(`
            SELECT DATE_FORMAT(g.game_date, '%Y-%m') as month, COUNT(*) as count
            FROM game_participants gp JOIN games g ON g.game_id = gp.game_id
            WHERE gp.user_id = ? AND gp.participation_status = 'confirmed'
              AND g.game_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY month ORDER BY month
        `, [uid]);

        // Most played sports
        const [sportBreakdown] = await pool.query(`
            SELECT s.sport_name, COUNT(*) as count
            FROM game_participants gp
            JOIN games g ON g.game_id = gp.game_id
            JOIN sports s ON s.sport_id = g.sport_id
            WHERE gp.user_id = ? AND gp.participation_status = 'confirmed'
            GROUP BY s.sport_id ORDER BY count DESC LIMIT 5
        `, [uid]);

        // Most played locations
        const [topLocations] = await pool.query(`
            SELECT l.location_name, l.city, COUNT(*) as count
            FROM game_participants gp
            JOIN games g ON g.game_id = gp.game_id
            JOIN locations l ON l.location_id = g.location_id
            WHERE gp.user_id = ? AND gp.participation_status = 'confirmed'
            GROUP BY g.location_id ORDER BY count DESC LIMIT 5
        `, [uid]);

        // Rating trend
        const [ratingTrend] = await pool.query(`
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, AVG(rating) as avg_rating
            FROM reviews WHERE reviewed_id = ?
            GROUP BY month ORDER BY month
        `, [uid]);

        // Streak info
        const [[streakInfo]] = await pool.query(
            'SELECT current_streak, longest_streak, last_game_date FROM users WHERE user_id = ?', [uid]
        );

        res.json({
            games_per_month: gamesPerMonth,
            sport_breakdown: sportBreakdown,
            top_locations: topLocations,
            rating_trend: ratingTrend,
            streak: streakInfo
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Dark mode preference ----------
router.put('/dark-mode', requireAuth, async (req, res) => {
    try {
        const dark_mode = !!req.body.dark_mode;
        await pool.query('UPDATE users SET dark_mode = ? WHERE user_id = ?',
            [dark_mode, req.session.user.user_id]);
        req.session.user.dark_mode = dark_mode;
        res.json({ message: 'Theme updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get user preferences ----------
router.get('/preferences', requireAuth, async (req, res) => {
    try {
        const [[row]] = await pool.query(
            'SELECT dark_mode, looking_for_game, onboarding_complete FROM users WHERE user_id = ?',
            [req.session.user.user_id]
        );
        res.json(row || {});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Complete onboarding ----------
router.put('/onboarding', requireAuth, async (req, res) => {
    try {
        await pool.query('UPDATE users SET onboarding_complete = TRUE WHERE user_id = ?',
            [req.session.user.user_id]);
        res.json({ message: 'Onboarding complete.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
