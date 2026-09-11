@echo off
setlocal
set "APP_ID=%~1"
if "%APP_ID%"=="" set "APP_ID=all"
cd /d "%~dp0\.."

set "OUT=%USERPROFILE%\Downloads\Localmod-apks"
if not "%~2"=="" set "OUT=%~2"
mkdir "%OUT%" >nul 2>&1

if /I "%APP_ID%"=="all" goto :run
if /I "%APP_ID%"=="blackwhale" goto :run
if /I "%APP_ID%"=="nightweaver" goto :run
if /I "%APP_ID%"=="obsidian" goto :run
if /I "%APP_ID%"=="mako" goto :run
if /I "%APP_ID%"=="trench" goto :run
if /I "%APP_ID%"=="ironmantis" goto :run
echo Unknown app "%APP_ID%". Use blackwhale, nightweaver, obsidian, mako, trench, ironmantis, or all.
exit /b 1

:run
call :one blackwhale "Chat"
if errorlevel 1 exit /b 1
call :one nightweaver "Agentic coding"
if errorlevel 1 exit /b 1
call :one obsidian "API keys"
if errorlevel 1 exit /b 1
call :one mako "Speed / race"
if errorlevel 1 exit /b 1
call :one trench "Editor"
if errorlevel 1 exit /b 1
call :one ironmantis "Autonomous builder"
if errorlevel 1 exit /b 1

echo.
echo Folder: %OUT%
echo Each APK is a separate Android app. Install only the ones you want.
echo.
exit /b 0

:one
set "ID=%~1"
set "JOB=%~2"
if /I not "%APP_ID%"=="all" if /I not "%APP_ID%"=="%ID%" goto :eof
set "FILE=%ID%.apk"
set "URL=https://github.com/mrsmitg/ai-app-dev/releases/latest/download/%FILE%"
echo.
echo === %ID%  (%JOB%)  independent APK ===
echo Step 1. Download %FILE%
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%OUT%\%FILE%' } catch { Write-Error $_; exit 1 }"
if errorlevel 1 (
  echo Download failed for %FILE%.
  exit /b 1
)
echo         Saved %OUT%\%FILE%
echo Step 2. Copy %FILE% to the Android phone (USB or Drive). Do not open it on Windows.
echo Step 3. Phone: Settings - Apps - Special app access - Install unknown apps - Files - Allow
echo Step 4. Tap %FILE% - Install. Does not replace the other Localmod apps.
echo Step 5. Open the %JOB% app (%ID%) from the launcher.
goto :eof
