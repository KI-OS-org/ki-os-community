#!/bin/bash
# ============================================================
#  KI-OS Community Edition — Setup (Mac/Linux)
#  Installiert Abhängigkeiten, konfiguriert .env, baut Frontend.
#  Ausführen: bash setup.sh
#
#  (c) 2026 ki-os.org — Ingo Schaffer & Kimba <kimba@ki-os.org>
#  AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "\n  ${RED}✗  FEHLER: $1${NC}" >&2; echo -e "  Hilfe: https://ki-os.org/docs/setup\n" >&2; exit 1; }
info() { echo -e "  ${BLUE}·${NC}  $1"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   KI-OS Community Edition — Setup                    ║${NC}"
echo -e "${BLUE}║   (c) 2026 ki-os.org — Ingo Schaffer & Kimba         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Node.js Check ──────────────────────────────────────────────────────────

info "Prüfe Node.js..."
command -v node &>/dev/null || fail "Node.js nicht gefunden. Bitte installieren: https://nodejs.org"

NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js v${NODE_VER} zu alt — mindestens v20 erforderlich. Update: https://nodejs.org"
ok "Node.js v${NODE_VER}"
echo ""

# ── 2. .env konfigurieren ─────────────────────────────────────────────────────

info "Konfiguriere .env..."

if [ -f ".env" ]; then
  warn ".env existiert bereits — wird nicht überschrieben."
else
  [ -f ".env.example" ] || fail ".env.example nicht gefunden. Bitte im KI-OS Stammverzeichnis ausführen."
  cp .env.example .env
  ok ".env aus .env.example erstellt."

  # Hilfsfunktion: sed-kompatibles Escaping für Sonderzeichen im Replacement
  # Verwendet | als Trennzeichen statt / um Konflikte mit API-Keys zu vermeiden
  set_env_key() {
    local key="$1"
    local value="$2"
    [ -z "$value" ] && return
    local escaped
    escaped=$(printf '%s\n' "$value" | sed 's/[&|\\]/\\&/g')
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${escaped}|" .env
    else
      sed -i "s|^${key}=.*|${key}=${escaped}|" .env
    fi
  }

  echo ""
  echo "  Bitte API-Keys eingeben (OpenRouter ist Pflicht, Rest optional):"
  echo "  Keys bekommst du unter: https://openrouter.ai/keys"
  echo ""

  # OpenRouter — Pflicht (max. 3 Versuche)
  OR_KEY=""
  for attempt in 1 2 3; do
    read -r -p "  OPENROUTER_API_KEY: " OR_KEY
    [ -n "$OR_KEY" ] && break
    warn "OPENROUTER_API_KEY ist Pflichtfeld. Versuch ${attempt}/3."
    [ "$attempt" -eq 3 ] && fail "OPENROUTER_API_KEY ist erforderlich um KI-OS zu starten."
  done
  set_env_key "OPENROUTER_API_KEY" "$OR_KEY"

  # Optional
  read -r -p "  ANTHROPIC_API_KEY  (optional, Enter = überspringen): " ANTHROPIC_KEY || true
  set_env_key "ANTHROPIC_API_KEY" "${ANTHROPIC_KEY:-}"

  read -r -p "  OPENAI_API_KEY     (optional, Enter = überspringen): " OPENAI_KEY || true
  set_env_key "OPENAI_API_KEY" "${OPENAI_KEY:-}"

  echo ""
  ok ".env konfiguriert."
fi
echo ""

# ── 3. Backend-Abhängigkeiten installieren ────────────────────────────────────

info "Installiere Backend-Abhängigkeiten (npm install)..."
npm install --silent || fail "npm install fehlgeschlagen. Internetverbindung und npm-Version prüfen."
ok "Backend-Abhängigkeiten installiert."
echo ""

# ── 4. Frontend installieren und bauen ───────────────────────────────────────

[ -d "frontend/orbit-control" ] || fail "Verzeichnis 'frontend/orbit-control' nicht gefunden."

info "Installiere Frontend-Abhängigkeiten..."
(cd frontend/orbit-control && npm install --silent) || fail "Frontend npm install fehlgeschlagen."

info "Baue Frontend (Next.js build — dauert 1-2 Min)..."
(cd frontend/orbit-control && npm run build) || fail "Frontend Build fehlgeschlagen. Details in der Ausgabe oben."

ok "Frontend gebaut."
echo ""

# ── 5. App Bundles erstellen (macOS only) ─────────────────────────────────────

if [[ "$(uname)" == "Darwin" ]]; then
  info "Erstelle App Bundles mit KI-OS Icon..."
  bash "$SCRIPT_DIR/create-macos-app.sh" --desktop || \
    warn "App Bundles konnten nicht erstellt werden — bitte manuell: bash create-macos-app.sh"
fi

# ── 6. Fertig ─────────────────────────────────────────────────────────────────

echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   KI-OS Community Edition ist bereit!                ║${NC}"
echo -e "${GREEN}║                                                       ║${NC}"
echo -e "${GREEN}║   Starten:   bash start-community.sh                 ║${NC}"
echo -e "${GREEN}║   Browser:   http://localhost:3000                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
