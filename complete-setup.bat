@echo off
echo ========================================
echo    HoopConnect - Complete Setup
echo ========================================
echo.
echo Step 1: Authenticate with GitHub
echo Run this command and follow the prompts:
echo.
echo gh auth login
echo.
echo Choose: GitHub.com ^> HTTPS ^> Login with web browser ^> Y
echo.
echo Step 2: After authentication completes, press any key to continue...
pause
echo.
echo Creating repository...
gh repo create hoopconnect --public --description "HoopConnect - Community Sports Meetup Platform with Node.js and Laravel PHP versions" --source=. --remote=origin --push
echo.
echo ========================================
echo SUCCESS! Repository created and code pushed.
echo ========================================
echo.
echo Repository URL:
gh repo view hoopconnect --json url -q .url
echo.
echo Share this URL with your classmate!
echo.
pause