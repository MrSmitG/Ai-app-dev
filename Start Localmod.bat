@echo off
cd /d "%~dp0"
title Localmod
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org then double-click this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo.
echo Localmod is starting.
echo The React app should open at http://localhost:1420
echo Keep this window open while you use the app.
echo.
call npm run dev
pause
