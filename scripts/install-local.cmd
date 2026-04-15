@echo off
setlocal
set APP_VERSION=1.0.2
if exist "%~dp0.ki-os-version" set /p APP_VERSION=<"%~dp0.ki-os-version"

echo ==========================================
echo KI-OS %APP_VERSION% Local Install
echo ==========================================

where npm >nul 2>nul
if errorlevel 1 (
  echo [FEHLER] npm wurde nicht gefunden.
  exit /b 1
)

echo [1/6] Root-Abhaengigkeiten installieren...
call npm install
if errorlevel 1 exit /b 1

echo [2/6] Frontend-Abhaengigkeiten installieren...
cd /d "%~dp0frontend\orbit-control"
call npm install
if errorlevel 1 exit /b 1

echo [3/6] .env.local vorbereiten...
if not exist ".env.local" (
  if exist ".env.local.example" copy /Y ".env.local.example" ".env.local" >nul
)

echo [4/6] Zurueck ins Root...
cd /d "%~dp0"

echo [5/6] Doctor Full...
call npm run doctor:full
if errorlevel 1 exit /b 1

echo [6/6] Stack bereit. Start mit KI-OS-Start.bat
endlocal
