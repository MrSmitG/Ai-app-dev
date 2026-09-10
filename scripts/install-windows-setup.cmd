@echo off
setlocal
set "APP_ID=%~1"
if "%APP_ID%"=="" set "APP_ID=all"
cd /d "%~dp0\.."

set "OUT=%USERPROFILE%\Downloads\Localmod-setups"
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
call :one blackwhale Blackwhale "Chat"
if errorlevel 1 exit /b 1
call :one nightweaver Nightweaver "Agentic coding"
if errorlevel 1 exit /b 1
call :one obsidian Obsidian "API keys"
if errorlevel 1 exit /b 1
call :one mako Mako "Speed / race"
if errorlevel 1 exit /b 1
call :one trench Trench "Editor"
if errorlevel 1 exit /b 1
call :one ironmantis Ironmantis "Autonomous builder"
if errorlevel 1 exit /b 1

echo.
echo Folder: %OUT%
echo Each Setup.exe is a separate Windows app. Double-click only the ones you want.
echo These are PC installers, not phone APKs.
echo.
exit /b 0

:one
set "ID=%~1"
set "PRODUCT=%~2"
set "JOB=%~3"
if /I not "%APP_ID%"=="all" if /I not "%APP_ID%"=="%ID%" goto :eof
set "FILE=%PRODUCT%-Setup.exe"
set "URL=https://github.com/mrsmitg/ai-app-dev/releases/latest/download/%FILE%"
echo.
echo === %PRODUCT%  (%JOB%)  Windows Setup.exe ===
echo Step 1. Download %FILE%
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%OUT%\%FILE%' } catch { Write-Error $_; exit 1 }"
if errorlevel 1 (
  echo Download failed for %FILE%.
  exit /b 1
)
echo         Saved %OUT%\%FILE%
echo Step 2. Double-click %FILE% and finish setup.
echo Step 3. Click %PRODUCT% on the desktop or in the Start menu.
if /I not "%APP_ID%"=="all" (
  echo Starting %FILE%...
  start "" "%OUT%\%FILE%"
)
goto :eof
