// ============================================================
// Game Routes
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');
const { asyncHandler, handleDatabaseError, validationError } = require('../middleware/errorHandler');
const { sanitizeInput } = require('../middleware/sanitize');

// ---------- List / search games ----------
// Cache only for simple queries without filters (5 minute TTL)
router.get('/', asyncHandler(async (req, res) => {
    const { sport_id, city, skill_level, status, date, page, limit } = req.query;

    // Only cache if no filters are applied
    const hasFilters = sport_id || city || skill_level || status || date || (page && page !== '1') || (limit && limit !== '20');
    const useCache = !hasFilters;

    if (useCache) {
        res.set('X-Cache-Source', 'query-cache');
    }

    const cacheKey = hasFilters ? null : 'games:list:default';
    let sql = `SELECT g.*, s.sport_name, u.username AS host_name, u.display_name AS host_display,
                      l.location_name, l.city AS location_city, l.indoor_outdoor,
                      t.team_name
               FROM games g
               JOIN sports s ON g.sport_id = s.sport_id
               JOIN users u ON g.host_user_id = u.user_id
               JOIN locations l ON g.location_id = l.location_id
               LEFT JOIN teams t ON g.team_id = t.team_id`;
    const conditions = [];
    const params = [];

    if (sport_id)    { conditions.push('g.sport_id = ?');    params.push(sport_id); }
    if (city)        { conditions.push('l.city LIKE ?');     params.push(`%${city}%`); }
    if (skill_level) { conditions.push('g.skill_level = ?'); params.push(skill_level); }
    if (status)      { conditions.push('g.status = ?');      params.push(status); }
    if (date)        { conditions.push('g.game_date = ?');   params.push(date); }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');

    // Count total
    const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [[{ total }]] = await pool.query(countSql, params);

    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20)); // Max 100, min 1
    const offset = (pageNum - 1) * limitNum;

    sql += ' ORDER BY g.game_date ASC, g.start_time ASC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [rows] = await pool.cachedQuery(sql, params, cacheKey, 5 * 60 * 1000);
    res.json({ games: rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
}));

// ---------- My games (hosted by current user) ----------
router.get('/my-games', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [rows] = await pool.query(
            `SELECT g.*, s.sport_name, u.username AS host_name, u.display_name AS host_display,
                    l.location_name, l.city AS location_city, l.indoor_outdoor,
                    t.team_name
             FROM games g
             JOIN sports s ON g.sport_id = s.sport_id
             JOIN users u ON g.host_user_id = u.user_id
             JOIN locations l ON g.location_id = l.location_id
             LEFT JOIN teams t ON g.team_id = t.team_id
             WHERE g.host_user_id = ?
             ORDER BY g.game_date ASC, g.start_time ASC`,
            [uid]
        );
        res.json({ games: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Single game ----------
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT g.*, s.sport_name, u.username AS host_name, u.display_name AS host_display,
                    l.location_name, l.city AS location_city, l.address AS location_address,
                    l.indoor_outdoor, l.notes AS location_notes,
                    t.team_name
             FROM games g
             JOIN sports s ON g.sport_id = s.sport_id
             JOIN users u ON g.host_user_id = u.user_id
             JOIN locations l ON g.location_id = l.location_id
             LEFT JOIN teams t ON g.team_id = t.team_id
             WHERE g.game_id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Game not found.' });

        const [participants] = await pool.query(
            `SELECT gp.*, u.username, u.display_name, u.skill_level
             FROM game_participants gp JOIN users u ON gp.user_id = u.user_id
             WHERE gp.game_id = ?
             ORDER BY gp.joined_at`,
            [req.params.id]
        );

        res.json({ ...rows[0], participants });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Create game ----------
router.post('/', requireAuth, sanitizeInput({
    game_title: 'text',
    sport_id: 'integer',
    team_id: 'optional_integer',
    location_id: 'integer',
    game_date: 'date',
    start_time: 'time',
    end_time: 'optional_time',
    skill_level: 'enum:beginner,intermediate,advanced,any',
    max_players: 'integer:1,50',
    description: 'optional_text',
    is_recurring: 'boolean',
    recurrence_day: 'optional_enum:monday,tuesday,wednesday,thursday,friday,saturday,sunday'
}), asyncHandler(async (req, res) => {
    const { game_title, sport_id, team_id, location_id, game_date, start_time, end_time, skill_level, max_players, description } = req.body;

    // Validation
    if (!game_title || !sport_id || !location_id || !game_date || !start_time) {
        return validationError(res, 'required_fields', 'Title, sport, location, date, and start time are required.');
    }

    if (game_title.length > 100) {
        return validationError(res, 'game_title', 'Game title must be 100 characters or less.');
    }

    if (description && description.length > 500) {
        return validationError(res, 'description', 'Description must be 500 characters or less.');
    }

    const host_user_id = req.session.user.user_id;

    const { is_recurring, recurrence_day } = req.body;

    try {
        const [result] = await pool.query(
            `INSERT INTO games (game_title, sport_id, host_user_id, team_id, location_id,
             game_date, start_time, end_time, skill_level, max_players, current_players, description,
             is_recurring, recurrence_day)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [game_title, sport_id, host_user_id, team_id || null, location_id,
             game_date, start_time, end_time || null, skill_level || 'any', max_players || 10, description || null,
             is_recurring ? 1 : 0, recurrence_day || null]
        );

        // Auto-add host as participant
        await pool.query(
            `INSERT INTO game_participants (game_id, user_id, participation_status) VALUES (?, ?, 'confirmed')`,
            [result.insertId, host_user_id]
        );

        // Clear games cache since we added a new game
        pool.clearQueryCache();

        res.json({ message: 'Game created successfully.', game_id: result.insertId });
    } catch (err) {
        handleDatabaseError(res, err);
    }
}));

// ---------- Update game status ----------
router.put('/:id/status', requireAuth, sanitizeInput({
    status: 'enum:open,closed,cancelled,completed'
}), async (req, res) => {
    try {
        const { status } = req.body;
        const [game] = await pool.query('SELECT host_user_id FROM games WHERE game_id = ?', [req.params.id]);
        if (!game.length) return res.status(404).json({ error: 'Game not found.' });
        if (game[0].host_user_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the host can update game status.' });
        }

        await pool.query('UPDATE games SET status = ? WHERE game_id = ?', [status, req.params.id]);
        res.json({ message: 'Game status updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Transfer host ----------
router.put('/:id/transfer', requireAuth, sanitizeInput({
    new_host_id: 'integer'
}), async (req, res) => {
    try {
        const { new_host_id } = req.body;
        if (!new_host_id) return res.status(400).json({ error: 'New host user ID is required.' });

        const [game] = await pool.query('SELECT host_user_id FROM games WHERE game_id = ?', [req.params.id]);
        if (!game.length) return res.status(404).json({ error: 'Game not found.' });
        if (game[0].host_user_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the host can transfer hosting.' });
        }

        // Verify new host is a participant
        const [participant] = await pool.query(
            `SELECT user_id FROM game_participants WHERE game_id = ? AND user_id = ? AND participation_status = 'confirmed'`,
            [req.params.id, new_host_id]
        );
        if (!participant.length) return res.status(400).json({ error: 'New host must be a confirmed participant.' });

        await pool.query('UPDATE games SET host_user_id = ? WHERE game_id = ?', [new_host_id, req.params.id]);
        res.json({ message: 'Host transferred successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Delete game ----------
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const [game] = await pool.query('SELECT host_user_id FROM games WHERE game_id = ?', [req.params.id]);
        if (!game.length) return res.status(404).json({ error: 'Game not found.' });
        if (game[0].host_user_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the host can delete this game.' });
        }

        await pool.query('DELETE FROM game_participants WHERE game_id = ?', [req.params.id]);
        await pool.query('DELETE FROM games WHERE game_id = ?', [req.params.id]);
        res.json({ message: 'Game deleted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
