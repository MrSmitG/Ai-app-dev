@echo off
cd /d "%~dp0\..\.."
if exist "Start Localmod.bat" call "Start Localmod.bat"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:1420/engineer"
