@echo off
cd /d "%~dp0"
echo Starting server...
powershell -ExecutionPolicy Bypass -File server.ps1
pause