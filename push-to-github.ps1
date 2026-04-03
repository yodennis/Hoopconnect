# Quick setup guide for pushing to GitHub
# Just copy and paste each section into PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "HoopConnect - Push to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: You must create a repository on GitHub first" -ForegroundColor Yellow
Write-Host "Go to https://github.com/new" -ForegroundColor White
Write-Host "- Name it: hoopconnect" -ForegroundColor White
Write-Host "- Make it PUBLIC" -ForegroundColor White
Write-Host "- UNCHECK: README, .gitignore, license" -ForegroundColor White
Write-Host "- Click Create" -ForegroundColor White
Write-Host ""

$repoUrl = Read-Host "Step 2: Paste your GitHub repository URL (https://github.com/yourusername/hoopconnect.git)"

if (-not $repoUrl) {
    Write-Host "Error: No URL provided" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "Step 3: Pushing code to GitHub..." -ForegroundColor Cyan

cd "C:\Users\dj\Desktop\my-website"
git remote remove origin 2>$null  # Remove if exists
git remote add origin $repoUrl
git branch -M master
git push -u origin master

if ($?) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS! Code pushed to GitHub" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Share this URL with your classmate:" -ForegroundColor Yellow
    Write-Host $repoUrl -ForegroundColor White
    Write-Host ""
    Write-Host "They can clone with:" -ForegroundColor Yellow
    Write-Host "git clone $repoUrl" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Error pushing to GitHub" -ForegroundColor Red
    Write-Host "Make sure you entered the correct URL" -ForegroundColor White
}
