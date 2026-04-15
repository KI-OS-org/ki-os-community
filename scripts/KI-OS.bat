@echo off
chcp 65001 > nul
title KI-OS Enterprise Launcher
setlocal EnableDelayedExpansion

set ROOT_DIR=%~dp0
if "!ROOT_DIR:~-1!"=="\" set ROOT_DIR=!ROOT_DIR:~0,-1!

powershell -NoProfile -ExecutionPolicy Bypass -File "!ROOT_DIR!\scripts\show-logo.ps1" -Edition enterprise

powershell -NoProfile -ExecutionPolicy Bypass -File "!ROOT_DIR!\KI-OS-Start.ps1" -Mode FullStart -RootDir "!ROOT_DIR!"
if errorlevel 1 (
  echo.
  echo  [FEHLER] KI-OS konnte nicht gestartet werden.
  echo  Bitte pruefen Sie die Ausgabe oben.
  echo.
  pause
  exit /b 1
)
