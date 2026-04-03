// ============================================================
// Invite Link Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Create invite link
router.post('/', requireAuth, async (req, res) => {
    try {
        const { type, target_id, max_uses } = req.body;
        if (!type || !target_id) return res.status(400).json({ error: 'Type and target_id are required.' });
        if (!['game', 'team'].includes(type)) return res.status(400).json({ error: 'Type must be game or team.' });

        const uid = req.session.user.user_id;

        // Verify ownership
        if (type === 'game') {
            const [game] = await pool.query('SELECT host_user_id FROM games WHERE game_id = ?', [target_id]);
            if (!game.length) return res.status(404).json({ error: 'Game not found.' });
            if (game[0].host_user_id !== uid) return res.status(403).json({ error: 'Only the host can create invite links.' });
        } else {
            const [team] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [target_id]);
            if (!team.length) return res.status(404).json({ error: 'Team not found.' });
            if (team[0].captain_id !== uid) return res.status(403).json({ error: 'Only the captain can create invite links.' });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await pool.query(
            'INSERT INTO invite_links (token, type, target_id, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [token, type, target_id, uid, max_uses || 0, expiresAt]
        );

        res.json({ token, url: `/invite/${token}`, expires_at: expiresAt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Use invite link
router.post('/use/:token', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM invite_links WHERE token = ?', [req.params.token]);
        if (!rows.length) return res.status(404).json({ error: 'Invalid invite link.' });

        const invite = rows[0];
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return res.status(410).json({ error: 'This invite link has expired.' });
        }
        if (invite.max_uses > 0 && invite.use_count >= invite.max_uses) {
            return res.status(410).json({ error: 'This invite link has reached its usage limit.' });
        }

        const uid = req.session.user.user_id;

        if (invite.type === 'game') {
            // Auto-join game
            const [game] = await pool.query('SELECT * FROM games WHERE game_id = ?', [invite.target_id]);
            if (!game.length) return res.status(404).json({ error: 'Game no longer exists.' });

            const [existing] = await pool.query(
                'SELECT user_id FROM game_participants WHERE game_id = ? AND user_id = ?',
                [invite.target_id, uid]
            );
            if (existing.length) return res.json({ message: 'You are already in this game.', redirect: `/game/${invite.target_id}` });

            await pool.query(
                `INSERT INTO game_participants (game_id, user_id, participation_status) VALUES (?, ?, 'confirmed')`,
                [invite.target_id, uid]
            );
            await pool.query('UPDATE games SET current_players = current_players + 1 WHERE game_id = ?', [invite.target_id]);
        } else {
            // Auto-join team
            const [existing] = await pool.query(
                `SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ? AND membership_status = 'active'`,
                [invite.target_id, uid]
            );
            if (existing.length) return res.json({ message: 'You are already on this team.', redirect: `/team/${invite.target_id}` });

            await pool.query(
                `INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')
                 ON DUPLICATE KEY UPDATE membership_status = 'active', role = 'member'`,
                [invite.target_id, uid]
            );
        }

        await pool.query('UPDATE invite_links SET use_count = use_count + 1 WHERE invite_id = ?', [invite.invite_id]);

        const redirect = invite.type === 'game' ? `/game/${invite.target_id}` : `/team/${invite.target_id}`;
        res.json({ message: 'Joined successfully!', redirect });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Get invite info (public, for preview)
router.get('/:token', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT type, target_id, expires_at, max_uses, use_count FROM invite_links WHERE token = ?', [req.params.token]);
        if (!rows.length) return res.status(404).json({ error: 'Invalid invite.' });

        const invite = rows[0];
        let details = {};
        if (invite.type === 'game') {
            const [game] = await pool.query('SELECT game_title, game_date, sport_id FROM games WHERE game_id = ?', [invite.target_id]);
            details = game[0] || {};
        } else {
            const [team] = await pool.query('SELECT team_name, sport_id FROM teams WHERE team_id = ?', [invite.target_id]);
            details = team[0] || {};
        }

        res.json({ ...invite, details });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
