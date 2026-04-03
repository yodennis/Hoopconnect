// ============================================================
// Team Challenge Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Send a challenge
router.post('/', requireAuth, async (req, res) => {
    try {
        const { challenger_team_id, challenged_team_id, message, proposed_date, proposed_time, location_id } = req.body;
        if (!challenger_team_id || !challenged_team_id) {
            return res.status(400).json({ error: 'Both team IDs are required.' });
        }
        if (challenger_team_id === challenged_team_id) {
            return res.status(400).json({ error: 'Cannot challenge your own team.' });
        }

        // Verify requester is captain of challenger team
        const [team] = await pool.query('SELECT captain_id, sport_id FROM teams WHERE team_id = ?', [challenger_team_id]);
        if (!team.length) return res.status(404).json({ error: 'Challenger team not found.' });
        if (team[0].captain_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the team captain can send challenges.' });
        }

        // Verify target team exists
        const [target] = await pool.query('SELECT team_id FROM teams WHERE team_id = ?', [challenged_team_id]);
        if (!target.length) return res.status(404).json({ error: 'Challenged team not found.' });

        const [result] = await pool.query(
            `INSERT INTO team_challenges (challenger_team_id, challenged_team_id, sport_id, message, proposed_date, proposed_time, location_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [challenger_team_id, challenged_team_id, team[0].sport_id, message || null, proposed_date || null, proposed_time || null, location_id || null]
        );

        // Notify the challenged team's captain
        const [challenged] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [challenged_team_id]);
        if (challenged.length) {
            const [challengerTeam] = await pool.query('SELECT team_name FROM teams WHERE team_id = ?', [challenger_team_id]);
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, link) VALUES (?, 'Team Challenge!', ?, '/teams')`,
                [challenged[0].captain_id, `${challengerTeam[0]?.team_name || 'A team'} has challenged your team!`]
            ).catch(() => {});
        }

        res.json({ message: 'Challenge sent!', challenge_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get challenges for a team (incoming + outgoing)
router.get('/team/:teamId', async (req, res) => {
    try {
        const tid = req.params.teamId;
        const [incoming] = await pool.query(
            `SELECT tc.*, t.team_name AS challenger_name, t2.team_name AS challenged_name, s.sport_name
             FROM team_challenges tc
             JOIN teams t ON tc.challenger_team_id = t.team_id
             JOIN teams t2 ON tc.challenged_team_id = t2.team_id
             LEFT JOIN sports s ON tc.sport_id = s.sport_id
             WHERE tc.challenged_team_id = ?
             ORDER BY tc.created_at DESC`,
            [tid]
        );
        const [outgoing] = await pool.query(
            `SELECT tc.*, t.team_name AS challenger_name, t2.team_name AS challenged_name, s.sport_name
             FROM team_challenges tc
             JOIN teams t ON tc.challenger_team_id = t.team_id
             JOIN teams t2 ON tc.challenged_team_id = t2.team_id
             LEFT JOIN sports s ON tc.sport_id = s.sport_id
             WHERE tc.challenger_team_id = ?
             ORDER BY tc.created_at DESC`,
            [tid]
        );
        res.json({ incoming, outgoing });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Respond to a challenge (accept / decline)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ error: 'Status must be accepted or declined.' });
        }

        const [challenge] = await pool.query('SELECT * FROM team_challenges WHERE challenge_id = ?', [req.params.id]);
        if (!challenge.length) return res.status(404).json({ error: 'Challenge not found.' });

        // Verify captain of challenged team
        const [team] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [challenge[0].challenged_team_id]);
        if (!team.length || team[0].captain_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the challenged team captain can respond.' });
        }

        await pool.query('UPDATE team_challenges SET status = ? WHERE challenge_id = ?', [status, req.params.id]);

        // If accepted, create a game
        if (status === 'accepted' && challenge[0].proposed_date) {
            const [result] = await pool.query(
                `INSERT INTO games (game_title, sport_id, host_user_id, location_id, game_date, start_time, skill_level, max_players, current_players, description)
                 VALUES (?, ?, ?, ?, ?, ?, 'any', 20, 0, ?)`,
                [
                    `${challenge[0].challenger_name || 'Team'} vs ${challenge[0].challenged_name || 'Team'}`,
                    challenge[0].sport_id,
                    req.session.user.user_id,
                    challenge[0].location_id,
                    challenge[0].proposed_date,
                    challenge[0].proposed_time || '18:00',
                    `Team challenge match`
                ]
            );
            await pool.query('UPDATE team_challenges SET game_id = ? WHERE challenge_id = ?', [result.insertId, req.params.id]);
        }

        res.json({ message: `Challenge ${status}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
