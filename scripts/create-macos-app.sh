#!/bin/bash
# ============================================================
#  KI-OS Community Edition -- macOS App Bundle Creator
#  Erstellt .app Bundles fuer Setup und Start mit KI-OS Icon
#  Aufruf: bash create-macos-app.sh [--desktop]
#
#  (c) 2026 ki-os.org -- Ingo Schaffer & Kimba <kimba@ki-os.org>
#  AGPL-3.0-only
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR"
ICON_SRC="$ROOT/Web/icon.png"
ICNS_PATH="$ROOT/KI-OS.icns"
DESKTOP_MODE=false

for arg in "$@"; do
  [[ "$arg" == "--desktop" ]] && DESKTOP_MODE=true
done

ok()   { echo "  OK  $1"; }
info() { echo "  ..  $1"; }
fail() { echo "  FEHLER: $1" >&2; exit 1; }

echo ""
echo "  KI-OS App Bundle Creator"
echo ""

# ── 1. PNG -> .icns konvertieren (sips + iconutil, beide macOS built-in) ────

if [[ ! -f "$ICON_SRC" ]]; then
  fail "icon.png nicht gefunden: $ICON_SRC"
fi

if [[ ! -f "$ICNS_PATH" ]]; then
  info "Konvertiere icon.png -> KI-OS.icns..."

  ICONSET="$ROOT/KI-OS.iconset"
  mkdir -p "$ICONSET"

  # Alle Groessen die macOS benoetigt
  declare -A SIZES=(
    [16]="icon_16x16"
    [32]="icon_16x16@2x icon_32x32"
    [64]="icon_32x32@2x"
    [128]="icon_128x128"
    [256]="icon_128x128@2x icon_256x256"
    [512]="icon_256x256@2x icon_512x512"
    [1024]="icon_512x512@2x"
  )

  for px in "${!SIZES[@]}"; do
    for name in ${SIZES[$px]}; do
      sips -z $px $px "$ICON_SRC" --out "$ICONSET/${name}.png" > /dev/null 2>&1
    done
  done

  iconutil -c icns "$ICONSET" -o "$ICNS_PATH"
  rm -rf "$ICONSET"
  ok "KI-OS.icns erstellt"
else
  ok "KI-OS.icns vorhanden"
fi

# ── 2. App Bundle erstellen ──────────────────────────────────

make_app() {
  local APP_NAME="$1"
  local DISPLAY_NAME="$2"
  local BUNDLE_ID="$3"
  local DESCRIPTION="$4"
  local SCRIPT_CMD="$5"
  local DEST_DIR="$6"

  local APP_PATH="$DEST_DIR/${APP_NAME}.app"
  local MACOS_DIR="$APP_PATH/Contents/MacOS"
  local RES_DIR="$APP_PATH/Contents/Resources"

  rm -rf "$APP_PATH"
  mkdir -p "$MACOS_DIR" "$RES_DIR"

  # Icon kopieren
  cp "$ICNS_PATH" "$RES_DIR/AppIcon.icns"

  # Info.plist
  cat > "$APP_PATH/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleName</key>
    <string>${DISPLAY_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${DISPLAY_NAME}</string>
    <key>CFBundleVersion</key>
    <string>1.6.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.6.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>
    <key>NSHumanReadableCopyright</key>
    <string>(c) 2026 ki-os.org</string>
</dict>
</plist>
PLIST

  # Launcher-Script
  cat > "$MACOS_DIR/launcher" << LAUNCHER
#!/bin/bash
# ${DISPLAY_NAME} -- ${DESCRIPTION}
ROOT="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "\$ROOT"

osascript <<APPLE
tell application "Terminal"
    activate
    do script "cd '\$ROOT' && ${SCRIPT_CMD}"
end tell
APPLE
LAUNCHER

  chmod +x "$MACOS_DIR/launcher"
  chmod -R 755 "$APP_PATH"

  ok "${APP_NAME}.app  ($DEST_DIR)"
}

# Shortcuts im KI-OS Ordner (immer)
make_app \
  "KI-OS Setup" \
  "KI-OS Setup" \
  "org.ki-os.setup" \
  "Node.js, Abhaengigkeiten und API-Key einrichten" \
  "bash setup.sh" \
  "$ROOT"

make_app \
  "KI-OS Starten" \
  "KI-OS Starten" \
  "org.ki-os.start" \
  "KI-OS Community Edition starten" \
  "bash start-community.sh" \
  "$ROOT"

# Optional: Desktop
if [[ "$DESKTOP_MODE" == true ]]; then
  DESKTOP_DIR="$HOME/Desktop"
  if [[ -d "$DESKTOP_DIR" ]]; then
    make_app "KI-OS Setup"   "KI-OS Setup"   "org.ki-os.setup" \
      "Node.js, Abhaengigkeiten und API-Key einrichten" \
      "bash setup.sh" "$DESKTOP_DIR"
    make_app "KI-OS Starten" "KI-OS Starten" "org.ki-os.start" \
      "KI-OS Community Edition starten" \
      "bash start-community.sh" "$DESKTOP_DIR"
  fi
fi

echo ""
echo "  Fertig! KI-OS Setup oder KI-OS Starten im Finder doppelklicken."
echo "  Beim ersten Start: Rechtsklick -> Oeffnen (Sicherheitshinweis umgehen)"
echo ""
