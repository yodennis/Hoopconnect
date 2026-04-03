# Quick Share - HoopConnect Project

## EASIEST WAY: Email/USB the Folder

**Location:** `C:\Users\dj\Desktop\my-website`

1. Right-click folder → "Send to" → "Compressed (zipped) folder"
2. Email the zip to your classmate or put on USB drive
3. They extract and run `npm install` then `node server.js`

---

## ALTERNATIVE: Share via GitHub (Manual Steps)

### Step 1: Create Repository on GitHub.com
- Go to https://github.com/new
- Sign in to your GitHub account
- **Repository name:** `hoopconnect`
- **Make it PUBLIC**
- ✅ UNCHECK: Add README, .gitignore, license
- Click "Create repository"

### Step 2: Copy Your Repository URL
After creating, you'll see a URL like:
```
https://github.com/yourusername/hoopconnect.git
```

### Step 3: Run These Commands (in PowerShell)
```powershell
cd C:\Users\dj\Desktop\my-website

# Add GitHub as remote
git remote add origin https://github.com/yourusername/hoopconnect.git

# Push your code
git push -u origin master
```

### Step 4: Share the URL
Give your classmate the GitHub URL so they can clone it:
```bash
git clone https://github.com/yourusername/hoopconnect.git
```

---

## Questions?
Pick **EASIEST WAY** (the zip folder) if you just want to share code quickly!
