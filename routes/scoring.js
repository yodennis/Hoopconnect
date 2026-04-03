// ============================================================
// Scoring Routes — Game scores + MVP voting
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Get scores for a game ----------
router.get('/:gameId', async (req, res) => {
    try {
        const [scores] = await pool.query(
            'SELECT * FROM game_scores WHERE game_id = ? ORDER BY score_id',
            [req.params.gameId]
        );
        const [mvpVotes] = await pool.query(`
            SELECT mv.player_id, u.username, u.first_name, u.display_name, COUNT(*) as vote_count
            FROM mvp_votes mv JOIN users u ON u.user_id = mv.player_id
            WHERE mv.game_id = ?
            GROUP BY mv.player_id ORDER BY vote_count DESC
        `, [req.params.gameId]);
        res.json({ scores, mvp_votes: mvpVotes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Set/update scores (host only) ----------
router.post('/:gameId/scores', requireAuth, async (req, res) => {
    try {
        const gid = parseInt(req.params.gameId, 10);
        const [game] = await pool.query('SELECT host_user_id FROM games WHERE game_id = ?', [gid]);
        if (!game.length || game[0].host_user_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the host can set scores.' });
        }

        const { scores } = req.body; // [{team_label, score}]
        if (!Array.isArray(scores)) return res.status(400).json({ error: 'Scores array required.' });

        // Clear old scores and insert new
        await pool.query('DELETE FROM game_scores WHERE game_id = ?', [gid]);
        for (const s of scores) {
            await pool.query(
                'INSERT INTO game_scores (game_id, team_label, score) VALUES (?, ?, ?)',
                [gid, s.team_label || 'Team', parseInt(s.score) || 0]
            );
        }

        res.json({ message: 'Scores saved.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Vote for MVP ----------
router.post('/:gameId/mvp', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const gid = parseInt(req.params.gameId, 10);
        const { player_id } = req.body;

        if (!player_id) return res.status(400).json({ error: 'Player ID required.' });

        // Must be a participant
        const [part] = await pool.query(
            `SELECT user_id FROM game_participants WHERE game_id = ? AND user_id = ? AND participation_status = 'confirmed'`,
            [gid, uid]
        );
        if (!part.length) return res.status(403).json({ error: 'You must be a participant to vote.' });

        // Can't vote for yourself
        if (uid === parseInt(player_id)) return res.status(400).json({ error: 'Cannot vote for yourself.' });

        await pool.query(`
            INSERT INTO mvp_votes (game_id, voter_id, player_id) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE player_id = VALUES(player_id)
        `, [gid, uid, player_id]);

        res.json({ message: 'MVP vote cast!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
