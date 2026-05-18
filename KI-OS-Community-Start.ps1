param([string]$RootDir = "")

if ($RootDir -eq "") {
  $RootDir = Split-Path -Parent $PSCommandPath
}

$BackendDir    = $RootDir
$FrontendDir   = Join-Path $RootDir "frontend"
$StandaloneJs  = Join-Path $FrontendDir ".next\\standalone\\server.js"
$BackendPort   = 3000
$FrontendPort  = 3001

function Write-Step([string]$Icon, [string]$Text, [string]$Color = "Cyan") {
  Write-Host ("  " + $Icon + "  ") -NoNewline -ForegroundColor $Color
  Write-Host $Text
}

function Get-NodeExe {
  $candidates = @(
    "C:\\Program Files\\nodejs\\node.exe",
    "C:\\Program Files (x86)\\nodejs\\node.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  $found = where.exe node 2>$null | Where-Object { $_ -notlike "*dist\\community*" } | Select-Object -First 1
  if ($found) { return $found }
  return $null
}

function Test-PortOpen([int]$Port) {
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", $Port)
    $tcp.Close()
    return $true
  } catch { return $false }
}

function Wait-For-Port([int]$Port, [int]$MaxSeconds) {
  $deadline = (Get-Date).AddSeconds($MaxSeconds)
  $dots = 0
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen $Port) { Write-Host ""; return $true }
    Write-Host "." -NoNewline
    $dots++
    if ($dots % 30 -eq 0) { Write-Host "" }
    Start-Sleep -Seconds 1
  }
  Write-Host ""
  return $false
}

function Kill-Port([int]$Port) {
  $pids = netstat -ano 2>$null | Select-String ":$Port\\s" |
    ForEach-Object { ($_ -split '\\s+')[-1] } |
    Where-Object { $_ -match '^\\d+$' } | Sort-Object -Unique
  foreach ($p in $pids) {
    try { Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue } catch {}
  }
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkCyan
Write-Host "         KI-OS Community Edition                              " -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor DarkCyan
Write-Host ""

$NodeExe = Get-NodeExe
if (-not $NodeExe) {
  Write-Host "  ! Node.js nicht gefunden. Bitte installieren: https://nodejs.org (v20+)" -ForegroundColor Red
  Read-Host "  Enter zum Beenden"
  exit 1
}
$nodeVer = (& $NodeExe --version 2>&1).ToString().Trim()
Write-Step "+" "Node.js $nodeVer" "Green"

if (-not (Test-Path $StandaloneJs)) {
  Write-Host ""
  Write-Host "  ! Frontend nicht gebaut. Bitte zuerst ausfuehren:" -ForegroundColor Red
  Write-Host "    cd frontend && npx next build" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Enter zum Beenden"
  exit 1
}

Write-Host ""
Write-Step ">" "Ports $BackendPort/$FrontendPort freigeben..."
Kill-Port $BackendPort
Kill-Port $FrontendPort
Start-Sleep -Seconds 1
Write-Step "+" "Ports freigegeben" "Green"
Write-Host ""

Write-Step ">" "Backend starten (Port $BackendPort)..."
$backendCmd = 'title KI-OS Backend && "' + $NodeExe + '" runtime/local/server.js'
Start-Process "cmd.exe" -ArgumentList "/k",$backendCmd -WorkingDirectory $BackendDir
Write-Host ""
Write-Step "~" "Warte auf Backend..." "Cyan"
Write-Host "  " -NoNewline
$backendOk = Wait-For-Port $BackendPort 30
if (-not $backendOk) {
  Write-Step "!" "Backend antwortet nicht auf Port $BackendPort" "Red"
  Read-Host "  Enter zum Beenden"
  exit 1
}
Write-Step "+" "Backend online: http://127.0.0.1:$BackendPort" "Green"
Write-Host ""

Write-Step ">" "Frontend starten (Port $FrontendPort)..."
$env:PORT     = "$FrontendPort"
$env:HOSTNAME = "127.0.0.1"
$frontendCmd  = 'title KI-OS Frontend && set PORT=3001&& set HOSTNAME=127.0.0.1&& "' + $NodeExe + '" ".next\\standalone\\server.js"'
Start-Process "cmd.exe" -ArgumentList "/k",$frontendCmd -WorkingDirectory $FrontendDir
Write-Host ""
Write-Step "~" "Warte auf Frontend..." "Cyan"
Write-Host "  " -NoNewline
$frontendOk = Wait-For-Port $FrontendPort 30
if ($frontendOk) {
  Write-Step "+" "Frontend online: http://localhost:$FrontendPort" "Green"
  Start-Process "http://localhost:$FrontendPort"
} else {
  Write-Step "*" "Frontend braucht laenger - bitte Fenster pruefen." "Yellow"
  Write-Host "  URL: http://localhost:$FrontendPort" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkCyan
Write-Host "  KI-OS Community laeuft!" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend  : http://127.0.0.1:$BackendPort" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Beide Fenster offen lassen solange KI-OS laufen soll." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  [Enter] zum Schliessen"
