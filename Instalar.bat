@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O MyLoot precisa do Node.js. Baixe em https://nodejs.org ^(versao LTS^), instale e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $p=(Get-Location).Path; $s=(New-Object -ComObject WScript.Shell).CreateShortcut(\"$d\MyLoot.lnk\"); $s.TargetPath=\"$p\MyLoot.vbs\"; $s.WorkingDirectory=$p; $s.IconLocation=\"$p\MyLoot.ico\"; $s.Save()"
echo.
echo  Pronto! Atalho "MyLoot" criado na area de trabalho. Abrindo...
start "" wscript.exe "%~dp0MyLoot.vbs"
timeout /t 3 >nul
