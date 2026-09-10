@echo off
setlocal
set "APP_ID=%~1"
if "%APP_ID%"=="" set "APP_ID=blackwhale"
cd /d "%~dp0\.."

if exist "node_modules\vite\bin\vite.js" (
  node scripts\start-suite-app.mjs %APP_ID%
  exit /b %ERRORLEVEL%
)

set "DIR=%LOCALAPPDATA%\Localmod"
set "EXE=%DIR%\Localmod.exe"
if exist "%~dp0..\Localmod.exe" set "EXE=%~dp0..\Localmod.exe"

if not exist "%EXE%" (
  mkdir "%DIR%" >nul 2>&1
  echo Downloading Localmod from GitHub Releases (installs the React apps)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.exe' -OutFile '%EXE%' } catch { Write-Error $_; exit 1 }"
  if errorlevel 1 (
    echo Download failed. Open GitHub Releases and run Localmod-Setup.exe.
    pause
    exit /b 1
  )
)

echo Starting %APP_ID%...
start "" "%EXE%" --app=%APP_ID%
endlocal
exit /b 0
