@echo off
REM =============================================================================
REM KI-OS Community Edition — Startup Script (Windows)
REM =============================================================================

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\show-logo.ps1" -Edition community


REM ─────────────────────────────────────────────────────────────────
REM Konfiguration
REM ─────────────────────────────────────────────────────────────────

set "COMMUNITY_PORT=8080"
if defined PORT set "COMMUNITY_PORT=%PORT%"

cd /d "%SCRIPT_DIR%"

REM ─────────────────────────────────────────────────────────────────
REM Node.js Version prüfen
REM ─────────────────────────────────────────────────────────────────

echo [1/5] Pruefe Node.js Version...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Node.js nicht installiert oder nicht im PATH
    echo.
    echo Bitte Node.js installieren: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=2 delims=v." %%i in ('node --version 2^>nul') do set "NODE_VERSION=%%i"

if %NODE_VERSION% LSS 20 (
    echo.
    echo ❌ ERROR: Node.js Version %NODE_VERSION% ist zu alt (minimum 20)
    echo.
    echo Bitte Node.js aktualisieren: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js v%NODE_VERSION% ist installiert

REM ─────────────────────────────────────────────────────────────────
REM Laufende Prozesse terminieren
REM ─────────────────────────────────────────────────────────────────

echo.
echo [2/5] Pruefe auf laufende KI-OS Prozesse...

REM Port 8080 prüfen
netstat -ano | findstr :%COMMUNITY_PORT% >nul 2>&1
if %errorlevel% equ 0 (
    echo   Port %COMMUNITY_PORT% wird verwendet
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :%COMMUNITY_PORT%') do (
        echo   Terminate PID %%i...
        taskkill /F /PID %%i >nul 2>&1
        if %errorlevel% equ 0 (
            echo   PID %%i terminiert
        ) else (
            echo   WARNING: Konnte PID %%i nicht terminieren
        )
    )
    timeout /t 2 /nobreak >nul
) else (
    echo   Keine Prozesse auf Port %COMMUNITY_PORT%
)

REM Port 3000 prüfen
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo   Port 3000 wird verwendet
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3000') do (
        echo   Terminate PID %%i...
        taskkill /F /PID %%i >nul 2>&1
        if %errorlevel% equ 0 (
            echo   PID %%i terminiert
        ) else (
            echo   WARNING: Konnte PID %%i nicht terminieren
        )
    )
    timeout /t 1 /nobreak >nul
)

echo ✅ Prozesse bereinigt

REM ─────────────────────────────────────────────────────────────────
REM Dependencies prüfen und installieren
REM ─────────────────────────────────────────────────────────────────

echo.
echo [3/5] Pruefe Dependencies...

if exist "node_modules\express\package.json" (
    echo   node_modules sind vorhanden
    echo   Ueberspringe npm install (bereits installiert)
) else (
    echo   node_modules fehlen - installiere...
    
    if not exist "package.json" (
        echo.
        echo ❌ ERROR: package.json nicht gefunden
        echo.
        pause
        exit /b 1
    )
    
    call npm install --no-audit --no-fund --prefer-offline
    if %errorlevel% neq 0 (
        echo.
        echo ❌ ERROR: npm install fehlgeschlagen
        echo.
        echo Manuell ausfuehren: npm install
        echo.
        pause
        exit /b 1
    )
    echo ✅ Dependencies installiert
)

REM ─────────────────────────────────────────────────────────────────
REM Umgebung validieren
REM ─────────────────────────────────────────────────────────────────

echo.
echo [4/5] Validiere Umgebung...

if not exist ".env" (
    echo   .env nicht gefunden - erstelle...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo   .env aus .env.example erstellt
    ) else (
        echo KI_OS_EDITION=community> .env
        echo NODE_ENV=production>> .env
        echo PORT=8080>> .env
        echo   Minimale .env erstellt
    )
    echo ✅ .env erstellt
) else (
    echo   .env existiert bereits
)

REM Prüfe ob API Keys konfiguriert sind
findstr /i "ANTHROPIC_API_KEY=.*" .env >nul 2>&1
if %errorlevel% neq 0 (
    findstr /i "OPENAI_API_KEY=.*" .env >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo ⚠️  WARNING: Kein AI Provider API Key in .env
        echo   KI-OS wird im Demo-Modus starten
        echo   Bearbeite .env und fuege mindestens einen API Key hinzu
    )
)

echo ✅ Umgebung validiert

REM ─────────────────────────────────────────────────────────────────
REM Server starten
REM ─────────────────────────────────────────────────────────────────

echo.
echo [5/5] Starte KI-OS Community Server...
echo   Port: %COMMUNITY_PORT%
echo   Edition: community
echo.
echo ═══════════════════════════════════════════════════════════════
echo.

set KI_OS_EDITION=community
set PORT=%COMMUNITY_PORT%

node runtime/local/server.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ Server mit Fehler beendet (Code %errorlevel%)
    echo.
    pause
)

endlocal
