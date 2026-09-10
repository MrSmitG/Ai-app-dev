@echo off
cd /d "%~dp0"
title Install Localmod PC apps
echo Downloading one Windows Setup.exe per React app into Downloads\Localmod-setups
echo These are PC installers, not phone APKs.
echo.
call "%~dp0scripts\install-windows-setup.cmd" all
pause
