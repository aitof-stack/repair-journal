@echo off
cd /d "%~dp0"
echo Starting PHP server...
echo Open: http://localhost:8080
echo Press Ctrl+C to stop
echo.
php -S localhost:8080 php/index.php
pause
