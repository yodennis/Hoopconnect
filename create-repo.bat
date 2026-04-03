@echo off
echo ========================================
echo    Creating HoopConnect Repository
echo ========================================
echo.
echo This script will create your GitHub repository and push your code.
echo Make sure you've completed GitHub authentication first!
echo.
echo Checking GitHub authentication...
gh auth status
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Not authenticated with GitHub.
    echo Please run: gh auth login
    echo Then try this script again.
    pause
    exit /b 1
)
echo.
echo Authentication successful! Creating repository...
gh repo create hoopconnect --public --description "HoopConnect - Community Sports Meetup Platform with Node.js and Laravel PHP versions" --source=. --remote=origin --push
echo.
echo ========================================
echo SUCCESS! Repository created and code pushed.
echo ========================================
echo.
echo Your repository is now live at:
gh repo view hoopconnect --web
echo.
echo Share this URL with your classmate:
gh repo view hoopconnect --json url -q .url
echo.
pause