@echo off
REM KI-OS Community Edition -- Docker Quickstart (Windows)
REM Voraussetzung: Docker Desktop installiert
REM https://ki-os.org

echo.
echo  KI-OS Community v1.6.0 -- Docker Quickstart
echo  =============================================
echo.

where docker >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo Docker nicht gefunden.
    echo Bitte installieren: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

if not exist ".env" (
    echo Kein .env gefunden -- erstelle aus .env.example
    if exist ".env.example" (
        copy .env.example .env >/dev/null
        echo Bitte .env oeffnen und API-Key eintragen (mindestens einen):
        echo   ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, ...
        echo.
        notepad .env
        echo.
        pause
    ) else (
        echo .env.example nicht gefunden. Bitte manuell .env anlegen.
        pause
        exit /b 1
    )
)

echo Starte KI-OS mit Docker Compose...
docker compose up -d --build

echo.
echo KI-OS laeuft!
echo.
echo   URL:    http://localhost:3000
echo   Health: http://localhost:3000/health
echo.
echo   Logs anzeigen:  docker compose logs -f
echo   Stoppen:        docker compose down
echo.
pause
