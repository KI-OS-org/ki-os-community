# ============================================================
#  KI-OS Security Hook Setup — Windows PowerShell
#  Installiert gitleaks + pre-push Hook auf Windows
#  Ausführen: .\scripts\setup-security-hook.ps1
#
#  (c) 2026 ki-os.org — Ingo Schaffer & Kimba <kimba@ki-os.org>
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = (git rev-parse --show-toplevel)
$HOOKS_DIR = "$ROOT\.git\hooks"
$BIN_DIR = "$env:USERPROFILE\bin"
$GITLEAKS = "$BIN_DIR\gitleaks.exe"
$GITLEAKS_VERSION = "8.21.2"

function Write-OK   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [ERROR] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "  [-] $msg" -ForegroundColor Cyan }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   KI-OS Security Hook Setup (Windows)" -ForegroundColor Cyan
Write-Host "   Installiert: gitleaks + pre-push Hook" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Schritt 1: gitleaks herunterladen ────────────────────────────────────────
Write-Host "[1/3] gitleaks installieren..."

if (Test-Path $GITLEAKS) {
    $ver = & $GITLEAKS version 2>$null
    Write-OK "gitleaks bereits installiert: $ver"
} else {
    New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null
    $url = "https://github.com/gitleaks/gitleaks/releases/download/v$GITLEAKS_VERSION/gitleaks_${GITLEAKS_VERSION}_windows_x64.zip"
    $zip = "$env:TEMP\gitleaks.zip"

    Write-Info "Lade gitleaks v$GITLEAKS_VERSION..."
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $env:TEMP\gitleaks_tmp -Force
    Move-Item -Path "$env:TEMP\gitleaks_tmp\gitleaks.exe" -Destination $GITLEAKS -Force
    Remove-Item $zip -Force
    Remove-Item "$env:TEMP\gitleaks_tmp" -Recurse -Force

    $ver = & $GITLEAKS version 2>$null
    Write-OK "gitleaks installiert: $ver"

    # PATH ergänzen falls nötig
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($currentPath -notlike "*$BIN_DIR*") {
        [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$BIN_DIR", "User")
        Write-Info "$BIN_DIR zu PATH hinzugefügt (wirkt ab nächster Session)"
    }
}
Write-Host ""

# ── Schritt 2: pre-push Hook installieren ────────────────────────────────────
Write-Host "[2/3] pre-push Hook installieren..."

$hookContent = @'
#!/bin/sh
# KI-OS Pre-Push Security Hook (Windows-kompatibel)
# Layer 1: gitleaks — scannt komplette Push-Range
# Layer 2: github-safe-push.js — Default DENY Whitelist

ROOT=$(git rev-parse --show-toplevel)
GITLEAKS="$USERPROFILE/bin/gitleaks.exe"
ERRORS=0

echo ""
echo "======================================================"
echo "  KI-OS Security Pre-Push Hook"
echo "  Layer 1: gitleaks | Layer 2: github-safe-push.js"
echo "======================================================"
echo ""

# Layer 1: gitleaks
echo "Layer 1: gitleaks (Commit-History)"
if [ ! -x "$GITLEAKS" ]; then
  GITLEAKS="gitleaks"
fi

SCAN_FAILED=0
while IFS=' ' read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
    RANGE="$local_sha"
  else
    RANGE="${remote_sha}..${local_sha}"
  fi
  echo "  Scanne: $RANGE"
  # Note: no --source flag (does not exist in gitleaks v8.x)
  # Run from repo root so gitleaks auto-detects the repo
  if ! (cd "$ROOT" && "$GITLEAKS" git \
      --log-opts="$RANGE" \
      --no-banner \
      --exit-code=1 2>/dev/null); then
    SCAN_FAILED=1
  fi
done

if [ $SCAN_FAILED -eq 1 ]; then
  echo "  FEHLER: Secrets in Commit-History gefunden!"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: Keine Secrets in Commit-History"
fi

# Layer 2: github-safe-push.js (--hook = fast mode, kein Content-Scan)
echo ""
echo "Layer 2: github-safe-push.js (Default DENY)"
if [ -f "$ROOT/scripts/github-safe-push.js" ]; then
  if ! node "$ROOT/scripts/github-safe-push.js" --hook 2>/dev/null; then
    ERRORS=$((ERRORS + 1))
  fi
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "  GRUEN -- Push wird durchgeführt"
  exit 0
else
  echo "  ROT -- Push BLOCKIERT ($ERRORS Fehler)"
  echo "  Secrets oder verbotene Dateien gefunden!"
  exit 1
fi
'@

New-Item -ItemType Directory -Force -Path $HOOKS_DIR | Out-Null
$hookPath = "$HOOKS_DIR\pre-push"
Set-Content -Path $hookPath -Value $hookContent -Encoding UTF8 -NoNewline
Write-OK "pre-push Hook installiert: $hookPath"
Write-Host ""

# ── Schritt 3: Test-Run ───────────────────────────────────────────────────────
Write-Host "[3/3] Security Gate Test..."

$result = & node "$ROOT\scripts\github-safe-push.js" --hook 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "github-safe-push.js: GRÜN"
} else {
    Write-Fail "github-safe-push.js: Fehler gefunden — bitte prüfen"
    Write-Host $result
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "   Setup abgeschlossen!" -ForegroundColor Green
Write-Host "   Ab sofort läuft der Security Hook bei jedem git push." -ForegroundColor Green
Write-Host "   Manueller Scan: node scripts/github-safe-push.js --hook" -ForegroundColor Green
Write-Host "   History-Scan:   gitleaks git --log-opts=HEAD --no-banner" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
