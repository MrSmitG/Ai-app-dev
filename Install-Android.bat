@echo off
cd /d "%~dp0"
echo Independent Android APKs — each file is its own phone app.
echo These will not install on Windows. Copy them to an Android phone.
echo.
call "%~dp0scripts\install-android-apk.cmd" all
pause
