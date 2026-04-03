@echo off
echo ========================================
echo    HoopConnect - GitHub Setup Helper
echo ========================================
echo.
echo This script will help you set up GitHub collaboration.
echo.
echo Step 1: Create a GitHub repository
echo - Go to https://github.com and sign in
echo - Click "New repository"
echo - Name it: hoopconnect
echo - Make it PUBLIC (so classmates can access)
echo - DO NOT initialize with README or .gitignore
echo - Click "Create repository"
echo.
echo Step 2: Connect this local repository to GitHub
echo.
set /p GITHUB_URL="Enter your GitHub repository URL (e.g., https://github.com/yourusername/hoopconnect.git): "
echo.
echo Setting up remote repository...
git remote add origin %GITHUB_URL%
echo.
echo Pushing code to GitHub...
git push -u origin master
echo.
echo ========================================
echo SUCCESS! Your code is now on GitHub.
echo ========================================
echo.
echo Share this link with your classmates:
echo %GITHUB_URL%
echo.
echo They can clone it with:
echo git clone %GITHUB_URL%
echo.
pause