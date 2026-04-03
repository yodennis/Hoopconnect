// ============================================================
// Join Request Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- Submit a join request ----------
router.post('/', requireAuth, async (req, res) => {
    try {
        const { team_id, game_id, request_type, message } = req.body;
        const user_id = req.session.user.user_id;

        if (!request_type || (!team_id && !game_id)) {
            return res.status(400).json({ error: 'Request type and a team or game ID are required.' });
        }

        // Check for duplicate pending request
        const [existing] = await pool.query(
            `SELECT request_id FROM join_requests
             WHERE user_id = ? AND request_status = 'pending'
             AND ((team_id = ? AND request_type = 'team') OR (game_id = ? AND request_type = 'game'))`,
            [user_id, team_id || null, game_id || null]
        );
        if (existing.length) {
            return res.status(409).json({ error: 'You already have a pending request.' });
        }

        await pool.query(
            `INSERT INTO join_requests (user_id, team_id, game_id, request_type, message)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, team_id || null, game_id || null, request_type, message || null]
        );
        res.json({ message: 'Join request submitted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get pending requests for my teams/games ----------
router.get('/incoming', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;

        // Team requests where I am captain
        const [teamReqs] = await pool.query(
            `SELECT jr.*, u.username, u.display_name, u.skill_level, t.team_name
             FROM join_requests jr
             JOIN users u ON jr.user_id = u.user_id
             JOIN teams t ON jr.team_id = t.team_id
             WHERE t.captain_id = ? AND jr.request_type = 'team' AND jr.request_status = 'pending'
             ORDER BY jr.created_at DESC`,
            [uid]
        );

        // Game requests where I am host
        const [gameReqs] = await pool.query(
            `SELECT jr.*, u.username, u.display_name, u.skill_level, g.game_title
             FROM join_requests jr
             JOIN users u ON jr.user_id = u.user_id
             JOIN games g ON jr.game_id = g.game_id
             WHERE g.host_user_id = ? AND jr.request_type = 'game' AND jr.request_status = 'pending'
             ORDER BY jr.created_at DESC`,
            [uid]
        );

        res.json({ team_requests: teamReqs, game_requests: gameReqs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Get my outgoing requests ----------
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT jr.*,
                    t.team_name, g.game_title
             FROM join_requests jr
             LEFT JOIN teams t ON jr.team_id = t.team_id
             LEFT JOIN games g ON jr.game_id = g.game_id
             WHERE jr.user_id = ?
             ORDER BY jr.created_at DESC`,
            [req.session.user.user_id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Accept / reject a request ----------
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { request_status } = req.body; // 'accepted' or 'rejected'
        const uid = req.session.user.user_id;

        const [reqs] = await pool.query('SELECT * FROM join_requests WHERE request_id = ?', [req.params.id]);
        if (!reqs.length) return res.status(404).json({ error: 'Request not found.' });
        const jr = reqs[0];

        // Verify the current user is the captain/host
        if (jr.request_type === 'team') {
            const [team] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [jr.team_id]);
            if (!team.length || team[0].captain_id !== uid) {
                return res.status(403).json({ error: 'Only the captain can manage team requests.' });
            }
        } else {
            const [game] = await pool.query('SELECT host_user_id FROM games WHERE game_id = ?', [jr.game_id]);
            if (!game.length || game[0].host_user_id !== uid) {
                return res.status(403).json({ error: 'Only the host can manage game requests.' });
            }
        }

        await pool.query('UPDATE join_requests SET request_status = ? WHERE request_id = ?', [request_status, req.params.id]);

        // If accepted, add to team_members or game_participants
        if (request_status === 'accepted') {
            if (jr.request_type === 'team') {
                await pool.query(
                    `INSERT IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, 'player')`,
                    [jr.team_id, jr.user_id]
                );
            } else {
                await pool.query(
                    `INSERT IGNORE INTO game_participants (game_id, user_id, participation_status) VALUES (?, ?, 'confirmed')`,
                    [jr.game_id, jr.user_id]
                );
                await pool.query(
                    'UPDATE games SET current_players = current_players + 1 WHERE game_id = ?',
                    [jr.game_id]
                );
            }
        }

        res.json({ message: `Request ${request_status}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
