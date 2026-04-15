# ============================================================
#  KI-OS  --  Release Build Script  (PowerShell)
#  Erzeugt eine saubere, gezippte Release-Version
#  (c) 2026 by Ingo Schaffer
# ============================================================
param(
  [switch]$SkipBuild,   # next build ueberspringen (z.B. wenn schon gebaut)
  [switch]$SkipClean,   # Cache-Bereinigung ueberspringen
  [switch]$DryRun       # Nur zeigen, was gemacht wuerde
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function Write-Step {
  param([int]$N, [int]$Total, [string]$Text, [string]$Color = "Cyan")
  Write-Host ("  [{0}/{1}] " -f $N, $Total) -NoNewline -ForegroundColor DarkGray
  Write-Host $Text -ForegroundColor $Color
}

function Write-Ok   { param([string]$T) Write-Host "         OK  $T" -ForegroundColor Green }
function Write-Warn { param([string]$T) Write-Host "       WARN  $T" -ForegroundColor Yellow }
function Write-Fail { param([string]$T) Write-Host "      ERROR  $T" -ForegroundColor Red; exit 1 }

function Format-Size {
  param([long]$Bytes)
  if ($Bytes -gt 1GB) { return ("{0:N1} GB" -f ($Bytes / 1GB)) }
  if ($Bytes -gt 1MB) { return ("{0:N1} MB" -f ($Bytes / 1MB)) }
  return ("{0:N0} KB" -f ($Bytes / 1KB))
}

function Invoke-Cmd {
  param([string]$Cmd, [string]$WorkDir = $null)
  $prev = $PWD
  if ($WorkDir) { Set-Location $WorkDir }
  try {
    Invoke-Expression $Cmd
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
      throw "Befehl fehlgeschlagen: $Cmd (Exit $LASTEXITCODE)"
    }
  } finally {
    Set-Location $prev
  }
}

# Robocopy: Exit 0 (nichts kopiert) und 1 (alles OK) sind Erfolg
function Invoke-Robocopy {
  param([string]$Src, [string]$Dst, [string[]]$ExtraDirs = @(), [string[]]$ExtraFiles = @())
  $xd = @("node_modules", ".git", ".turbo", ".claude", "_release_tmp") + $ExtraDirs
  $xf = @("*.log", "*.ndjson") + $ExtraFiles
  $args = @($Src, $Dst, "/E", "/NJH", "/NJS", "/NFL", "/NDL",
            "/XD") + $xd + @("/XF") + $xf
  & robocopy @args | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy Fehler (Exit $LASTEXITCODE): $Src -> $Dst"
  }
}

# ── Pfade ─────────────────────────────────────────────────────────────────────

$ROOT       = Split-Path $PSScriptRoot -Parent
$FRONTEND   = Join-Path $ROOT "frontend\orbit-control"
$DIST       = Join-Path $ROOT "dist"

# Version lesen
$VERSION = "1.0.2"
$vfile = Join-Path $ROOT ".ki-os-version"
if (Test-Path $vfile) { $VERSION = (Get-Content $vfile -Raw).Trim() }

$DATE         = Get-Date -Format "yyyyMMdd"
$RELEASE_NAME = "ki-os-v$VERSION-release-$DATE"
$STAGE        = Join-Path $DIST $RELEASE_NAME
$ZIP          = Join-Path $DIST "$RELEASE_NAME.zip"

# ── Banner ─────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  +--------------------------------------------------+" -ForegroundColor DarkCyan
Write-Host "  |                                                  |" -ForegroundColor DarkCyan
Write-Host "  |    KI-OS  Release Builder  v$VERSION" -ForegroundColor Cyan
Write-Host "  |    Ziel: $RELEASE_NAME.zip" -ForegroundColor White
if ($DryRun) {
Write-Host "  |    *** DRY-RUN -- keine Aenderungen ***" -ForegroundColor Yellow
}
Write-Host "  |                                                  |" -ForegroundColor DarkCyan
Write-Host "  +--------------------------------------------------+" -ForegroundColor DarkCyan
Write-Host ""

$TOTAL_STEPS = 7

# ── Step 1: Voraussetzungen ───────────────────────────────────────────────────
Write-Step 1 $TOTAL_STEPS "Voraussetzungen pruefen"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Fail "Node.js nicht gefunden. Bitte installieren: https://nodejs.org"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Fail "npm nicht gefunden."
}

$nodeVer = & node --version
$npmVer  = & npm --version
Write-Ok "Node $nodeVer  /  npm $npmVer"

if (Test-Path $ZIP) {
  Write-Warn "ZIP existiert bereits und wird ueberschrieben: $ZIP"
}

# ── Step 2: Cache bereinigen ──────────────────────────────────────────────────
Write-Step 2 $TOTAL_STEPS "Cache bereinigen"

if (-not $SkipClean -and -not $DryRun) {
  $cleanTargets = @(
    (Join-Path $FRONTEND ".next"),
    (Join-Path $FRONTEND ".turbo"),
    (Join-Path $FRONTEND "out"),
    (Join-Path $ROOT "dist")
  )
  foreach ($t in $cleanTargets) {
    if (Test-Path $t) {
      Remove-Item $t -Recurse -Force
      Write-Ok "Entfernt: $($t.Replace($ROOT,'.'))"
    }
  }
  # Log-Dateien
  Get-ChildItem $ROOT -Recurse -Filter "*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "node_modules" } |
    Remove-Item -Force
  Write-Ok "Logs bereinigt"
} else {
  Write-Warn "Cache-Bereinigung uebersprungen (SkipClean oder DryRun)"
}

# ── Step 3: Abhängigkeiten installieren ───────────────────────────────────────
Write-Step 3 $TOTAL_STEPS "Abhaengigkeiten installieren (npm ci)"

if (-not $DryRun) {
  Write-Host "         Installiere..." -ForegroundColor DarkGray
  Invoke-Cmd "npm ci --prefer-offline 2>&1" $ROOT
  Write-Ok "npm ci abgeschlossen"
} else {
  Write-Warn "DryRun: npm ci uebersprungen"
}

# ── Step 4: Frontend bauen ────────────────────────────────────────────────────
Write-Step 4 $TOTAL_STEPS "Frontend bauen (next build)"

if (-not $SkipBuild -and -not $DryRun) {
  Write-Host "         Baue Next.js -- das dauert 1-3 Minuten..." -ForegroundColor DarkGray
  Invoke-Cmd "npx next build 2>&1" $FRONTEND
  Write-Ok "next build abgeschlossen"

  # .next/cache entfernen (nur Build-Cache, nicht benoetigt zur Laufzeit)
  $nextCache = Join-Path $FRONTEND ".next\cache"
  if (Test-Path $nextCache) {
    Remove-Item $nextCache -Recurse -Force
    Write-Ok ".next/cache entfernt (Laufzeit braucht ihn nicht)"
  }
} else {
  Write-Warn "next build uebersprungen (SkipBuild oder DryRun)"
}

# ── Step 5: Staging-Verzeichnis befuellen ─────────────────────────────────────
Write-Step 5 $TOTAL_STEPS "Release-Paket zusammenstellen"

if (-not $DryRun) {
  New-Item -ItemType Directory -Path $STAGE -Force | Out-Null

  # Root-Dateien
  $rootFiles = @(
    "KI-OS.bat", "KI-OS-Start.ps1", "ki-os.sh",
    "index.js", "package.json", "package-lock.json",
    ".env.example", ".ki-os-version", "build-community.js"
  )
  foreach ($f in $rootFiles) {
    $src = Join-Path $ROOT $f
    if (Test-Path $src) {
      Copy-Item $src $STAGE -Force
    } else {
      Write-Warn "Nicht gefunden (uebersprungen): $f"
    }
  }

  # Backend, Core, Runtime, Scripts
  foreach ($dir in @("backend", "core", "runtime", "scripts")) {
    $src = Join-Path $ROOT $dir
    if (Test-Path $src) {
      Invoke-Robocopy $src (Join-Path $STAGE $dir)
      Write-Ok "$dir/ kopiert"
    }
  }

  # Frontend (ohne node_modules, ohne .next/cache -- schon entfernt)
  $feSrc = Join-Path $ROOT "frontend\orbit-control"
  $feDst = Join-Path $STAGE "frontend\orbit-control"
  Invoke-Robocopy $feSrc $feDst -ExtraDirs @(".next\cache") -ExtraFiles @("*.ts.bak")
  Write-Ok "frontend/orbit-control/ kopiert"

  # INSTALL.txt erzeugen
  $installText = @"
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
"@
  Set-Content (Join-Path $STAGE "INSTALL.txt") $installText -Encoding UTF8
  Write-Ok "INSTALL.txt erstellt"
} else {
  Write-Warn "DryRun: Staging uebersprungen"
}

# ── Step 6: ZIP erstellen ─────────────────────────────────────────────────────
Write-Step 6 $TOTAL_STEPS "ZIP erstellen: $RELEASE_NAME.zip"

if (-not $DryRun) {
  Write-Host "         Komprimiere..." -ForegroundColor DarkGray

  # 7zip nutzen wenn vorhanden (schneller + besser), sonst PowerShell
  $sevenZip = @(
    "C:\Program Files\7-Zip\7z.exe",
    "C:\Program Files (x86)\7-Zip\7z.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  if ($sevenZip) {
    & $sevenZip a -tzip -mx=5 $ZIP "$STAGE\*" | Out-Null
    Write-Ok "7-Zip verwendet (Level 5)"
  } else {
    Compress-Archive -Path "$STAGE\*" -DestinationPath $ZIP -CompressionLevel Optimal -Force
    Write-Ok "PowerShell Compress-Archive verwendet"
  }

  # Staging entfernen
  Remove-Item $STAGE -Recurse -Force
  Write-Ok "Staging-Verzeichnis bereinigt"
} else {
  Write-Warn "DryRun: ZIP uebersprungen"
  if (Test-Path $STAGE) { Remove-Item $STAGE -Recurse -Force }
}

# ── Step 7: Ergebnis ──────────────────────────────────────────────────────────
Write-Step 7 $TOTAL_STEPS "Fertig"

if (-not $DryRun -and (Test-Path $ZIP)) {
  $zipInfo = Get-Item $ZIP
  $size    = Format-Size $zipInfo.Length

  Write-Host ""
  Write-Host "  +--------------------------------------------------+" -ForegroundColor Green
  Write-Host "  |  Release bereit!                                 |" -ForegroundColor Green
  Write-Host ("  |  Datei:   {0,-38}|" -f "$RELEASE_NAME.zip") -ForegroundColor White
  Write-Host ("  |  Groesse: {0,-38}|" -f $size) -ForegroundColor White
  Write-Host ("  |  Pfad:    {0,-38}|" -f "dist\") -ForegroundColor White
  Write-Host "  |                                                  |" -ForegroundColor Green
  Write-Host "  |  Entpacken + starten:                            |" -ForegroundColor DarkGray
  Write-Host "  |    1. ZIP entpacken                              |" -ForegroundColor DarkGray
  Write-Host "  |    2. npm ci                                     |" -ForegroundColor DarkGray
  Write-Host "  |    3. .env.example -> .env  (API-Keys eintragen) |" -ForegroundColor DarkGray
  Write-Host "  |    4. KI-OS.bat  oder  ./ki-os.sh               |" -ForegroundColor DarkGray
  Write-Host "  +--------------------------------------------------+" -ForegroundColor Green
  Write-Host ""
} elseif ($DryRun) {
  Write-Host ""
  Write-Host "  DryRun abgeschlossen -- keine Dateien erstellt." -ForegroundColor Yellow
  Write-Host "  Aufruf ohne --DryRun fuer echten Release-Build." -ForegroundColor Yellow
  Write-Host ""
}
