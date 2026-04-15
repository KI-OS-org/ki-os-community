param(
  [string]$Mode            = "FullStart",
  [string]$RootDir         = "",
  [int]$BackendTimeout     = 90,
  [int]$FrontendTimeout    = 120
)

# ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function Write-Step {
  param([string]$Icon, [string]$Text, [string]$Color = "Cyan")
  Write-Host ("  " + $Icon + "  ") -NoNewline -ForegroundColor $Color
  Write-Host $Text
}

function Wait-ForUrl {
  param([string]$CheckUrl, [int]$MaxSeconds, [string]$Label)
  $deadline = (Get-Date).AddSeconds($MaxSeconds)
  $dots = 0
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $CheckUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
        Write-Host ""
        return $true
      }
    }
    catch { }
    Write-Host "." -NoNewline -ForegroundColor DarkCyan
    $dots++
    if ($dots % 40 -eq 0) { Write-Host "" }
    Start-Sleep -Seconds 2
  }
  Write-Host ""
  return $false
}

function Test-NodeInstalled {
  try {
    $null = & node --version 2>&1
    return $true
  }
  catch {
    return $false
  }
}

function Ensure-NodeModules {
  param([string]$Dir, [string]$Label)
  $nmPath = Join-Path $Dir "node_modules"
  if (-not (Test-Path $nmPath)) {
    Write-Step ">" "npm install fuer $Label ..."
    $proc = Start-Process -FilePath "npm" `
      -ArgumentList "install","--prefer-offline","--no-audit","--no-fund" `
      -WorkingDirectory $Dir -PassThru -Wait -NoNewWindow
    if ($proc.ExitCode -ne 0) {
      Write-Step "!" "npm install fehlgeschlagen fuer $Label" "Red"
      exit 1
    }
    Write-Step "+" "$Label Abhaengigkeiten bereit" "Green"
  }
  else {
    Write-Step "+" "$Label Abhaengigkeiten vorhanden" "Green"
  }
}

# ─── Verzeichnisse ──────────────────────────────────────────────────────────

if ($RootDir -ne "") {
  $ProjectRoot = $RootDir
}
else {
  $ProjectRoot = Split-Path -Parent $PSCommandPath
}

$BackendDir   = $ProjectRoot
$FrontendDir  = Join-Path $ProjectRoot "frontend\orbit-control"
$BackendPort  = 3000
$FrontendPort = 3001
$BackendUrl   = "http://localhost:$BackendPort"
$FrontendUrl  = "http://localhost:$FrontendPort"

# ─── Banner ─────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkCyan
Write-Host "         KI-OS  Orbit Control Launcher       " -ForegroundColor Cyan
Write-Host "         AI Operating System                  " -ForegroundColor DarkCyan
Write-Host "  ============================================" -ForegroundColor DarkCyan
Write-Host ""

# ─── Schritt 1: Node.js pruefen ─────────────────────────────────────────────

Write-Step "?" "Node.js pruefen..."
if (-not (Test-NodeInstalled)) {
  Write-Host ""
  Write-Host "  ! Node.js nicht gefunden!" -ForegroundColor Red
  Write-Host "    Bitte installieren: https://nodejs.org (Version 20+)" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Beliebige Taste zum Beenden"
  exit 1
}
$nodeVer = (& node --version 2>&1).ToString().Trim()
Write-Step "+" "Node.js $nodeVer gefunden" "Green"
Write-Host ""

# ─── Schritt 2: Abhaengigkeiten pruefen ─────────────────────────────────────

Write-Step ">" "Abhaengigkeiten pruefen..."
Ensure-NodeModules $BackendDir  "Backend"
Ensure-NodeModules $FrontendDir "Frontend"
Write-Host ""

# ─── Schritt 2b: Laufende Prozesse auf Ports beenden ────────────────────────

Write-Step ">" "Alte Prozesse auf Ports $BackendPort/$FrontendPort beenden..."
@($BackendPort, $FrontendPort) | ForEach-Object {
  $port = $_
  $pids = netstat -ano 2>$null | Select-String ":$port\s" | ForEach-Object {
    ($_ -split '\s+')[-1]
  } | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique
  foreach ($pid in $pids) {
    try { Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue } catch {}
  }
}
Start-Sleep -Seconds 1
Write-Step "+" "Ports freigegeben" "Green"
Write-Host ""

# ─── Schritt 3: Backend starten ─────────────────────────────────────────────

Write-Step ">" "Backend starten (Port $BackendPort)..."

$backendScript = Join-Path $BackendDir "package.json"
if (-not (Test-Path $backendScript)) {
  Write-Host "  ! package.json nicht gefunden in: $BackendDir" -ForegroundColor Red
  Read-Host "  Beliebige Taste zum Beenden"
  exit 1
}

$backendProc = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/k","npm run start:local" `
  -WorkingDirectory $BackendDir `
  -PassThru -WindowStyle Minimized

Write-Step "+" "Backend gestartet (PID $($backendProc.Id))" "Green"
Write-Host ""

# ─── Schritt 4: Auf Backend warten ──────────────────────────────────────────

Write-Step "~" "Warte auf Backend " -Color "Cyan"
Write-Host "     " -NoNewline

$backendOk = Wait-ForUrl "$BackendUrl/health" $BackendTimeout "Backend"

if (-not $backendOk) {
  Write-Host ""
  Write-Step "!" "Backend antwortet nicht nach $BackendTimeout Sek. Pruefe das Backend-Fenster." "Red"
  Write-Host ""
  Read-Host "  Beliebige Taste zum Beenden"
  exit 1
}
Write-Step "+" "Backend online: $BackendUrl" "Green"
Write-Host ""

# ─── Schritt 5: Frontend starten ────────────────────────────────────────────

Write-Step ">" "Frontend starten (Port $FrontendPort)..."

$frontendProc = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/k","npm run dev" `
  -WorkingDirectory $FrontendDir `
  -PassThru -WindowStyle Minimized

Write-Step "+" "Frontend gestartet (PID $($frontendProc.Id))" "Green"
Write-Host ""

# ─── Schritt 6: Auf Frontend warten ─────────────────────────────────────────

Write-Step "~" "Warte auf Frontend (Next.js kompiliert...)" -Color "Cyan"
Write-Host "     " -NoNewline

$frontendOk = Wait-ForUrl $FrontendUrl $FrontendTimeout "Frontend"

if (-not $frontendOk) {
  Write-Host ""
  Write-Step "*" "Frontend brauchte laenger als erwartet. Browser wird trotzdem geoeffnet..." "Yellow"
}
Write-Host ""

# ─── Schritt 7: Browser oeffnen ─────────────────────────────────────────────

Write-Step ">" "Browser oeffnen: $FrontendUrl"
Start-Process $FrontendUrl
Write-Host ""

# ─── Fertig ─────────────────────────────────────────────────────────────────

Write-Host "  ============================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  KI-OS ist bereit!" -ForegroundColor Green
Write-Host ""
Write-Host "  Orbit Control : $FrontendUrl" -ForegroundColor Cyan
Write-Host "  Backend API   : $BackendUrl"  -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login    : demo@ki-os.local"  -ForegroundColor DarkCyan
Write-Host "  Passwort : orbit-demo"         -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Weitere Konten:" -ForegroundColor DarkGray
Write-Host "    admin@ki-os.local    / orbit-admin"    -ForegroundColor DarkGray
Write-Host "    operator@ki-os.local / orbit-operator" -ForegroundColor DarkGray
Write-Host "    auditor@ki-os.local  / orbit-auditor"  -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Backend und Frontend laufen in minimierten Fenstern." -ForegroundColor DarkGray
Write-Host "  Dieses Fenster kann geschlossen werden."              -ForegroundColor DarkGray
Write-Host ""
Read-Host "  [Enter] zum Beenden dieses Fensters"
