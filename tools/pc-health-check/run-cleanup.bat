@echo off
rem PC cleanup launcher (asks before every step)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0pc-cleanup.ps1" -Pause
