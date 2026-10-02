@echo off
rem PC health check launcher (read-only)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0pc-health-check.ps1" -Pause
