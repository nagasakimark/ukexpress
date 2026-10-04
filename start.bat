@echo off
rem Double-click this file to play UK Express! in your browser.
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8080/"
  python -m http.server 8080
  goto :eof
)
echo UK Express! needs Node.js (https://nodejs.org) or Python to run a small local web server.
pause
