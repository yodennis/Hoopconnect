-- ============================================================
-- HoopConnect - Community Sports Meetup Platform
-- Database Schema (MySQL / MariaDB)
-- ============================================================

CREATE DATABASE IF NOT EXISTS hoopconnect;
USE hoopconnect;

-- 1. USERS
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name    VARCHAR(50)  NOT NULL,
    last_name     VARCHAR(50)  DEFAULT NULL,
    display_name  VARCHAR(100) DEFAULT NULL,
    age           INT          DEFAULT NULL,
    city          VARCHAR(100) DEFAULT NULL,
    state         VARCHAR(50)  DEFAULT NULL,
    bio           TEXT         DEFAULT NULL,
    skill_level   ENUM('beginner', 'intermediate', 'advanced', 'any') DEFAULT 'any',
    availability  VARCHAR(255) DEFAULT NULL,
    profile_image VARCHAR(255) DEFAULT NULL,
    agreed_to_terms TINYINT(1) NOT NULL DEFAULT 0,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 1.5. PASSWORD RESET TOKENS
CREATE TABLE password_reset_tokens (
    token_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     DEFAULT NULL,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_expires (user_id, expires_at)
);

-- 2. SPORTS
CREATE TABLE sports (
    sport_id   INT AUTO_INCREMENT PRIMARY KEY,
    sport_name VARCHAR(50) NOT NULL UNIQUE
);

-- 3. USER_SPORTS (junction)
CREATE TABLE user_sports (
    user_sport_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    sport_id      INT NOT NULL,
    UNIQUE KEY unique_user_sport (user_id, sport_id),
    FOREIGN KEY (user_id)  REFERENCES users(user_id)  ON DELETE CASCADE,
    FOREIGN KEY (sport_id) REFERENCES sports(sport_id) ON DELETE CASCADE
);

-- 4. LOCATIONS (with lat/lng for map)
CREATE TABLE locations (
    location_id    INT AUTO_INCREMENT PRIMARY KEY,
    location_name  VARCHAR(150) NOT NULL,
    address        VARCHAR(255) DEFAULT NULL,
    city           VARCHAR(100) NOT NULL,
    state          VARCHAR(50)  NOT NULL,
    zip_code       VARCHAR(10)  DEFAULT NULL,
    latitude       DECIMAL(10,7) DEFAULT NULL,
    longitude      DECIMAL(10,7) DEFAULT NULL,
    indoor_outdoor ENUM('indoor', 'outdoor', 'both') DEFAULT 'outdoor',
    notes          TEXT         DEFAULT NULL,
    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- 5. LOCATION_SPORTS (junction)
CREATE TABLE location_sports (
    location_sport_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id       INT NOT NULL,
    sport_id          INT NOT NULL,
    UNIQUE KEY unique_location_sport (location_id, sport_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE,
    FOREIGN KEY (sport_id)    REFERENCES sports(sport_id)       ON DELETE CASCADE
);

-- 6. TEAMS
CREATE TABLE teams (
    team_id      INT AUTO_INCREMENT PRIMARY KEY,
    team_name    VARCHAR(100) NOT NULL,
    sport_id     INT          NOT NULL,
    captain_id   INT          NOT NULL,
    location_id  INT          DEFAULT NULL,
    description  TEXT         DEFAULT NULL,
    skill_level  ENUM('beginner', 'intermediate', 'advanced', 'any') DEFAULT 'any',
    max_players  INT          DEFAULT 15,
    team_status  ENUM('open', 'full', 'closed') DEFAULT 'open',
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sport_id)    REFERENCES sports(sport_id)       ON DELETE RESTRICT,
    FOREIGN KEY (captain_id)  REFERENCES users(user_id)         ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
);

-- 7. TEAM_MEMBERS (junction)
CREATE TABLE team_members (
    team_member_id    INT AUTO_INCREMENT PRIMARY KEY,
    team_id           INT NOT NULL,
    user_id           INT NOT NULL,
    role              ENUM('captain', 'player', 'organizer') DEFAULT 'player',
    joined_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    membership_status ENUM('active', 'inactive', 'removed') DEFAULT 'active',
    UNIQUE KEY unique_team_user (team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 8. GAMES
CREATE TABLE games (
    game_id         INT AUTO_INCREMENT PRIMARY KEY,
    game_title      VARCHAR(150) NOT NULL,
    sport_id        INT          NOT NULL,
    host_user_id    INT          NOT NULL,
    team_id         INT          DEFAULT NULL,
    location_id     INT          NOT NULL,
    game_date       DATE         NOT NULL,
    start_time      TIME         NOT NULL,
    end_time        TIME         DEFAULT NULL,
    skill_level     ENUM('beginner', 'intermediate', 'advanced', 'any') DEFAULT 'any',
    max_players     INT          DEFAULT 10,
    current_players INT          DEFAULT 0,
    status          ENUM('open', 'full', 'cancelled', 'completed') DEFAULT 'open',
    description     TEXT         DEFAULT NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sport_id)     REFERENCES sports(sport_id)       ON DELETE RESTRICT,
    FOREIGN KEY (host_user_id) REFERENCES users(user_id)         ON DELETE CASCADE,
    FOREIGN KEY (team_id)      REFERENCES teams(team_id)         ON DELETE SET NULL,
    FOREIGN KEY (location_id)  REFERENCES locations(location_id) ON DELETE RESTRICT
);

-- 9. GAME_PARTICIPANTS (junction)
CREATE TABLE game_participants (
    game_participant_id  INT AUTO_INCREMENT PRIMARY KEY,
    game_id              INT NOT NULL,
    user_id              INT NOT NULL,
    participation_status ENUM('confirmed', 'pending', 'declined', 'no_show') DEFAULT 'confirmed',
    joined_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_game_user (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 10. JOIN_REQUESTS
CREATE TABLE join_requests (
    request_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    team_id        INT DEFAULT NULL,
    game_id        INT DEFAULT NULL,
    request_type   ENUM('team', 'game') NOT NULL,
    message        TEXT DEFAULT NULL,
    request_status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);

-- 11. REVIEWS (player ratings & comments)
CREATE TABLE reviews (
    review_id    INT AUTO_INCREMENT PRIMARY KEY,
    reviewer_id  INT NOT NULL,
    reviewed_id  INT NOT NULL,
    rating       TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT DEFAULT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_review (reviewer_id, reviewed_id),
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 12. REPORTS
CREATE TABLE reports (
    report_id        INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id      INT  NOT NULL,
    reported_user_id INT DEFAULT NULL,
    reported_team_id INT DEFAULT NULL,
    reported_game_id INT DEFAULT NULL,
    reason           TEXT NOT NULL,
    report_status    ENUM('open', 'reviewed', 'resolved', 'dismissed') DEFAULT 'open',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id)      REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reported_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (reported_team_id) REFERENCES teams(team_id) ON DELETE SET NULL,
    FOREIGN KEY (reported_game_id) REFERENCES games(game_id) ON DELETE SET NULL
);
