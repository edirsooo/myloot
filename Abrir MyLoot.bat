@echo off
chcp 65001 >nul
title MyLoot
cd /d "%~dp0"
rem abre a janela e o icone da bandeja assim que o servidor responder; o servidor roda aqui, para ver os erros
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0MyLoot.ps1" -SemServidor
node server.js
pause
