#!/usr/bin/env bash
set -euo pipefail
APP_VERSION="1.0.2"
if [ -f ".ki-os-version" ]; then
  APP_VERSION="$(cat .ki-os-version)"
fi

echo "=========================================="
echo "KI-OS ${APP_VERSION} Local Install"
echo "=========================================="

echo "[1/6] Root-Abhängigkeiten installieren..."
npm install

echo "[2/6] Frontend-Abhängigkeiten installieren..."
cd frontend/orbit-control
npm install

echo "[3/6] .env.local vorbereiten..."
if [ ! -f .env.local ] && [ -f .env.local.example ]; then
  cp .env.local.example .env.local
fi

echo "[4/6] Zurück ins Root..."
cd ../..

echo "[5/6] Doctor Full..."
npm run doctor:full

echo "[6/6] Stack bereit. Start mit ./KI-OS-Start.bat oder npm run start:stack"
