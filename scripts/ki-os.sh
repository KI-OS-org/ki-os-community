#!/usr/bin/env bash
# ============================================================
#  KI-OS  Orbit Control  --  macOS / Linux Launcher
#  (c) 2026 by Ingo Schaffer
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_VERSION="1.0.2"
if [ -f "$ROOT_DIR/.ki-os-version" ]; then
  APP_VERSION="$(cat "$ROOT_DIR/.ki-os-version")"
fi

BACKEND_PORT=3000
FRONTEND_PORT=3001
FRONTEND_DIR="$ROOT_DIR/frontend/orbit-control"

# ── Banner ────────────────────────────────────────────────────
clear
echo ""
echo "  +--------------------------------------------------+"
echo "  |                                                  |"
echo "  |    ( KI )   KI-OS  Orbit Control  v$APP_VERSION        |"
echo "  |    (    )   AI Operating System                  |"
echo "  |    ( OS )   (c) 2026 by Ingo Schaffer            |"
echo "  |                                                  |"
echo "  +--------------------------------------------------+"
echo ""

# ── Voraussetzungen prüfen ────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "  [FEHLER] Node.js wurde nicht gefunden."
  echo "  Bitte installieren: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -e "process.exit(parseInt(process.versions.node)<20?1:0)" 2>/dev/null && echo "ok" || echo "alt")
if [ "$NODE_VER" = "alt" ]; then
  echo "  [WARNUNG] Node.js >= 20 empfohlen. Gefunden: $(node --version)"
fi

if [ ! -f "$ROOT_DIR/package.json" ]; then
  echo "  [FEHLER] package.json nicht gefunden: $ROOT_DIR"
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "  [FEHLER] Frontend package.json nicht gefunden: $FRONTEND_DIR"
  exit 1
fi

# ── node_modules prüfen ───────────────────────────────────────
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "  [1/5] node_modules fehlen – installiere Abhängigkeiten..."
  cd "$ROOT_DIR" && npm install
else
  echo "  [1/5] node_modules vorhanden."
fi

# ── Backend Doctor ────────────────────────────────────────────
echo "  [2/5] Backend-Doctor..."
if ! node "$ROOT_DIR/scripts/doctor.js" 2>/dev/null; then
  echo "  [WARNUNG] Doctor meldet Probleme – starte trotzdem fort."
fi

# ── Release Gate ──────────────────────────────────────────────
GATE="$ROOT_DIR/scripts/release-gate-$APP_VERSION.js"
if [ -f "$GATE" ]; then
  echo "  [3/5] Release-Gate $APP_VERSION..."
  if ! node "$GATE"; then
    echo "  [FEHLER] Release-Gate fehlgeschlagen."
    exit 1
  fi
else
  echo "  [3/5] Kein Release-Gate für $APP_VERSION – übersprungen."
fi

# ── Backend starten ───────────────────────────────────────────
echo "  [4/5] Backend starten (Port $BACKEND_PORT)..."
cd "$ROOT_DIR"
npm run start:local &
BACKEND_PID=$!
echo "        PID: $BACKEND_PID"

# Auf Backend warten (max 90 Sek.)
echo "  [4/5] Warte auf Backend..."
TIMEOUT=90
ELAPSED=0
until curl -sf "http://localhost:$BACKEND_PORT/health" &>/dev/null; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  printf "."
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo "  [FEHLER] Backend-Healthcheck Timeout nach ${TIMEOUT}s."
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
done
echo ""
echo "  [OK] Backend erreichbar."

# ── Frontend starten ──────────────────────────────────────────
echo "  [5/5] Frontend starten (Port $FRONTEND_PORT)..."
cd "$FRONTEND_DIR"
npm run dev -- --port "$FRONTEND_PORT" &
FRONTEND_PID=$!
echo "        PID: $FRONTEND_PID"

# ── Fertig ────────────────────────────────────────────────────
echo ""
echo "  +--------------------------------------------------+"
echo "  |  KI-OS $APP_VERSION laeuft                              |"
echo "  |  Backend:   http://localhost:$BACKEND_PORT             |"
echo "  |  Frontend:  http://localhost:$FRONTEND_PORT            |"
echo "  |                                                  |"
echo "  |  Beenden: Ctrl+C                                 |"
echo "  +--------------------------------------------------+"
echo ""

# Auf Ctrl+C warten und beides beenden
trap "echo ''; echo '  Beende KI-OS...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
