@echo off
setlocal
set "APP_ID=%~1"
if "%APP_ID%"=="" set "APP_ID=blackwhale"
cd /d "%~dp0\.."

if exist "node_modules\vite\bin\vite.js" (
  node scripts\start-suite-app.mjs %APP_ID%
  exit /b %ERRORLEVEL%
)

set "PRODUCT="
if /I "%APP_ID%"=="blackwhale" set "PRODUCT=Blackwhale"
if /I "%APP_ID%"=="nightweaver" set "PRODUCT=Nightweaver"
if /I "%APP_ID%"=="obsidian" set "PRODUCT=Obsidian"
if /I "%APP_ID%"=="mako" set "PRODUCT=Mako"
if /I "%APP_ID%"=="trench" set "PRODUCT=Trench"
if /I "%APP_ID%"=="ironmantis" set "PRODUCT=Ironmantis"
if "%PRODUCT%"=="" (
  echo Unknown app "%APP_ID%".
  pause
  exit /b 1
)

set "EXE=%LOCALAPPDATA%\Programs\%PRODUCT%\%PRODUCT%.exe"
if exist "%~dp0..\%PRODUCT%.exe" set "EXE=%~dp0..\%PRODUCT%.exe"
if exist "%EXE%" (
  echo Starting %PRODUCT%...
  start "" "%EXE%"
  endlocal
  exit /b 0
)

set "DIR=%LOCALAPPDATA%\Localmod"
set "SETUP=%DIR%\%PRODUCT%-Setup.exe"
if exist "%~dp0..\%PRODUCT%-Setup.exe" set "SETUP=%~dp0..\%PRODUCT%-Setup.exe"
if not exist "%SETUP%" (
  mkdir "%DIR%" >nul 2>&1
  echo Downloading %PRODUCT%-Setup.exe from GitHub Releases...
  echo This is a Windows installer, not a phone APK.
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/mrsmitg/ai-app-dev/releases/latest/download/%PRODUCT%-Setup.exe' -OutFile '%SETUP%' } catch { Write-Error $_; exit 1 }"
  if errorlevel 1 (
    echo Download failed. Open GitHub Releases and run %PRODUCT%-Setup.exe.
    pause
    exit /b 1
  )
)

echo Starting %PRODUCT%-Setup.exe ...
start "" "%SETUP%"
endlocal
exit /b 0
