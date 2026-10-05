@echo off
rem Starts Architect Trainer and opens it in your browser.
title Architect Trainer
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start.ps1" %*

if errorlevel 1 (
  echo.
  pause
)
