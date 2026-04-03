// ============================================================
// Player Comparison Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

router.get('/', async (req, res) => {
    try {
        const { player1, player2 } = req.query;
        if (!player1 || !player2) return res.status(400).json({ error: 'Two player IDs required.' });

        const ids = [parseInt(player1, 10), parseInt(player2, 10)];

        async function getPlayerData(uid) {
            const [[user]] = await pool.query(
                `SELECT user_id, username, display_name, first_name, last_name, city, state,
                        skill_level, profile_image, is_pro, created_at, current_streak, longest_streak
                 FROM users WHERE user_id = ?`, [uid]
            );
            if (!user) return null;

            const [[gp]] = await pool.query('SELECT COUNT(*) as c FROM game_participants WHERE user_id = ?', [uid]);
            const [[gh]] = await pool.query('SELECT COUNT(*) as c FROM games WHERE host_user_id = ?', [uid]);
            const [[tj]] = await pool.query("SELECT COUNT(*) as c FROM team_members WHERE user_id = ? AND membership_status = 'active'", [uid]);
            const [[rv]] = await pool.query('SELECT COUNT(*) as c, COALESCE(AVG(rating),0) as avg FROM reviews WHERE reviewed_id = ?', [uid]);
            const [[mvp]] = await pool.query('SELECT COUNT(*) as c FROM mvp_votes WHERE player_id = ?', [uid]);

            const [sports] = await pool.query(
                `SELECT DISTINCT s.sport_name FROM sports s WHERE s.sport_id IN (
                    SELECT g.sport_id FROM games g JOIN game_participants gp ON g.game_id = gp.game_id WHERE gp.user_id = ?
                    UNION SELECT t.sport_id FROM teams t JOIN team_members tm ON t.team_id = tm.team_id WHERE tm.user_id = ?
                )`, [uid, uid]
            );

            return {
                ...user,
                games_played: gp.c,
                games_hosted: gh.c,
                teams_joined: tj.c,
                reviews_received: rv.c,
                avg_rating: parseFloat(rv.avg).toFixed(2),
                mvp_votes: mvp.c,
                sports: sports.map(s => s.sport_name)
            };
        }

        const [p1, p2] = await Promise.all(ids.map(getPlayerData));
        if (!p1 || !p2) return res.status(404).json({ error: 'One or both players not found.' });

        res.json({ player1: p1, player2: p2 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
