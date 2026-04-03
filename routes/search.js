// ============================================================
// Global Search Routes — Find games, courts, players, teams
// ============================================================
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { sanitizeInput } = require('../middleware/sanitize');

// Enhanced search with filters
router.get('/', sanitizeInput({
    q: 'optional_text',
    type: 'optional_enum:all,games,courts,players,teams',
    sport_id: 'optional_integer',
    city: 'optional_text',
    latitude: 'optional_latitude',
    longitude: 'optional_longitude',
    distance: 'optional_integer:1,100',
    limit: 'optional_integer:1,100'
}), async (req, res) => {
    try {
        const { q, type = 'all', sport_id, city, latitude, longitude, distance, limit = 20 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.json({ 
                results: [],
                total: 0,
                message: 'Search query must be at least 2 characters'
            });
        }

        const term = `%${q.trim()}%`;
        const results = {
            players: [],
            games: [],
            teams: [],
            courts: [],
            total: 0
        };

        // Search players
        if (type === 'all' || type === 'players') {
            const [players] = await pool.query(
                `SELECT user_id, username, display_name, first_name, city, skill_level, profile_image, is_pro,
                        (SELECT AVG(rating) FROM reviews WHERE reviewed_id = u.user_id) as avg_rating
                 FROM users u
                 WHERE (username LIKE ? OR first_name LIKE ? OR display_name LIKE ?) AND is_admin = 0
                 ORDER BY is_pro DESC, avg_rating DESC LIMIT ?`,
                [term, term, term, Math.min(limit, 20)]
            );
            results.players = players;
            results.total += players.length;
        }

        // Search games
        if (type === 'all' || type === 'games') {
            let gameSql = `SELECT g.game_id, g.game_title, g.game_date, g.game_date, g.status, g.current_players, g.max_players,
                                  s.sport_name, l.location_name, l.city, u.username as host_name
                           FROM games g 
                           JOIN sports s ON g.sport_id = s.sport_id 
                           JOIN locations l ON g.location_id = l.location_id
                           JOIN users u ON g.host_user_id = u.user_id
                           WHERE (g.game_title LIKE ? OR l.location_name LIKE ?) AND g.status = 'open'`;
            const gameParams = [term, term];

            if (sport_id) {
                gameSql += ` AND g.sport_id = ?`;
                gameParams.push(sport_id);
            }
            if (city) {
                gameSql += ` AND l.city LIKE ?`;
                gameParams.push(`%${city}%`);
            }
            gameSql += ` ORDER BY g.game_date ASC LIMIT ?`;
            gameParams.push(Math.min(limit, 20));

            const [games] = await pool.query(gameSql, gameParams);
            results.games = games;
            results.total += games.length;
        }

        // Search teams
        if (type === 'all' || type === 'teams') {
            const [teams] = await pool.query(
                `SELECT t.team_id, t.team_name, t.sport_id, s.sport_name, t.skill_level, t.team_status,
                        COUNT(tm.user_id) as member_count
                 FROM teams t
                 JOIN sports s ON t.sport_id = s.sport_id
                 LEFT JOIN team_members tm ON t.team_id = tm.team_id
                 WHERE t.team_name LIKE ? AND t.team_status = 'open'
                 GROUP BY t.team_id
                 ORDER BY member_count DESC LIMIT ?`,
                [term, Math.min(limit, 20)]
            );
            results.teams = teams;
            results.total += teams.length;
        }

        // Search courts
        if (type === 'all' || type === 'courts') {
            let courtSql = `SELECT l.location_id, l.location_name, l.city, l.state, l.indoor_outdoor,
                                   GROUP_CONCAT(s.sport_name) as sports,
                                   COUNT(DISTINCT g.game_id) as upcoming_games
                            FROM locations l
                            LEFT JOIN location_sports ls ON l.location_id = ls.location_id
                            LEFT JOIN sports s ON ls.sport_id = s.sport_id
                            LEFT JOIN games g ON l.location_id = g.location_id AND g.game_date > NOW() AND g.status = 'open'
                            WHERE l.location_name LIKE ? OR l.address LIKE ?`;
            const courtParams = [term, term];

            if (city) {
                courtSql += ` AND l.city LIKE ?`;
                courtParams.push(`%${city}%`);
            }
            
            courtSql += ` GROUP BY l.location_id ORDER BY upcoming_games DESC LIMIT ?`;
            courtParams.push(Math.min(limit, 20));

            const [courts] = await pool.query(courtSql, courtParams);
            results.courts = courts;
            results.total += courts.length;
        }

        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
