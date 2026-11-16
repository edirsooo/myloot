@echo off
chcp 65001 >nul
title MyLoot
cd /d "%~dp0"
start "" "http://127.0.0.1:4321/"
node server.js
pause
