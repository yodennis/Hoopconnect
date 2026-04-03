// ============================================================
// Team Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/sanitize');

// ---------- List / search teams ----------
router.get('/', async (req, res) => {
    try {
        const { sport_id, skill_level, status } = req.query;
        let sql = `SELECT t.*, s.sport_name, u.username AS captain_name, u.display_name AS captain_display,
                          l.location_name, l.city AS location_city,
                          (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.team_id AND tm.membership_status = 'active') AS member_count
                   FROM teams t
                   JOIN sports s ON t.sport_id = s.sport_id
                   JOIN users u ON t.captain_id = u.user_id
                   LEFT JOIN locations l ON t.location_id = l.location_id`;
        const conditions = [];
        const params = [];

        if (sport_id)    { conditions.push('t.sport_id = ?');    params.push(sport_id); }
        if (skill_level) { conditions.push('t.skill_level = ?'); params.push(skill_level); }
        if (status)      { conditions.push('t.team_status = ?'); params.push(status); }

        if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');

        const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/LEFT JOIN locations.*/, '');
        const [[{ total }]] = await pool.query(countSql, params);

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query(sql, params);
        res.json({ teams: rows, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Single team ----------
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.*, s.sport_name, u.username AS captain_name, u.display_name AS captain_display,
                    l.location_name, l.city AS location_city
             FROM teams t
             JOIN sports s ON t.sport_id = s.sport_id
             JOIN users u ON t.captain_id = u.user_id
             LEFT JOIN locations l ON t.location_id = l.location_id
             WHERE t.team_id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Team not found.' });

        const [members] = await pool.query(
            `SELECT tm.*, u.username, u.display_name, u.skill_level
             FROM team_members tm JOIN users u ON tm.user_id = u.user_id
             WHERE tm.team_id = ? AND tm.membership_status = 'active'
             ORDER BY tm.role DESC, tm.joined_at`,
            [req.params.id]
        );

        res.json({ ...rows[0], members });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Create team ----------
router.post('/', requireAuth, sanitizeInput({
    team_name: { type: 'text', min: 1, max: 100 },
    sport_id: 'integer',
    location_id: 'integer',
    description: 'text',
    skill_level: { type: 'text', options: ['beginner', 'intermediate', 'advanced', 'any'] },
    max_players: { type: 'integer', min: 2, max: 50 }
}), async (req, res) => {
    try {
        const { team_name, sport_id, location_id, description, skill_level, max_players } = req.body;
        const captain_id = req.session.user.user_id;

        // Enforce 2-team limit (Pro members bypass)
        const [proCheck] = await pool.query('SELECT is_pro FROM users WHERE user_id = ?', [captain_id]);
        const isPro = proCheck[0]?.is_pro;
        const [existing] = await pool.query(
            `SELECT COUNT(*) AS cnt FROM team_members WHERE user_id = ? AND membership_status = 'active'`,
            [captain_id]
        );
        if (!isPro && existing[0].cnt >= 2) {
            return res.status(400).json({ error: 'You can only be on a maximum of 2 teams. Upgrade to Pro for unlimited teams!' });
        }

        const [result] = await pool.query(
            `INSERT INTO teams (team_name, sport_id, captain_id, location_id, description, skill_level, max_players)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [team_name, sport_id, captain_id, location_id || null, description || null, skill_level || 'any', max_players || 15]
        );

        // Auto-add captain as member
        await pool.query(
            `INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'captain')`,
            [result.insertId, captain_id]
        );

        res.json({ message: 'Team created.', team_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Leave team ----------
router.delete('/:id/leave', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const tid = req.params.id;

        // Captain cannot just leave
        const [team] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [tid]);
        if (team.length && team[0].captain_id === uid) {
            return res.status(400).json({ error: 'Captain cannot leave the team. Transfer ownership first.' });
        }

        await pool.query(
            `UPDATE team_members SET membership_status = 'inactive' WHERE team_id = ? AND user_id = ?`,
            [tid, uid]
        );
        res.json({ message: 'You left the team.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Transfer captain ----------
router.put('/:id/transfer', requireAuth, sanitizeInput({
    new_captain_id: 'integer'
}), async (req, res) => {
    try {
        const { new_captain_id } = req.body;

        const tid = req.params.id;
        const uid = req.session.user.user_id;

        const [team] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [tid]);
        if (!team.length) return res.status(404).json({ error: 'Team not found.' });
        if (team[0].captain_id !== uid) {
            return res.status(403).json({ error: 'Only the captain can transfer ownership.' });
        }

        // Verify new captain is an active member
        const [member] = await pool.query(
            `SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ? AND membership_status = 'active'`,
            [tid, new_captain_id]
        );
        if (!member.length) return res.status(400).json({ error: 'New captain must be an active team member.' });

        // Update team captain
        await pool.query('UPDATE teams SET captain_id = ? WHERE team_id = ?', [new_captain_id, tid]);
        // Swap roles in team_members
        await pool.query(`UPDATE team_members SET role = 'member' WHERE team_id = ? AND user_id = ?`, [tid, uid]);
        await pool.query(`UPDATE team_members SET role = 'captain' WHERE team_id = ? AND user_id = ?`, [tid, new_captain_id]);

        res.json({ message: 'Captain transferred successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Delete team ----------
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const tid = req.params.id;
        const [team] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [tid]);
        if (!team.length) return res.status(404).json({ error: 'Team not found.' });
        if (team[0].captain_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the captain can delete this team.' });
        }

        await pool.query('DELETE FROM team_members WHERE team_id = ?', [tid]);
        await pool.query('DELETE FROM teams WHERE team_id = ?', [tid]);
        res.json({ message: 'Team deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
