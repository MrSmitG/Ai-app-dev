@echo off
setlocal
cd /d "%~dp0"
title Localmod
rem Download the ready-to-run React desktop app from GitHub. No Node.js or npm.

set "URL=https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.exe"
set "DIR=%LOCALAPPDATA%\Localmod"
set "APP=%DIR%\Localmod.exe"
if exist "%~dp0Localmod.exe" set "APP=%~dp0Localmod.exe"

if not exist "%APP%" (
  mkdir "%DIR%" >nul 2>&1
  echo Downloading Localmod for Windows...
  echo %URL%
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%APP%' } catch { Write-Error $_; exit 1 }"
  if errorlevel 1 (
    echo Download failed. Open %URL% in a browser, then click Localmod.exe.
    pause
    exit /b 1
  )
)

echo Starting Localmod...
start "" "%APP%"
endlocal
exit /b 0
