# HoopConnect Configuration Guide

## Environment Setup

### Required Environment Variables (.env)

```
# Database Configuration (required)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=hoopconnect
DB_PORT=3306

# Session Configuration (required - change in production!)
SESSION_SECRET=your-random-secret-key-here
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Server Configuration
PORT=3000
USE_HTTPS=true
HTTPS_PORT=3443
REDIRECT_HTTP_TO_HTTPS=false

# Logging
LOG_LEVEL=info

# Email Configuration (IMPORTANT: Must be configured for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use Gmail App Password, not regular password
SMTP_FROM=your-email@gmail.com

# Optional: Node Environment
NODE_ENV=development
```

## Quick Start

### Windows (with XAMPP)

1. **Start XAMPP MySQL**:
   ```
   cd C:\xampp
   mysql_start.bat
   ```

2. **Initialize Database**:
   ```
   cd C:\Users\dj\Desktop\my-website
   mysql -u root hoopconnect < database/schema.sql
   mysql -u root hoopconnect < database/seed.sql
   ```

3. **Start Server**:
   ```
   node server.js
   ```
   or use the automated cleanup script:
   ```
   start-server.bat
   ```

4. **Access Application**:
   - HTTP: http://localhost:3000
   - HTTPS: https://localhost:3443

## Email Setup (Gmail)

1. Enable 2-Factor Authentication on Gmail
2. Generate App Password (not your regular password)
3. Add to .env:
   ```
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

## Known Issues

- **Port Conflicts**: If "address already in use" error, use `start-server.bat` or manually kill old processes
- **Self-signed HTTPS**: Browser will show security warning - normal for development
- **User Registration**: Requires valid email, password with uppercase/lowercase/digits, and terms agreement

## Database Maintenance

Clear cache and restart if queries seem outdated:
```
npm start
```

Check logs:
```
type logs\error.log
type logs\db.log
type logs\combined.log
```
