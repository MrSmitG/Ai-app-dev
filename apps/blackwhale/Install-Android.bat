@echo off
cd /d "%~dp0\..\.."
call "%~dp0..\..\scripts\install-android-apk.cmd" blackwhale
pause
