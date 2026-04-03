@echo off
setlocal enabledelayedexpansion

color 0A
cls
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║  HoopConnect - Push to GitHub (Command Prompt Version) ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo STEP 1: Go to https://github.com/new and create a repository
echo.
echo   - Name: hoopconnect
echo   - Make it PUBLIC
echo   - UNCHECK: README, .gitignore, license
echo   - Click "Create repository"
echo.
echo.
set /p githubUrl="STEP 2: Paste your GitHub URL here (https://github.com/...): "

if "!githubUrl!"=="" (
    echo.
    echo Error: No URL provided
    pause
    exit /b 1
)

cd /d "C:\Users\dj\Desktop\my-website"

echo.
echo STEP 3: Uploading your code to GitHub...
echo.

git config user.email "hoopconnect@example.com" >nul 2>&1
git config user.name "HoopConnect Developer" >nul 2>&1
git remote remove origin >nul 2>&1
git remote add origin !githubUrl! || (
    echo Error adding remote. Check your URL.
    pause
    exit /b 1
)

git branch -M master >nul 2>&1
git push -u origin master

if %errorlevel% equ 0 (
    echo.
    echo =========================================================
    echo  SUCCESS! Your code is now on GitHub
    echo =========================================================
    echo.
    echo Repository: !githubUrl!
    echo.
    echo Share this URL with your classmate to collaborate:
    echo   git clone !githubUrl!
    echo.
) else (
    echo.
    echo Error pushing to GitHub. Check your credentials and URL.
    echo.
)

pause
