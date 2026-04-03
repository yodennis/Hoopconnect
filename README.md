# PickupPlay — Community Sports Meetup Platform

A database-driven web application that helps local community members find sports games, create teams, and organize casual meetups at public parks, courts, and gyms.

---

## Project Concept

PickupPlay solves a real problem: many people want to play sports casually but don't know where to go, who's playing, or whether a group needs extra players. This app gives people one place to:

- Find sports games happening nearby
- Create and join teams
- Schedule meetups at local parks and courts
- Request to join games or teams that need more players
- Manage rosters, participants, and join requests

**This is not a professional sports platform.** It's designed for local students, community members, and casual athletes looking for pickup games.

---

## Tech Stack

| Layer      | Technology            |
|------------|-----------------------|
| Frontend   | HTML, CSS, JavaScript |
| Backend    | Node.js + Express     |
| Database   | MySQL                 |
| Auth       | bcrypt + express-session |

---

## Database Design

### Tables (11 total)

| Table               | Purpose |
|---------------------|---------|
| `users`             | Registered user accounts and profiles |
| `sports`            | Normalized sport names (basketball, soccer, etc.) |
| `user_sports`       | Which sports each user prefers (many-to-many) |
| `locations`         | Public venues — parks, courts, gyms, fields |
| `location_sports`   | Which sports each location supports (many-to-many) |
| `teams`             | Teams created by users |
| `team_members`      | Team roster — users on each team (many-to-many) |
| `games`             | Scheduled games/meetups at locations |
| `game_participants` | Who is attending each game (many-to-many) |
| `join_requests`     | Requests to join teams or games |
| `reports`           | Safety reports for moderation |

### Key Relationships

```
users ──< user_sports >── sports
users ──< team_members >── teams
users ──< game_participants >── games
users ──< join_requests >── teams / games
teams ──> sports (FK)
teams ──> users (captain FK)
teams ──> locations (optional home FK)
games ──> sports (FK)
games ──> users (host FK)
games ──> locations (FK)
games ──> teams (optional FK)
locations ──< location_sports >── sports
```

### Why Each Table Is Needed

- **users**: Every action requires a user — creating teams, joining games, submitting requests.
- **sports**: Prevents inconsistent sport names (e.g., "bball" vs "Basketball"). Used as FK in teams, games, and preferences.
- **user_sports**: A user can like multiple sports; a sport has many fans. Many-to-many requires a junction table.
- **locations**: Games happen at real places. Separating locations from games allows one park to host many games.
- **location_sports**: A park can support basketball AND soccer. Many-to-many junction.
- **teams**: Core entity — users create teams, other users join them.
- **team_members**: One team has many players; one player can be on multiple teams. Many-to-many junction.
- **games**: Core entity — scheduled events with date, time, location, and player limits.
- **game_participants**: Tracks attendance separately from the game record. Many-to-many junction.
- **join_requests**: Models the approval workflow — a user requests to join, the captain/host accepts or rejects.
- **reports**: Safety feature — users can report harassment or inappropriate behavior.

### Locations vs. Games (No Overlap)

- `locations` = the **place** (Jefferson Park Basketball Court)
- `games` = an **event** at that place (Saturday 3 PM game, Sunday 5 PM game)
- Both Sunday and Saturday games reference the same `location_id`

---

## Features

### Core (MVP)
- User registration/login with Terms of Use agreement
- User profiles with preferred sports, skill level, bio, and availability
- Create and browse teams (filter by sport, skill, status)
- Create and browse games/meetups (filter by sport, city, date, skill)
- Browse locations (filter by city, sport, indoor/outdoor)
- Join request system (request to join teams or games)
- Accept/reject join requests (captain/host approval)
- Team rosters and game participant lists
- Dashboard with upcoming games, teams, and pending requests
- Report system for safety/moderation

### Safety & Privacy
- Only public locations (parks, courts, gyms) — no private addresses
- Usernames/display names shown instead of full personal info
- Terms of Use and Safety Guidelines page
- Required agreement to terms during registration
- Report/flag system for inappropriate behavior
- Organizers control who joins (approval workflow)
- No phone numbers or private data exposed publicly
- Disclaimer of liability for in-person meetups

---

## Pages

### Public
| Page | URL |
|------|-----|
| Home | `/` |
| About | `/about` |
| Terms & Safety | `/terms` |
| Browse Games | `/browse/games` |
| Browse Teams | `/browse/teams` |
| Browse Locations | `/browse/locations` |
| Team Detail | `/team/:id` |
| Game Detail | `/game/:id` |
| Login | `/login` |
| Register | `/register` |

### Authenticated
| Page | URL |
|------|-----|
| Dashboard | `/dashboard` |
| My Profile | `/profile` |
| Edit Profile | `/profile/edit` |
| Create Team | `/create/team` |
| Create Game | `/create/game` |
| My Requests | `/my/requests` |

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Log in
- `POST /api/auth/logout` — Log out
- `GET  /api/auth/me` — Current session user

### Users
- `GET  /api/users/profile` — My profile (auth)
- `GET  /api/users/:id` — Public user info
- `PUT  /api/users/profile` — Update my profile (auth)

### Sports
- `GET  /api/sports` — List all sports

### Locations
- `GET  /api/locations` — List/search locations
- `GET  /api/locations/:id` — Single location
- `POST /api/locations` — Create location (auth)

### Teams
- `GET  /api/teams` — List/search teams
- `GET  /api/teams/:id` — Team detail + roster
- `POST /api/teams` — Create team (auth)
- `DELETE /api/teams/:id/leave` — Leave team (auth)

### Games
- `GET  /api/games` — List/search games
- `GET  /api/games/:id` — Game detail + participants
- `POST /api/games` — Create game (auth)
- `PUT  /api/games/:id/status` — Update game status (auth, host only)

### Join Requests
- `POST /api/requests` — Submit join request (auth)
- `GET  /api/requests/incoming` — Requests for my teams/games (auth)
- `GET  /api/requests/mine` — My outgoing requests (auth)
- `PUT  /api/requests/:id` — Accept/reject request (auth)

### Reports
- `POST /api/reports` — Submit safety report (auth)

---

## Project Structure

```
my-website/
├── server.js                  # Express server entry point
├── package.json               # Dependencies
├── .env                       # Environment variables (not committed)
├── .env.example               # Template for .env
├── .gitignore
├── config/
│   └── db.js                  # MySQL connection pool
├── middleware/
│   └── auth.js                # requireAuth middleware
├── routes/
│   ├── auth.js                # Register/Login/Logout
│   ├── users.js               # Profile endpoints
│   ├── sports.js              # Sports list
│   ├── locations.js           # Location CRUD + search
│   ├── teams.js               # Team CRUD + search
│   ├── games.js               # Game CRUD + search
│   ├── requests.js            # Join request workflow
│   ├── reports.js             # Safety reports
│   └── pages.js               # HTML page serving
├── database/
│   ├── schema.sql             # CREATE TABLE statements
│   └── seed.sql               # Sample data
└── public/
    ├── index.html             # Home page
    ├── about.html
    ├── terms.html
    ├── login.html
    ├── register.html
    ├── dashboard.html
    ├── profile.html
    ├── edit-profile.html
    ├── browse-games.html
    ├── browse-teams.html
    ├── browse-locations.html
    ├── team-detail.html
    ├── game-detail.html
    ├── create-team.html
    ├── create-game.html
    ├── my-requests.html
    ├── css/
    │   └── style.css
    └── js/
        ├── nav.js             # Shared nav + helpers
        ├── home.js
        ├── login.js
        ├── register.js
        ├── dashboard.js
        ├── profile.js
        ├── edit-profile.js
        ├── browse-games.js
        ├── browse-teams.js
        ├── browse-locations.js
        ├── team-detail.js
        ├── game-detail.js
        ├── create-team.js
        ├── create-game.js
        └── my-requests.js
```

---

## HTTPS Setup

HoopConnect supports both HTTP and HTTPS protocols for secure communication.

### Development (Self-Signed Certificate)

For development, the application automatically generates a self-signed SSL certificate:

1. Set `USE_HTTPS=true` in your `.env` file
2. The server will generate a self-signed certificate valid for 365 days
3. Access the application at `https://localhost:3443`
4. Browsers will show a security warning for the self-signed certificate (this is normal for development)

### Production (Proper SSL Certificate)

For production deployment:

1. Obtain an SSL certificate from a trusted Certificate Authority (CA)
2. Set the following environment variables:
   ```
   USE_HTTPS=true
   HTTPS_PORT=443
   SSL_KEY_PATH=/path/to/private.key
   SSL_CERT_PATH=/path/to/certificate.crt
   SSL_CA_PATH=/path/to/ca-bundle.crt  # Optional
   ```
3. Optionally enable HTTP to HTTPS redirects:
   ```
   REDIRECT_HTTP_TO_HTTPS=true
   ```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_HTTPS` | `false` | Enable HTTPS server |
| `HTTPS_PORT` | `3443` | HTTPS server port |
| `REDIRECT_HTTP_TO_HTTPS` | `false` | Redirect HTTP requests to HTTPS |
| `SSL_KEY_PATH` | - | Path to SSL private key (production) |
| `SSL_CERT_PATH` | - | Path to SSL certificate (production) |
| `SSL_CA_PATH` | - | Path to CA bundle (optional) |

---

## Logging

HoopConnect uses structured JSON logging with Winston for monitoring and debugging.

### Log Files

- `logs/combined.log` - All log entries
- `logs/error.log` - Error-level logs only
- `logs/auth.log` - Authentication events
- `logs/db.log` - Database operations

### Log Levels

- `error` - Errors and exceptions
- `warn` - Warnings
- `info` - General information (default)
- `debug` - Detailed debugging information

### Configuration

Set the log level with the `LOG_LEVEL` environment variable:
```
LOG_LEVEL=debug  # For development
LOG_LEVEL=info   # For production
```

---

## Setup Instructions

### 1. Install dependencies
```bash
cd my-website
npm install
```

### 2. Set up MySQL database
Open MySQL and run:
```sql
source database/schema.sql;
source database/seed.sql;
```

### 3. Configure environment
Edit `.env` with your MySQL password:
```
DB_PASSWORD=your_mysql_password
```

### 4. Start the server
```bash
npm start
```

Visit **http://localhost:3000**

---

## Example User Flows

### Player Joins a Game
1. Signs up at `/register`
2. Browses games at `/browse/games`
3. Filters by Basketball + Richmond
4. Clicks a game → sees details + participants
5. Clicks "Request to Join"
6. Host approves on their dashboard → player appears in participants list

### Organizer Creates a Team
1. Logs in → goes to Dashboard
2. Clicks "Create Team"
3. Fills out name, sport, location, skill level, max players
4. Team is created, captain auto-added to roster
5. Other users find the team at `/browse/teams` and submit join requests
6. Captain approves → roster updates

### Scheduling a Meetup
1. Captain opens Dashboard → clicks "Create Game"
2. Picks sport, location, date, time, max players
3. Game appears in public browse
4. Players join → attendance tracked
5. Host can mark game as completed or cancelled

---

## Nice-to-Have (Future)
- Messaging / in-app notifications
- Player ratings and reviews
- Admin moderation panel
- Map integration for locations
- Advanced search with distance
- Friend / follow system
- Team chat

---

*Built as a term project demonstrating relational database design with a real-world use case.*
