// ============================================================
// Tournament Routes — Pro feature bracket tournaments
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// ---------- List tournaments ----------
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, s.sport_name, u.username AS organizer_name, u.display_name AS organizer_display,
                   l.location_name, l.city AS location_city,
                   (SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.tournament_id) AS registered_teams
            FROM tournaments t
            JOIN sports s ON s.sport_id = t.sport_id
            JOIN users u ON u.user_id = t.organizer_id
            LEFT JOIN locations l ON l.location_id = t.location_id
            ORDER BY t.start_date ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Single tournament with bracket ----------
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, s.sport_name, u.username AS organizer_name, u.display_name AS organizer_display,
                   l.location_name, l.city AS location_city
            FROM tournaments t
            JOIN sports s ON s.sport_id = t.sport_id
            JOIN users u ON u.user_id = t.organizer_id
            LEFT JOIN locations l ON l.location_id = t.location_id
            WHERE t.tournament_id = ?
        `, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Tournament not found.' });

        const [teams] = await pool.query(`
            SELECT tt.*, tm.team_name, tm.captain_id
            FROM tournament_teams tt JOIN teams tm ON tm.team_id = tt.team_id
            WHERE tt.tournament_id = ? ORDER BY tt.seed
        `, [req.params.id]);

        const [matches] = await pool.query(`
            SELECT m.*, t1.team_name AS team1_name, t2.team_name AS team2_name, w.team_name AS winner_name
            FROM tournament_matches m
            LEFT JOIN teams t1 ON t1.team_id = m.team1_id
            LEFT JOIN teams t2 ON t2.team_id = m.team2_id
            LEFT JOIN teams w ON w.team_id = m.winner_id
            WHERE m.tournament_id = ?
            ORDER BY m.round_number, m.match_number
        `, [req.params.id]);

        res.json({ ...rows[0], teams, matches });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Create tournament (Pro only) ----------
router.post('/', requireAuth, async (req, res) => {
    try {
        const uid = req.session.user.user_id;
        const [[user]] = await pool.query('SELECT is_pro FROM users WHERE user_id = ?', [uid]);
        if (!user?.is_pro) return res.status(403).json({ error: 'Pro membership required to organize tournaments.' });

        const { tournament_name, sport_id, location_id, description, start_date, end_date, max_teams, team_size } = req.body;
        if (!tournament_name || !sport_id || !start_date) {
            return res.status(400).json({ error: 'Name, sport, and start date are required.' });
        }

        const [result] = await pool.query(`
            INSERT INTO tournaments (tournament_name, organizer_id, sport_id, location_id, description, start_date, end_date, max_teams, team_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [tournament_name, uid, sport_id, location_id || null, description || null, start_date, end_date || null, max_teams || 8, team_size || 5]);

        await pool.query(
            `INSERT INTO activity_feed (user_id, activity_type, reference_id, description) VALUES (?, 'tournament_created', ?, ?)`,
            [uid, result.insertId, `Created tournament: ${tournament_name}`]
        ).catch(() => {});

        res.json({ message: 'Tournament created.', tournament_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Register team for tournament ----------
router.post('/:id/register', requireAuth, async (req, res) => {
    try {
        const { team_id } = req.body;
        const tid = parseInt(req.params.id, 10);

        // Verify captain
        const [team] = await pool.query('SELECT captain_id FROM teams WHERE team_id = ?', [team_id]);
        if (!team.length || team[0].captain_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the team captain can register.' });
        }

        // Check tournament capacity
        const [tourney] = await pool.query('SELECT max_teams, status FROM tournaments WHERE tournament_id = ?', [tid]);
        if (!tourney.length) return res.status(404).json({ error: 'Tournament not found.' });
        if (tourney[0].status !== 'registration') return res.status(400).json({ error: 'Registration is closed.' });

        const [[count]] = await pool.query('SELECT COUNT(*) as cnt FROM tournament_teams WHERE tournament_id = ?', [tid]);
        if (count.cnt >= tourney[0].max_teams) return res.status(400).json({ error: 'Tournament is full.' });

        await pool.query('INSERT IGNORE INTO tournament_teams (tournament_id, team_id) VALUES (?, ?)', [tid, team_id]);
        res.json({ message: 'Team registered!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Generate bracket (organizer only) ----------
router.post('/:id/generate-bracket', requireAuth, async (req, res) => {
    try {
        const tid = parseInt(req.params.id, 10);
        const [tourney] = await pool.query('SELECT organizer_id FROM tournaments WHERE tournament_id = ?', [tid]);
        if (!tourney.length || tourney[0].organizer_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the organizer can generate the bracket.' });
        }

        const [teams] = await pool.query('SELECT team_id FROM tournament_teams WHERE tournament_id = ? ORDER BY RAND()', [tid]);
        if (teams.length < 2) return res.status(400).json({ error: 'Need at least 2 teams.' });

        // Clear existing matches
        await pool.query('DELETE FROM tournament_matches WHERE tournament_id = ?', [tid]);

        // Simple single-elimination bracket
        const numTeams = teams.length;
        let round = 1;
        let matchNum = 1;
        for (let i = 0; i < numTeams; i += 2) {
            const team1 = teams[i]?.team_id || null;
            const team2 = teams[i + 1]?.team_id || null;
            await pool.query(
                `INSERT INTO tournament_matches (tournament_id, round_number, match_number, team1_id, team2_id, status)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [tid, round, matchNum++, team1, team2, team2 ? 'pending' : 'completed']
            );
            // Auto-advance bye
            if (!team2 && team1) {
                await pool.query(
                    'UPDATE tournament_matches SET winner_id = ?, status = "completed" WHERE tournament_id = ? AND round_number = ? AND match_number = ?',
                    [team1, tid, round, matchNum - 1]
                );
            }
        }

        // Create future round placeholders
        let matchesInRound = Math.ceil(numTeams / 2);
        while (matchesInRound > 1) {
            round++;
            matchNum = 1;
            matchesInRound = Math.ceil(matchesInRound / 2);
            for (let i = 0; i < matchesInRound; i++) {
                await pool.query(
                    `INSERT INTO tournament_matches (tournament_id, round_number, match_number) VALUES (?, ?, ?)`,
                    [tid, round, matchNum++]
                );
            }
        }

        await pool.query('UPDATE tournaments SET status = "in_progress" WHERE tournament_id = ?', [tid]);
        res.json({ message: 'Bracket generated!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ---------- Update match result (organizer only) ----------
router.put('/:id/match/:matchId', requireAuth, async (req, res) => {
    try {
        const tid = parseInt(req.params.id, 10);
        const [tourney] = await pool.query('SELECT organizer_id FROM tournaments WHERE tournament_id = ?', [tid]);
        if (!tourney.length || tourney[0].organizer_id !== req.session.user.user_id) {
            return res.status(403).json({ error: 'Only the organizer can update matches.' });
        }

        const { team1_score, team2_score, winner_id } = req.body;
        await pool.query(`
            UPDATE tournament_matches SET team1_score = ?, team2_score = ?, winner_id = ?, status = 'completed'
            WHERE match_id = ? AND tournament_id = ?
        `, [team1_score, team2_score, winner_id, req.params.matchId, tid]);

        res.json({ message: 'Match updated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
