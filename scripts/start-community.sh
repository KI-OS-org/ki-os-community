#!/bin/bash
# =============================================================================
# KI-OS Community Edition — Startup Script (Linux/Mac)
# 
# Automatisierte Installation und Start von KI-OS
# - Prüft Node.js Version
# - Installiert Dependencies (wenn nötig)
# - Bereinigt alte Prozesse
# - Validiert Konfiguration
# - Startet den Server
# =============================================================================

set -e

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────────
# Konfiguration
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMUNITY_PORT="${PORT:-8080}"

cd "$SCRIPT_DIR"

# ─────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          KI-OS Community Edition — Startup Script             ║"
    echo "║                     Version 1.1.1-security                    ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
}

print_step() {
    echo -e "${BLUE}[$1]${NC} $2"
}

print_error() {
    echo -e "${RED}❌ ERROR:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
}

# ─────────────────────────────────────────────────────────────────
# Node.js Version prüfen
# ─────────────────────────────────────────────────────────────────

print_step "1" "Prüfe Node.js Version"

if ! command -v node &> /dev/null; then
    print_error "Node.js nicht installiert oder nicht im PATH"
    echo ""
    echo "Bitte Node.js installieren: https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v\([0-9]*\)\..*/\1/')

if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js Version $NODE_VERSION ist zu alt (minimum 20)"
    echo ""
    echo "Bitte Node.js aktualisieren: https://nodejs.org/"
    echo ""
    exit 1
fi

print_success "Node.js v$NODE_VERSION ist installiert"

# ─────────────────────────────────────────────────────────────────
# Laufende Prozesse terminieren
# ─────────────────────────────────────────────────────────────────

echo ""
print_step "2" "Prüfe auf laufende KI-OS Prozesse"

KILLED_COUNT=0

# Funktion zum Killen von Prozessen auf einem Port
kill_processes_on_port() {
    local port=$1
    local pids
    
    # lsof verwenden um PIDs zu finden
    pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo "  Port $port wird verwendet von PID(s): $(echo $pids | tr '\n' ', ')"
        
        for pid in $pids; do
            echo "  Terminate PID $pid..."
            
            # Erst sanft terminieren
            if kill -TERM $pid 2>/dev/null; then
                echo "  PID $pid sanft terminiert"
                KILLED_COUNT=$((KILLED_COUNT + 1))
                
                # Kurz warten
                sleep 1
                
                # Falls noch aktiv, forcefully kill
                if lsof -ti :$port 2>/dev/null | grep -q "^$pid$"; then
                    echo "  PID $pid reagiert nicht — force kill..."
                    if kill -KILL $pid 2>/dev/null; then
                        echo "  PID $pid terminiert"
                    else
                        print_warning "Konnte PID $pid nicht terminieren"
                    fi
                fi
            else
                print_warning "Konnte PID $pid nicht terminieren"
            fi
        done
    fi
}

kill_processes_on_port $COMMUNITY_PORT
kill_processes_on_port 3000

if [ $KILLED_COUNT -gt 0 ]; then
    print_success "$KILLED_COUNT Prozess(e) terminiert"
    sleep 1
else
    print_step "✓" "Keine laufenden KI-OS Prozesse"
fi

# ─────────────────────────────────────────────────────────────────
# Dependencies prüfen und installieren
# ─────────────────────────────────────────────────────────────────

echo ""
print_step "3" "Prüfe Dependencies"

check_node_modules() {
    [ -d "node_modules/express" ] && \
    [ -d "node_modules/cors" ] && \
    [ -d "node_modules/dotenv" ]
}

if check_node_modules; then
    print_success "node_modules sind vollständig installiert"
    print_step "i" "Überspringe npm install (bereits installiert)"
else
    print_step "i" "node_modules fehlen oder sind unvollständig — installiere..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json nicht gefunden"
        exit 1
    fi
    
    if npm install --no-audit --no-fund --prefer-offline; then
        print_success "Dependencies installiert"
    else
        print_error "npm install fehlgeschlagen"
        print_error "Manuell ausführen: npm install"
        exit 1
    fi
fi

# ─────────────────────────────────────────────────────────────────
# Umgebung validieren
# ─────────────────────────────────────────────────────────────────

echo ""
print_step "4" "Validiere Umgebung"

if [ ! -f ".env" ]; then
    print_step "i" ".env nicht gefunden — erstelle..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success ".env aus .env.example erstellt"
    else
        echo "KI_OS_EDITION=community" > .env
        echo "NODE_ENV=production" >> .env
        echo "PORT=8080" >> .env
        print_success "Minimale .env erstellt"
    fi
else
    print_step "✓" ".env existiert bereits"
fi

# Prüfe ob API Keys konfiguriert sind
if ! grep -qi "ANTHROPIC_API_KEY=.*" .env && \
   ! grep -qi "OPENAI_API_KEY=.*" .env && \
   ! grep -qi "GOOGLE_GENERATIVE_AI_API_KEY=.*" .env && \
   ! grep -qi "DASHSCOPE_API_KEY=.*" .env; then
    echo ""
    print_warning "Kein AI Provider API Key in .env konfiguriert"
    print_warning "KI-OS wird im Demo-Modus starten (eingeschränkte Funktionalität)"
    print_warning "Bearbeite .env und füge mindestens einen API Key hinzu"
fi

print_success "Umgebung validiert"

# ─────────────────────────────────────────────────────────────────
# Server starten
# ─────────────────────────────────────────────────────────────────

echo ""
print_step "5" "Starte KI-OS Community Server"
echo ""
echo "  Port: $COMMUNITY_PORT"
echo "  Edition: community"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Cleanup bei Ctrl+C
cleanup() {
    echo ""
    print_step "i" "Shutdown initiated..."
    if [ -n "$SERVER_PID" ]; then
        kill -TERM $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    print_success "KI-OS sauber beendet"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Server im Vordergrund starten
export KI_OS_EDITION=community
export PORT=$COMMUNITY_PORT

node runtime/local/server.js &
SERVER_PID=$!

# Warte auf Server-Prozess
wait $SERVER_PID
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    print_success "KI-OS sauber beendet"
else
    print_error "KI-OS beendet mit Code $EXIT_CODE"
fi

exit $EXIT_CODE
