# HoopConnect — Beginner Setup Guide (One Page)

## What You Need to Download (5 minutes)

1. **Node.js** (JavaScript runtime)
   - Go to: https://nodejs.org/
   - Download "LTS" version (green button)
   - Run installer, click Next until done
   - Verify: Open PowerShell, type `node --version` (should show v20+ or similar)

2. **Git** (version control)
   - Go to: https://git-scm.com/
   - Download for Windows
   - Run installer, click Next until done
   - Verify: Open PowerShell, type `git --version`

3. **GitHub Account**
   - Go to: https://github.com
   - Sign up (free)
   - Ask the project lead (yodennis) to add you as a collaborator

4. **Code Editor** (pick one)
   - **VS Code** (best): https://code.visualstudio.com/ — download & install
   - OR just use Notepad if VS Code feels too much (but VS Code is better)

## Setup Steps (10 minutes)

### Step 1: Clone the Repository
Open PowerShell and run:
```bash
cd Desktop
git clone https://github.com/yodennis/Hoopconnect.git
cd Hoopconnect
```

### Step 2: Install Dependencies
```bash
npm install
```
(This downloads all the code packages the app needs. Takes 1-2 minutes.)

### Step 3: Create Your .env File
Create a new file called `.env` in the Hoopconnect folder (the main folder). Copy this into it:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=hoopconnect
DB_PORT=3306
SESSION_SECRET=hoopconnect_dev_secret
PORT=3000
USE_HTTPS=false
HTTPS_PORT=3443
REDIRECT_HTTP_TO_HTTPS=false
LOG_LEVEL=info
```

### Step 4: Set Up Local Database
You need MySQL running locally. If you don't have it:
- Download: https://dev.mysql.com/downloads/mysql/
- Install (default settings are fine)
- Verify it's running

Then run:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p hoopconnect < database/seed.sql
```
(Leave password blank and just press Enter)

## Start Coding (2 minutes)

### Every time you start working:

1. **Open PowerShell** in the Hoopconnect folder
2. **Start the server:**
   ```bash
   node server.js
   ```
3. **Open browser:** Go to `http://localhost:3000`

You should see the HoopConnect homepage. Try logging in with:
- **Email:** test@example.com
- **Password:** password123

### If login doesn't work:
- Check PowerShell — server should say `HoopConnect HTTP server running at http://localhost:3000`
- If not, server crashed. Look for error message
- Check `.env` has `PORT=3000` and `USE_HTTPS=false`

## Making Code Changes

### Before you start:
```bash
git pull origin master
git checkout -b feature/your-feature-name
```

### After you make changes:
```bash
git add .
git commit -m "What you changed"
git push origin feature/your-feature-name
```

Then go to GitHub and create a Pull Request. Project lead will review and merge.

## Folder Structure (What to Edit)

- **`public/js/`** — Frontend JavaScript (what users see & interact with)
- **`public/`** — HTML pages
- **`public/css/`** — Styling
- **`routes/`** — Backend code (API endpoints, login, games, teams, etc.)
- **`server.js`** — Main app file

## Understanding Database Keys (For Beginners)

### Primary Key (PK)
- A unique ID that identifies each row in a table
- Like a student ID—no two students share the same ID
- Example: `user_id` in the `users` table (first person = user_id 1, second = user_id 2, etc.)
- Shows as `PRI` in phpMyAdmin

### Foreign Key (FK)
- A link from one table to another table's primary key
- Like saying "this team belongs to user_id 5" (the captain)
- Creates relationships between tables
- Example: `teams` table has `captain_id` which points to a `user_id` in the `users` table
- Shows as `MUL` in phpMyAdmin

### Why This Matters
- Keeps data organized and connected
- Prevents duplicate data
- Ensures data integrity (can't delete a user if they own a team)

### See It In XAMPP
1. Open XAMPP Control Panel → Start MySQL
2. Click Admin button next to MySQL (opens phpMyAdmin)
3. Click `hoopconnect` database on the left
4. Click any table (like `teams` or `games`)
5. Click the "Structure" tab at the top
6. Look at the "Key" column:
   - `PRI` = Primary Key
   - `MUL` = Foreign Key reference
7. The `teams` table has:
   - `team_id` = PRI (primary key, unique ID for each team)
   - `captain_id` = MUL (foreign key, links to user_id in users table)

## Stuck?

- **Server won't start?** → Check `.env` file matches your MySQL setup
- **npm install fails?** → Delete `node_modules` folder and `package-lock.json`, run `npm install` again
- **Port 3000 already in use?** → Change `PORT=3001` in `.env` and visit `http://localhost:3001`
- **Database error?** → Confirm MySQL is running and password is blank

---

**That's it!** You're ready to start coding. Ask questions anytime — no such thing as a dumb question.
