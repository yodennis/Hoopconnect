// ============================================================
// Achievement Routes — Badge/achievement system
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Get all achievements ----------
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM achievements ORDER BY category, threshold');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get user's earned achievements ----------
router.get('/user/:userId', async (req, res) => {
    try {
        const [earned] = await pool.query(`
            SELECT a.*, ua.earned_at
            FROM user_achievements ua
            JOIN achievements a ON a.achievement_id = ua.achievement_id
            WHERE ua.user_id = ?
            ORDER BY ua.earned_at DESC
        `, [req.params.userId]);

        const [all] = await pool.query('SELECT * FROM achievements ORDER BY category, threshold');

        res.json({ earned, all, total_earned: earned.length, total_available: all.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Check and award achievements for a user ----------
router.post('/check', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const awarded = await checkAchievements(uid);
        res.json({ newly_awarded: awarded });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Achievement checking logic
async function checkAchievements(userId) {
    const awarded = [];

    // Get user stats
    const [[stats]] = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM game_participants WHERE user_id = ? AND participation_status = 'confirmed') as games_played,
            (SELECT COUNT(*) FROM games WHERE host_user_id = ?) as games_hosted,
            (SELECT COUNT(*) FROM team_members WHERE user_id = ? AND membership_status = 'active') as teams_joined,
            (SELECT COUNT(*) FROM teams WHERE captain_id = ?) as teams_captained,
            (SELECT COUNT(*) FROM reviews WHERE reviewer_id = ?) as reviews_given,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following_count,
            (SELECT COUNT(*) FROM follows WHERE followed_id = ?) as follower_count,
            (SELECT COUNT(*) FROM mvp_votes WHERE player_id = ?) as mvp_count,
            (SELECT AVG(rating) FROM reviews WHERE reviewed_id = ?) as avg_rating,
            (SELECT COUNT(DISTINCT g.location_id) FROM game_participants gp JOIN games g ON g.game_id = gp.game_id WHERE gp.user_id = ?) as courts_played
    `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);

    const [[user]] = await pool.query('SELECT current_streak FROM users WHERE user_id = ?', [userId]);

    // Already earned
    const [earned] = await pool.query('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId]);
    const earnedIds = new Set(earned.map(e => e.achievement_id));

    // All achievements
    const [allAch] = await pool.query('SELECT * FROM achievements');

    const checks = {
        'first_game': stats.games_played >= 1,
        'games_5': stats.games_played >= 5,
        'games_10': stats.games_played >= 10,
        'games_25': stats.games_played >= 25,
        'games_50': stats.games_played >= 50,
        'games_100': stats.games_played >= 100,
        'first_host': stats.games_hosted >= 1,
        'host_10': stats.games_hosted >= 10,
        'first_team': stats.teams_joined >= 1,
        'captain': stats.teams_captained >= 1,
        'teams_3': stats.teams_joined >= 3,
        'first_review': stats.reviews_given >= 1,
        'reviews_10': stats.reviews_given >= 10,
        'five_star': stats.avg_rating && parseFloat(stats.avg_rating) >= 4.9,
        'first_follow': stats.following_count >= 1,
        'followers_10': stats.follower_count >= 10,
        'streak_3': (user?.current_streak || 0) >= 3,
        'streak_10': (user?.current_streak || 0) >= 10,
        'mvp_1': stats.mvp_count >= 1,
        'mvp_5': stats.mvp_count >= 5,
        'court_explorer': stats.courts_played >= 5,
        'checkin_streak': stats.games_played >= 10 // simplified
    };

    for (const ach of allAch) {
        if (earnedIds.has(ach.achievement_id)) continue;
        if (checks[ach.achievement_key]) {
            await pool.query(
                'INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
                [userId, ach.achievement_id]
            );
            awarded.push(ach);

            // Log activity
            await pool.query(
                `INSERT INTO activity_feed (user_id, activity_type, reference_id, description) VALUES (?, 'achievement_earned', ?, ?)`,
                [userId, ach.achievement_id, `Earned: ${ach.title}`]
            ).catch(() => {});
        }
    }

    return awarded;
}

module.exports = router;
module.exports.checkAchievements = checkAchievements;
