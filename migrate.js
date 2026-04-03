// Run: node migrate.js
const pool = require('./config/db');

async function migrate() {
    const conn = await pool.getConnection();
    try {
        await conn.query(`CREATE TABLE IF NOT EXISTS game_waitlist (
            waitlist_id INT AUTO_INCREMENT PRIMARY KEY,
            game_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_wl (game_id, user_id)
        )`);

        await conn.query(`CREATE TABLE IF NOT EXISTS game_comments (
            comment_id INT AUTO_INCREMENT PRIMARY KEY,
            game_id INT NOT NULL,
            user_id INT NOT NULL,
            comment_text VARCHAR(500) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await conn.query(`CREATE TABLE IF NOT EXISTS team_challenges (
            challenge_id INT AUTO_INCREMENT PRIMARY KEY,
            challenger_team_id INT NOT NULL,
            challenged_team_id INT NOT NULL,
            game_id INT DEFAULT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            message VARCHAR(300),
            sport_id INT,
            location_id INT,
            proposed_date DATE,
            proposed_time TIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await conn.query(`CREATE TABLE IF NOT EXISTS invite_links (
            invite_id INT AUTO_INCREMENT PRIMARY KEY,
            token VARCHAR(64) NOT NULL UNIQUE,
            type VARCHAR(10) NOT NULL,
            target_id INT NOT NULL,
            created_by INT NOT NULL,
            max_uses INT DEFAULT 0,
            use_count INT DEFAULT 0,
            expires_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await conn.query(`CREATE TABLE IF NOT EXISTS rating_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            avg_rating DECIMAL(3,2) NOT NULL,
            review_count INT DEFAULT 0,
            snapshot_date DATE NOT NULL,
            UNIQUE KEY uq_rs (user_id, snapshot_date)
        )`);

        // Add columns to games
        const [gc] = await conn.query('SHOW COLUMNS FROM games');
        const gn = gc.map(c => c.Field);
        if (!gn.includes('is_recurring')) await conn.query('ALTER TABLE games ADD COLUMN is_recurring TINYINT DEFAULT 0');
        if (!gn.includes('recurrence_day')) await conn.query("ALTER TABLE games ADD COLUMN recurrence_day VARCHAR(20) DEFAULT NULL");
        if (!gn.includes('recurrence_parent_id')) await conn.query('ALTER TABLE games ADD COLUMN recurrence_parent_id INT DEFAULT NULL');

        // Add columns to users
        const [uc] = await conn.query('SHOW COLUMNS FROM users');
        const un = uc.map(c => c.Field);
        if (!un.includes('longest_streak')) await conn.query('ALTER TABLE users ADD COLUMN longest_streak INT DEFAULT 0');
        if (!un.includes('last_game_date')) await conn.query('ALTER TABLE users ADD COLUMN last_game_date DATE DEFAULT NULL');

        console.log('Migration complete!');
    } catch (e) {
        console.error('Migration error:', e.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
