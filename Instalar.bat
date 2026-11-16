@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  A Mochila precisa do Node.js. Baixe em https://nodejs.org ^(versao LTS^), instale e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $p=(Get-Location).Path; $s=(New-Object -ComObject WScript.Shell).CreateShortcut(\"$d\Mochila.lnk\"); $s.TargetPath=\"$p\Mochila.vbs\"; $s.WorkingDirectory=$p; $s.IconLocation=\"$p\Mochila.ico\"; $s.Save()"
echo.
echo  Pronto! Atalho "Mochila" criado na area de trabalho. Abrindo...
start "" wscript.exe "%~dp0Mochila.vbs"
timeout /t 3 >nul
