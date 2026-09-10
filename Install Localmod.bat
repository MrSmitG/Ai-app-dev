@echo off
setlocal
cd /d "%~dp0"
title Install Localmod
echo This installs the Localmod React apps from GitHub Releases:
echo   Blackwhale, Nightweaver, Obsidian, Mako, The Trench, Ironmantis
echo.
echo APK files (blackwhale.apk and so on) are for Android phones, not Windows.
echo.

set "URL=https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod-Setup.exe"
set "DIR=%LOCALAPPDATA%\Localmod"
set "SETUP=%DIR%\Localmod-Setup.exe"
if exist "%~dp0Localmod-Setup.exe" set "SETUP=%~dp0Localmod-Setup.exe"

if not exist "%SETUP%" (
  mkdir "%DIR%" >nul 2>&1
  echo Downloading Localmod-Setup.exe ...
  echo %URL%
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%SETUP%' } catch { Write-Error $_; exit 1 }"
  if errorlevel 1 (
    echo Download failed. Open %URL% in a browser, then run Localmod-Setup.exe.
    pause
    exit /b 1
  )
)

echo Starting setup...
start "" "%SETUP%"
endlocal
exit /b 0
