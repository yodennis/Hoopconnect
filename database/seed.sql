-- ============================================================
-- HoopConnect - Sample Seed Data
-- Run AFTER schema.sql
-- ============================================================

USE hoopconnect;

-- Sports
INSERT INTO sports (sport_name) VALUES
('Basketball'), ('Volleyball'), ('Soccer'), ('Football'),
('Tennis'), ('Baseball'), ('Softball'), ('Badminton'), ('Pickleball');

-- Locations with real coordinates for Virginia area
INSERT INTO locations (location_name, address, city, state, zip_code, latitude, longitude, indoor_outdoor, notes) VALUES
('Jefferson Park Courts',      '300 Jefferson Ave',   'Richmond',         'VA', '23220', 37.5407, -77.4360, 'outdoor', 'Two full courts, lights until 10 PM'),
('Riverside Rec Center',       '500 Riverside Dr',    'Petersburg',       'VA', '23803', 37.2279, -77.4019, 'indoor',  'Indoor gym with 2 courts, sign in at desk'),
('Millwood Park Fields',       '120 Millwood Rd',     'Ettrick',          'VA', '23803', 37.2362, -77.4258, 'outdoor', 'Soccer and football fields, open dawn to dusk'),
('Community Center Gym',       '45 Main St',          'Colonial Heights', 'VA', '23834', 37.2440, -77.4103, 'indoor',  'Volleyball nets available, reservation recommended'),
('Oakwood Tennis Complex',     '780 Oakwood Blvd',    'Richmond',         'VA', '23222', 37.5714, -77.4311, 'outdoor', '6 tennis courts, first come first served'),
('Lakeview Park',              '200 Lakeview Dr',     'Chester',          'VA', '23831', 37.3574, -77.3873, 'outdoor', 'Open fields, great for soccer and football'),
('Trojan Fitness Center',      '1 Hayden Dr',         'Ettrick',          'VA', '23803', 37.2345, -77.4109, 'indoor',  'Campus gym, basketball and volleyball courts'),
('Bryan Park Courts',          '4308 Hermitage Rd',   'Richmond',         'VA', '23227', 37.5880, -77.4570, 'outdoor', 'Great basketball courts near Azalea Garden'),
('Pocahontas State Park',      '10301 State Park Rd', 'Chesterfield',     'VA', '23832', 37.3740, -77.5730, 'outdoor', 'Large open fields for pickup games'),
('Hardywood Sports Complex',   '2200 Ownby Lane',     'Richmond',         'VA', '23220', 37.5550, -77.4480, 'both',    'Indoor courts and outdoor turf fields');

-- Link locations to sports
INSERT INTO location_sports (location_id, sport_id) VALUES
(1,1),(2,1),(2,2),(3,3),(3,4),(4,2),(5,5),(6,3),(6,4),(7,1),(7,2),
(8,1),(9,3),(9,4),(10,1),(10,2),(10,3);

-- Users (passwords are bcrypt hashes of 'password123')
INSERT INTO users (username, email, password_hash, first_name, last_name, display_name, age, city, state, bio, skill_level, availability, agreed_to_terms) VALUES
('jthompson', 'jthompson@email.com', '$2b$10$dummyhashvaluehere000000000000000000000000000000', 'Jamal',    'Thompson', 'Jamal T.',    22, 'Richmond',         'VA', 'Hoops every weekend. Lets run it.',                'advanced',     'Weekends, evenings',         1),
('maria_s',   'maria@email.com',    '$2b$10$dummyhashvaluehere000000000000000000000000000000', 'Maria',    'Santos',   'Maria S.',    20, 'Petersburg',       'VA', 'Soccer is life! Also play volleyball.',             'intermediate', 'Mon-Wed-Fri afternoons',     1),
('bwilliams', 'bwill@email.com',    '$2b$10$dummyhashvaluehere000000000000000000000000000000', 'Brandon',  'Williams', 'B. Will',     24, 'Colonial Heights', 'VA', 'Casual baller, just here to have fun.',             'beginner',     'Flexible',                   1),
('ashley_k',  'ashleyk@email.com',  '$2b$10$dummyhashvaluehere000000000000000000000000000000', 'Ashley',   'Kim',      'Ash K.',      21, 'Ettrick',          'VA', 'Volleyball captain. Looking for community games.',  'advanced',     'Weekends',                   1),
('devontae',  'devontae@email.com', '$2b$10$dummyhashvaluehere000000000000000000000000000000', 'Devontae', 'Harris',   'Devontae H.', 23, 'Richmond',         'VA', 'Football and basketball. Down for any sport.',      'intermediate', 'Evenings after 5',           1),
('sarahj',    'sarahj@email.com',   '$2b$10$dummyhashvaluehere000000000000000000000000000000', 'Sarah',    'Johnson',  'Sarah J.',    19, 'Chester',          'VA', 'Tennis player looking for doubles partners.',       'intermediate', 'Weekday mornings, weekends', 1);

-- User sport preferences
INSERT INTO user_sports (user_id, sport_id) VALUES
(1,1),(1,4),(2,3),(2,2),(3,1),(4,2),(4,1),(5,4),(5,1),(6,5);

-- Teams
INSERT INTO teams (team_name, sport_id, captain_id, location_id, description, skill_level, max_players, team_status) VALUES
('RVA Ballers',     1, 1, 1, 'Richmond pickup basketball crew. Every Saturday.',         'intermediate', 10, 'open'),
('Tri-City Kickz',  3, 2, 3, 'Co-ed soccer team in the Petersburg area.',                'intermediate', 16, 'open'),
('Spikers United',  2, 4, 4, 'Volleyball squad for weekend games and tournaments.',      'advanced',     12, 'open'),
('Gridiron Casual', 4, 5, 6, 'Flag football crew. No tackle, just fun.',                 'beginner',     14, 'open'),
('Doubles Club',    5, 6, 5, 'Tennis doubles group. All skill levels welcome.',           'any',           8, 'open');

-- Team members
INSERT INTO team_members (team_id, user_id, role) VALUES
(1,1,'captain'),(1,3,'player'),(1,5,'player'),
(2,2,'captain'),(2,3,'player'),
(3,4,'captain'),(3,2,'player'),
(4,5,'captain'),(4,1,'player'),
(5,6,'captain');

-- Games
INSERT INTO games (game_title, sport_id, host_user_id, team_id, location_id, game_date, start_time, end_time, skill_level, max_players, current_players, status, description) VALUES
('Saturday Hoops at Jefferson',  1, 1, 1, 1, '2026-04-04', '15:00', '17:00', 'intermediate', 10, 4, 'open', 'Pickup basketball — first to 21. Need 6 more!'),
('Sunday Soccer Scrimmage',      3, 2, 2, 3, '2026-04-05', '10:00', '12:00', 'intermediate', 16, 3, 'open', 'Casual 8v8 soccer scrimmage. Bring water!'),
('Volleyball Night',             2, 4, 3, 4, '2026-04-04', '18:00', '20:00', 'advanced',     12, 3, 'open', 'Indoor volleyball. Competitive but friendly.'),
('Flag Football Meetup',         4, 5, 4, 6, '2026-04-06', '14:00', '16:00', 'beginner',     14, 2, 'open', 'Casual flag football. No experience needed.'),
('Tennis Doubles Mixer',         5, 6, 5, 5, '2026-04-05', '09:00', '11:00', 'any',           8, 1, 'open', 'Rotating doubles partners. Social tennis.'),
('Open Basketball Run',          1, 5, NULL,1,'2026-04-11', '16:00', '18:00', 'any',          10, 1, 'open', 'Open run, no team needed. Just show up.');

-- Game participants
INSERT INTO game_participants (game_id, user_id, participation_status) VALUES
(1,1,'confirmed'),(1,3,'confirmed'),(1,5,'confirmed'),(1,4,'pending'),
(2,2,'confirmed'),(2,3,'confirmed'),(2,6,'pending'),
(3,4,'confirmed'),(3,2,'confirmed'),
(4,5,'confirmed'),(4,1,'confirmed'),
(5,6,'confirmed'),
(6,5,'confirmed');

-- Join requests
INSERT INTO join_requests (user_id, team_id, game_id, request_type, message, request_status) VALUES
(6, 1, NULL, 'team', 'I play basketball casually. Would love to join!', 'pending'),
(3, 3, NULL, 'team', 'Been playing volleyball for a year. Can I try out?', 'pending'),
(4, NULL, 1, 'game', 'Looks fun! I will be at Jefferson Park.', 'pending'),
(6, NULL, 2, 'game', 'Can I join? Still learning but I will try hard.', 'pending');

-- Reports
INSERT INTO reports (reporter_id, reported_user_id, reason, report_status) VALUES
(2, NULL, 'Spam account posting fake games in the Petersburg area.', 'open');
