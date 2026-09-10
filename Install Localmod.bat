@echo off
setlocal
cd /d "%~dp0"
title Install Localmod
echo This installs the Localmod React apps from GitHub Releases:
echo   Blackwhale-Setup.exe, Nightweaver-Setup.exe, Obsidian-Setup.exe,
echo   Mako-Setup.exe, Trench-Setup.exe, Ironmantis-Setup.exe
echo.
echo Those are Windows PC installers. APK files are for Android phones, not Windows.
echo This file still fetches the hub installer (Localmod-Setup.exe) with all six.
echo For one app only, use that app folder's Install-Windows.bat.
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
