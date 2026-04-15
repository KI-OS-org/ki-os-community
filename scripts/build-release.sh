#!/usr/bin/env bash
# ============================================================
#  KI-OS  --  Release Build Script  (macOS / Linux)
#  Erzeugt eine saubere, gezippte Release-Version
#  (c) 2026 by Ingo Schaffer
#
#  Verwendung:
#    ./scripts/build-release.sh              -- vollstaendiger Build
#    ./scripts/build-release.sh --skip-build -- ohne next build
#    ./scripts/build-release.sh --skip-clean -- ohne Cache-Clean
#    ./scripts/build-release.sh --dry-run    -- Testlauf
# ============================================================
set -euo pipefail

# ── Optionen ─────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_CLEAN=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-clean) SKIP_CLEAN=true ;;
    --dry-run)    DRY_RUN=true    ;;
    *) echo "Unbekannte Option: $arg" && exit 1 ;;
  esac
done

# ── Pfade ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND="$ROOT/frontend/orbit-control"
DIST="$ROOT/dist"

# ── Version ───────────────────────────────────────────────────
VERSION="1.0.2"
if [ -f "$ROOT/.ki-os-version" ]; then
  VERSION="$(cat "$ROOT/.ki-os-version" | tr -d '[:space:]')"
fi

DATE_STR="$(date +%Y%m%d)"
RELEASE_NAME="ki-os-v${VERSION}-release-${DATE_STR}"
STAGE="$DIST/$RELEASE_NAME"
ZIP="$DIST/${RELEASE_NAME}.zip"

TOTAL=7

# ── Farben (deaktivieren falls kein Terminal) ─────────────────
if [ -t 1 ]; then
  C_CYAN='\033[0;36m'  C_GREEN='\033[0;32m'
  C_YELLOW='\033[0;33m' C_GRAY='\033[0;90m'
  C_WHITE='\033[1;37m'  C_RED='\033[0;31m'
  C_RESET='\033[0m'
else
  C_CYAN='' C_GREEN='' C_YELLOW='' C_GRAY='' C_WHITE='' C_RED='' C_RESET=''
fi

step()  { echo -e "${C_GRAY}  [$1/$TOTAL]${C_RESET} ${C_CYAN}$2${C_RESET}"; }
ok()    { echo -e "         ${C_GREEN}OK${C_RESET}  $1"; }
warn()  { echo -e "       ${C_YELLOW}WARN${C_RESET}  $1"; }
fail()  { echo -e "      ${C_RED}ERROR${C_RESET}  $1"; exit 1; }

format_size() {
  local bytes=$1
  if   command -v numfmt &>/dev/null; then numfmt --to=iec-i --suffix=B "$bytes"
  elif [ "$bytes" -ge 1073741824 ];   then echo "$(( bytes / 1073741824 )) GB"
  elif [ "$bytes" -ge 1048576 ];      then echo "$(( bytes / 1048576 )) MB"
  else                                     echo "$(( bytes / 1024 )) KB"
  fi
}

# ── Banner ────────────────────────────────────────────────────
clear
echo ""
echo -e "${C_CYAN}  +--------------------------------------------------+${C_RESET}"
echo -e "${C_CYAN}  |                                                  |${C_RESET}"
echo -e "${C_WHITE}  |    KI-OS  Release Builder  v${VERSION}${C_RESET}"
echo -e "${C_WHITE}  |    Ziel: ${RELEASE_NAME}.zip${C_RESET}"
if $DRY_RUN; then
echo -e "${C_YELLOW}  |    *** DRY-RUN -- keine Aenderungen ***${C_RESET}"
fi
echo -e "${C_CYAN}  |                                                  |${C_RESET}"
echo -e "${C_CYAN}  +--------------------------------------------------+${C_RESET}"
echo ""

# ── Step 1: Voraussetzungen ───────────────────────────────────
step 1 "Voraussetzungen pruefen"

command -v node &>/dev/null || fail "Node.js nicht gefunden. Installieren: https://nodejs.org"
command -v npm  &>/dev/null || fail "npm nicht gefunden."

NODE_VER=$(node --version)
NPM_VER=$(npm --version)
ok "Node $NODE_VER  /  npm $NPM_VER"

# zip pruefen
if ! command -v zip &>/dev/null; then
  warn "zip nicht gefunden. Installieren:"
  warn "  macOS:  brew install zip"
  warn "  Ubuntu: sudo apt-get install zip"
  fail "zip wird benoetigt"
fi

[ -f "$ZIP" ] && warn "ZIP existiert bereits und wird ueberschrieben"

# ── Step 2: Cache bereinigen ──────────────────────────────────
step 2 "Cache bereinigen"

if ! $SKIP_CLEAN && ! $DRY_RUN; then
  for target in \
    "$FRONTEND/.next" \
    "$FRONTEND/.turbo" \
    "$FRONTEND/out" \
    "$DIST"
  do
    if [ -d "$target" ]; then
      rm -rf "$target"
      ok "Entfernt: ${target#$ROOT/}"
    fi
  done
  # Logs (nicht in node_modules)
  find "$ROOT" -name "*.log" -not -path "*/node_modules/*" -delete 2>/dev/null || true
  ok "Logs bereinigt"
else
  warn "Cache-Bereinigung uebersprungen"
fi

# ── Step 3: Abhaengigkeiten installieren ──────────────────────
step 3 "Abhaengigkeiten installieren (npm ci)"

if ! $DRY_RUN; then
  echo -e "         ${C_GRAY}Installiere...${C_RESET}"
  (cd "$ROOT" && npm ci --prefer-offline)
  ok "npm ci abgeschlossen"
else
  warn "DryRun: npm ci uebersprungen"
fi

# ── Step 4: Frontend bauen ────────────────────────────────────
step 4 "Frontend bauen (next build)"

if ! $SKIP_BUILD && ! $DRY_RUN; then
  echo -e "         ${C_GRAY}Baue Next.js -- das dauert 1-3 Minuten...${C_RESET}"
  (cd "$FRONTEND" && npx next build)
  ok "next build abgeschlossen"

  # .next/cache entfernen
  if [ -d "$FRONTEND/.next/cache" ]; then
    rm -rf "$FRONTEND/.next/cache"
    ok ".next/cache entfernt (Laufzeit braucht ihn nicht)"
  fi
else
  warn "next build uebersprungen"
fi

# ── Step 5: Staging befuellen ─────────────────────────────────
step 5 "Release-Paket zusammenstellen"

if ! $DRY_RUN; then
  mkdir -p "$STAGE"

  # Root-Dateien kopieren
  ROOT_FILES=(
    "KI-OS.bat" "KI-OS-Start.ps1" "ki-os.sh"
    "index.js" "package.json" "package-lock.json"
    ".env.example" ".ki-os-version" "build-community.js"
  )
  for f in "${ROOT_FILES[@]}"; do
    [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$STAGE/" || warn "Nicht gefunden: $f"
  done

  # Verzeichnisse kopieren (rsync bevorzugt, Fallback cp)
  copy_dir() {
    local src="$1" dst="$2"
    mkdir -p "$dst"
    if command -v rsync &>/dev/null; then
      rsync -a --delete \
        --exclude='node_modules/' \
        --exclude='.git/' \
        --exclude='.turbo/' \
        --exclude='.claude/' \
        --exclude='*.log' \
        --exclude='*.ndjson' \
        "$src/" "$dst/"
    else
      # Fallback: cp + find-Bereinigung
      cp -r "$src/." "$dst/"
      find "$dst" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
      find "$dst" -type d -name ".git"         -exec rm -rf {} + 2>/dev/null || true
      find "$dst" -type d -name ".turbo"       -exec rm -rf {} + 2>/dev/null || true
      find "$dst" -name "*.log"    -delete 2>/dev/null || true
      find "$dst" -name "*.ndjson" -delete 2>/dev/null || true
    fi
  }

  for dir in backend core runtime scripts; do
    if [ -d "$ROOT/$dir" ]; then
      copy_dir "$ROOT/$dir" "$STAGE/$dir"
      ok "$dir/ kopiert"
    fi
  done

  # Frontend (ohne .next/cache -- schon entfernt)
  copy_dir "$FRONTEND" "$STAGE/frontend/orbit-control"
  ok "frontend/orbit-control/ kopiert"

  # INSTALL.txt
  cat > "$STAGE/INSTALL.txt" << EOF
KI-OS $VERSION -- Installationsanleitung
==========================================

Voraussetzungen:
  - Node.js >= 20  (https://nodejs.org)
  - npm  >= 9

1. Abhaengigkeiten installieren:
     npm ci

2. Umgebung konfigurieren:
     Kopiere .env.example nach .env
     Trage API-Keys und Einstellungen ein

3. Starten:
     Windows:      KI-OS.bat
     macOS/Linux:  chmod +x ki-os.sh && ./ki-os.sh

Weitere Infos: https://ki-os.org
EOF
  ok "INSTALL.txt erstellt"
else
  warn "DryRun: Staging uebersprungen"
fi

# ── Step 6: ZIP erstellen ─────────────────────────────────────
step 6 "ZIP erstellen: ${RELEASE_NAME}.zip"

if ! $DRY_RUN; then
  echo -e "         ${C_GRAY}Komprimiere...${C_RESET}"
  mkdir -p "$DIST"
  (cd "$DIST" && zip -r -9 "$ZIP" "$RELEASE_NAME/" -q)

  # Staging entfernen
  rm -rf "$STAGE"
  ok "Staging-Verzeichnis bereinigt"
else
  warn "DryRun: ZIP uebersprungen"
  [ -d "$STAGE" ] && rm -rf "$STAGE"
fi

# ── Step 7: Ergebnis ──────────────────────────────────────────
step 7 "Fertig"

if ! $DRY_RUN && [ -f "$ZIP" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    SIZE=$(stat -f%z "$ZIP")
  else
    SIZE=$(stat -c%s "$ZIP")
  fi
  SIZE_FMT=$(format_size "$SIZE")

  echo ""
  echo -e "${C_GREEN}  +--------------------------------------------------+${C_RESET}"
  echo -e "${C_GREEN}  |  Release bereit!                                 |${C_RESET}"
  printf   "  |  Datei:   %-38s|\n" "${RELEASE_NAME}.zip"
  printf   "  |  Groesse: %-38s|\n" "$SIZE_FMT"
  printf   "  |  Pfad:    %-38s|\n" "dist/"
  echo -e "${C_GREEN}  |                                                  |${C_RESET}"
  echo -e "${C_GRAY}  |  Entpacken + starten:                            |${C_RESET}"
  echo -e "${C_GRAY}  |    1. unzip ${RELEASE_NAME}.zip         |${C_RESET}"
  echo -e "${C_GRAY}  |    2. npm ci                                     |${C_RESET}"
  echo -e "${C_GRAY}  |    3. .env.example -> .env  (Keys eintragen)     |${C_RESET}"
  echo -e "${C_GRAY}  |    4. ./ki-os.sh                                 |${C_RESET}"
  echo -e "${C_GREEN}  +--------------------------------------------------+${C_RESET}"
  echo ""
elif $DRY_RUN; then
  echo ""
  echo -e "${C_YELLOW}  DryRun abgeschlossen -- keine Dateien erstellt.${C_RESET}"
  echo -e "${C_YELLOW}  Aufruf ohne --dry-run fuer echten Release-Build.${C_RESET}"
  echo ""
fi
