#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=3000
FRONTEND_PORT=3001
STANDALONE="$SCRIPT_DIR/frontend/.next/standalone/server.js"

echo ""
echo "  KI-OS Community Edition"
echo "  ========================"
echo ""

if [ ! -f "$STANDALONE" ]; then
  echo "  ERROR: Frontend nicht gebaut."
  echo "  Bitte zuerst: cd frontend && npx next build"
  exit 1
fi

# Backend
echo "  > Backend starten (Port $BACKEND_PORT)..."
node "$SCRIPT_DIR/runtime/local/server.js" &
BACKEND_PID=$!

# Warten auf Backend
echo -n "  ~ Warte auf Backend "
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" > /dev/null 2>&1; then
    echo " OK"
    break
  fi
  echo -n "."
  sleep 1
done

# Frontend (standalone)
echo "  > Frontend starten (Port $FRONTEND_PORT)..."
PORT=$FRONTEND_PORT HOSTNAME=127.0.0.1 node "$STANDALONE" &
FRONTEND_PID=$!

echo -n "  ~ Warte auf Frontend "
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo " OK"
    break
  fi
  echo -n "."
  sleep 1
done

echo ""
echo "  Backend  : http://127.0.0.1:$BACKEND_PORT"
echo "  Frontend : http://localhost:$FRONTEND_PORT"
echo ""
echo "  Ctrl+C zum Beenden"
wait $BACKEND_PID $FRONTEND_PID
