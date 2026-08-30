@echo off
cd /d "%~dp0"
title Localmod Desktop
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 20+ from https://nodejs.org then run this again.
  echo Or download an installer from the Releases page — no Node required.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
if not exist apps\desktop\node_modules (
  call npm --prefix apps/desktop install
)
echo.
echo Starting Localmod desktop app for Windows...
echo Engine + React UI + Electron window.
echo Keep this window open while you use the app.
echo.
call npm run desktop
pause
