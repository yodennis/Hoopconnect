@echo off
REM ============================================================
REM HoopConnect Server Startup Script
REM Handles port cleanup and graceful startup
REM ============================================================

echo Cleaning up old processes on ports 3000 and 3443...

REM Kill any existing processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
    if not "%%a"=="0" (
        taskkill /PID %%a /F 2>nul
    )
)

REM Kill any existing processes on port 3443
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3443"') do (
    if not "%%a"=="0" (
        taskkill /PID %%a /F 2>nul
    )
)

echo Waiting for ports to be released...
timeout /t 2 /nobreak

echo Starting HoopConnect server...
node server.js

pause
