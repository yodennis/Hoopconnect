#!/usr/bin/env powershell
# Simple one-step GitHub push for HoopConnect

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     HoopConnect - Share on GitHub (Simple Version)    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if git is available
$gitCheck = git --version 2>$null
if (-not $gitCheck) {
    Write-Host "❌ Git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Git found: $gitCheck" -ForegroundColor Green
Write-Host ""

# Navigate to project
cd "C:\Users\dj\Desktop\my-website"
Write-Host "📁 Working directory: $(Get-Location)" -ForegroundColor White
Write-Host ""

# Get GitHub URL from user
Write-Host "Step 1: Create a GitHub repository" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "  • Go to: https://github.com/new" -ForegroundColor White
Write-Host "  • Name it: hoopconnect" -ForegroundColor White
Write-Host "  • Make it PUBLIC" -ForegroundColor White
Write-Host "  • UNCHECK README, .gitignore, license" -ForegroundColor White
Write-Host "  • Click 'Create repository'" -ForegroundColor White
Write-Host ""

$githubUrl = Read-Host "Paste your new GitHub URL here"

if ([string]::IsNullOrWhiteSpace($githubUrl)) {
    Write-Host ""
    Write-Host "❌ No URL provided. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Uploading your code..." -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Configure git for this repository
git config user.email "hoopconnect@example.com" 2>$null
git config user.name "HoopConnect Developer" 2>$null

# Remove existing remote if it exists
git remote remove origin 2>$null

# Add new remote
$addRemote = git remote add origin $githubUrl 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error adding remote: $addRemote" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Remote added" -ForegroundColor Green

# Ensure master branch exists
$currentBranch = git rev-parse --abbrev-ref HEAD 2>$null
if ($currentBranch -ne "master") {
    git branch -M master 2>$null
    Write-Host "  ✓ Branch renamed to master" -ForegroundColor Green
}

# Push to GitHub
Write-Host "  ⏳ Pushing code (this may take a moment)..." -ForegroundColor Cyan
$pushOutput = git push -u origin master 2>&1
$pushExitCode = $LASTEXITCODE

if ($pushExitCode -eq 0) {
    Write-Host "  ✓ Code pushed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║          🎉 SUCCESS! Your code is on GitHub 🎉        ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📤 Repository URL:" -ForegroundColor White
    Write-Host "   $githubUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Share with your classmate:" -ForegroundColor White
    Write-Host "   git clone $githubUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 They can now work on it together with you!" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Error pushing to GitHub:" -ForegroundColor Red
    Write-Host $pushOutput -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Possible solutions:" -ForegroundColor White
    Write-Host "  1. Make sure the GitHub URL is correct" -ForegroundColor White
    Write-Host "  2. Check your GitHub credentials" -ForegroundColor White
    Write-Host "  3. Ensure the repository is empty (no README, .gitignore, license)" -ForegroundColor White
}

Write-Host ""
pause
