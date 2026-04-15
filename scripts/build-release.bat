@echo off
chcp 65001 > nul
title KI-OS Release Builder

:: ============================================================
::  KI-OS  --  Release Build  (Windows Wrapper)
::  Ruft build-release.ps1 auf
::  Verwendung:
::    build-release.bat            -- vollstaendiger Build
::    build-release.bat --SkipBuild -- ohne next build
::    build-release.bat --DryRun   -- Testlauf ohne Aenderungen
:: ============================================================

set SCRIPT_DIR=%~dp0
if "%SCRIPT_DIR:~-1%"=="\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

set PS_ARGS=
:parse_args
if "%~1"=="" goto run
if /i "%~1"=="--SkipBuild" set PS_ARGS=%PS_ARGS% -SkipBuild
if /i "%~1"=="--SkipClean" set PS_ARGS=%PS_ARGS% -SkipClean
if /i "%~1"=="--DryRun"    set PS_ARGS=%PS_ARGS% -DryRun
shift
goto parse_args

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\build-release.ps1"%PS_ARGS%

if errorlevel 1 (
  echo.
  echo  [FEHLER] Release-Build fehlgeschlagen.
  echo  Bitte Ausgabe oben pruefen.
  echo.
  pause
  exit /b 1
)

pause
