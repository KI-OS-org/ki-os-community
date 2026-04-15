#!/bin/bash
# KI-OS Community Edition — Docker Quickstart
# Voraussetzung: Docker + Docker Compose installiert
# https://ki-os.org

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ██╗  ██╗██╗      ██████╗ ███████╗"
echo "  ██║ ██╔╝██║     ██╔═══██╗██╔════╝"
echo "  █████╔╝ ██║     ██║   ██║███████╗"
echo "  ██╔═██╗ ██║     ██║   ██║╚════██║"
echo "  ██║  ██╗██║     ╚██████╔╝███████║"
echo "  ╚═╝  ╚═╝╚═╝      ╚═════╝ ╚══════╝"
echo -e "${NC}"
echo "  KI-OS Community v1.6.0 — Docker Quickstart"
echo ""

# Docker pruefen
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker nicht gefunden.${NC}"
  echo "Bitte installieren: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo -e "${RED}Docker Compose nicht gefunden.${NC}"
  echo "Bitte Docker Desktop installieren: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

# .env pruefen / erstellen
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}Kein .env gefunden — erstelle aus .env.example${NC}"
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "${YELLOW}Bitte .env oeffnen und API-Key eintragen (mindestens einen):${NC}"
    echo "  ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, ..."
    echo ""
    read -p "API-Key bereits eingetragen? [j/N] " answer
    if [[ ! "$answer" =~ ^[jJyY]$ ]]; then
      echo "Bitte .env bearbeiten und dann erneut ausfuehren: bash start-docker.sh"
      exit 0
    fi
  else
    echo -e "${RED}.env.example nicht gefunden. Bitte manuell .env anlegen.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Starte KI-OS mit Docker Compose...${NC}"
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build

echo ""
echo -e "${GREEN}KI-OS laeuft!${NC}"
echo ""
echo "  URL:    http://localhost:3000"
echo "  Health: http://localhost:3000/health"
echo ""
echo "  Logs anzeigen:  docker compose logs -f"
echo "  Stoppen:        docker compose down"
echo ""
