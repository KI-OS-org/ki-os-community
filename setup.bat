@echo off
chcp 65001 > nul
cls

REM ============================================================
REM  KI-OS Community Edition — Setup (Windows)
REM  Installiert Abhängigkeiten, konfiguriert .env, baut Frontend.
REM  Ausführen: setup.bat (Doppelklick oder cmd)
REM
REM  (c) 2026 ki-os.org — Ingo Schaffer & Kimba <kimba@ki-os.org>
REM  AGPL-3.0-only
REM ============================================================

echo.
echo ========================================================
echo   KI-OS Community Edition - Setup
echo   (c) 2026 ki-os.org
echo ========================================================
echo.

REM ── 1. Node.js Check ─────────────────────────────────────────────────────────

echo [1/4] Pruefe Node.js...
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [FEHLER] Node.js nicht gefunden.
    echo Bitte installieren: https://nodejs.org  (Version 20 oder neuer)
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo   OK: Node.js %NODE_VER% gefunden
echo.

REM ── 2. .env konfigurieren ────────────────────────────────────────────────────

echo [2/4] Konfiguriere .env...

if exist .env (
    echo   [HINWEIS] .env existiert bereits - wird nicht ueberschrieben.
    echo   API-Keys koennen manuell in .env bearbeitet werden.
    echo.
    goto :npm_install
)

if not exist .env.example (
    echo [FEHLER] .env.example nicht gefunden.
    echo Bitte setup.bat im KI-OS Stammverzeichnis ausfuehren.
    pause
    exit /b 1
)

copy .env.example .env > nul
echo   .env aus .env.example erstellt.
echo.
echo   Bitte API-Keys eingeben.
echo   OpenRouter ist Pflichtfeld - Keys: https://openrouter.ai/keys
echo.

REM OpenRouter Pflichtfeld
set OR_KEY=
set /p OR_KEY="  OPENROUTER_API_KEY (Pflicht): "
if "%OR_KEY%"=="" (
    echo.
    echo [FEHLER] OPENROUTER_API_KEY ist erforderlich um KI-OS zu starten.
    pause
    exit /b 1
)

REM Optionale Keys
set ANTHROPIC_KEY=
set OPENAI_KEY=
set /p ANTHROPIC_KEY="  ANTHROPIC_API_KEY  (optional, Enter = ueberspringen): "
set /p OPENAI_KEY="  OPENAI_API_KEY     (optional, Enter = ueberspringen): "

REM Keys in .env schreiben via PowerShell
echo   Schreibe Keys in .env...

powershell -NoProfile -Command "$c = Get-Content '.env' -Raw; $c = $c -replace '(?m)^OPENROUTER_API_KEY=.*$', 'OPENROUTER_API_KEY=%OR_KEY%'; Set-Content '.env' $c -NoNewline"
if %errorlevel% neq 0 ( echo [FEHLER] .env konnte nicht geschrieben werden. & pause & exit /b 1 )

if not "%ANTHROPIC_KEY%"=="" (
    powershell -NoProfile -Command "$c = Get-Content '.env' -Raw; $c = $c -replace '(?m)^ANTHROPIC_API_KEY=.*$', 'ANTHROPIC_API_KEY=%ANTHROPIC_KEY%'; Set-Content '.env' $c -NoNewline"
)
if not "%OPENAI_KEY%"=="" (
    powershell -NoProfile -Command "$c = Get-Content '.env' -Raw; $c = $c -replace '(?m)^OPENAI_API_KEY=.*$', 'OPENAI_API_KEY=%OPENAI_KEY%'; Set-Content '.env' $c -NoNewline"
)

echo   OK: .env konfiguriert.
echo.

REM ── 3. Backend-Abhängigkeiten ─────────────────────────────────────────────────

:npm_install
echo [3/4] Installiere Backend-Abhaengigkeiten...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [FEHLER] npm install fehlgeschlagen.
    echo Internetverbindung pruefen oder npm-Version aktualisieren.
    pause
    exit /b 1
)
echo   OK: Backend-Abhaengigkeiten installiert.
echo.

REM ── 4. Frontend installieren und bauen ───────────────────────────────────────

echo [4/4] Installiere und baue Frontend (dauert 1-2 Min)...

if not exist frontend\orbit-control (
    echo [FEHLER] Verzeichnis 'frontend\orbit-control' nicht gefunden.
    pause
    exit /b 1
)

cd frontend\orbit-control

call npm install
if %errorlevel% neq 0 (
    cd ..\..\
    echo [FEHLER] Frontend npm install fehlgeschlagen.
    pause
    exit /b 1
)

call npm run build
if %errorlevel% neq 0 (
    cd ..\..\
    echo [FEHLER] Frontend Build fehlgeschlagen. Details in der Ausgabe oben.
    pause
    exit /b 1
)

cd ..\..\
echo   OK: Frontend gebaut.
echo.

REM ── Shortcuts erstellen ───────────────────────────────────────────────────────

echo Erstelle Desktop-Verkuepfungen mit KI-OS Icon...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcuts.ps1" -Both
if %errorlevel% neq 0 (
    echo   [HINWEIS] Shortcuts konnten nicht erstellt werden - bitte manuell ausfuehren.
)
echo.

REM ── Fertig ────────────────────────────────────────────────────────────────────

echo ========================================================
echo   KI-OS Community Edition ist bereit!
echo.
echo   Starten:  START-community.bat  (oder Icon auf dem Desktop)
echo   Browser:  http://localhost:3000
echo ========================================================
echo.
pause
exit /b 0
