# ============================================================
#  KI-OS Community Edition -- Shortcut Creator
#  Erstellt Desktop-Verknuepfungen mit KI-OS Icon
#  Aufruf: PowerShell -ExecutionPolicy Bypass -File scripts\create-shortcuts.ps1
#  Parameter: -Desktop, -Folder (default), -Both
# ============================================================

param(
  [switch]$Desktop,
  [switch]$Folder,
  [switch]$Both
)

$ErrorActionPreference = 'Stop'

$root       = Split-Path $PSScriptRoot -Parent
$iconSrc    = Join-Path $root "Web\icon.png"
$icoPath    = Join-Path $root "KI-OS.ico"
$desktopDir = [Environment]::GetFolderPath('Desktop')

# ── 1. PNG -> echtes ICO konvertieren ───────────────────────
function ConvertTo-Ico {
  param($PngPath, $IcoPath)

  Add-Type -AssemblyName System.Drawing

  $sizes = @(256, 128, 64, 48, 32, 16)
  $images = @()

  $src = [System.Drawing.Image]::FromFile($PngPath)
  foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()
    $images += $bmp
  }
  $src.Dispose()

  $stream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter($stream)

  # ICONDIR Header
  $writer.Write([uint16]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]$images.Count)

  $pngStreams = @()
  foreach ($img in $images) {
    $ps = New-Object System.IO.MemoryStream
    $img.Save($ps, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += $ps
  }

  # ICONDIRENTRY
  $dataOffset = 6 + ($images.Count * 16)
  for ($i = 0; $i -lt $images.Count; $i++) {
    $size  = $sizes[$i]
    $bytes = $pngStreams[$i].ToArray()
    $w     = if ($size -ge 256) { 0 } else { $size }
    $h     = if ($size -ge 256) { 0 } else { $size }
    $writer.Write([byte]$w)
    $writer.Write([byte]$h)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$bytes.Length)
    $writer.Write([uint32]$dataOffset)
    $dataOffset += $bytes.Length
  }

  foreach ($ps in $pngStreams) {
    $writer.Write($ps.ToArray())
    $ps.Dispose()
  }

  $writer.Flush()
  [System.IO.File]::WriteAllBytes($IcoPath, $stream.ToArray())
  $stream.Dispose()
  $writer.Dispose()
  foreach ($img in $images) { $img.Dispose() }
}

# ── 2. Shortcut erstellen ────────────────────────────────────
function New-Shortcut {
  param($TargetPath, $ShortcutPath, $Description, $WorkingDir, $IconPath)

  $wsh = New-Object -ComObject WScript.Shell
  $lnk = $wsh.CreateShortcut($ShortcutPath)
  $lnk.TargetPath       = $TargetPath
  $lnk.WorkingDirectory = $WorkingDir
  $lnk.Description      = $Description
  $lnk.IconLocation     = "$IconPath,0"
  $lnk.WindowStyle      = 1
  $lnk.Save()
}

# ── Main ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "  KI-OS Shortcut Creator" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $iconSrc)) {
  Write-Host "  [FEHLER] icon.png nicht gefunden: $iconSrc" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $icoPath)) {
  Write-Host "  Konvertiere icon.png zu KI-OS.ico..." -ForegroundColor DarkGray
  ConvertTo-Ico -PngPath $iconSrc -IcoPath $icoPath
  Write-Host "  OK KI-OS.ico erstellt" -ForegroundColor Green
} else {
  Write-Host "  OK KI-OS.ico vorhanden" -ForegroundColor DarkGray
}

$shortcuts = @(
  @{
    Name   = "KI-OS Setup"
    Target = Join-Path $root "setup.bat"
    Desc   = "KI-OS einrichten: Node.js, Abhaengigkeiten, API-Key"
  },
  @{
    Name   = "KI-OS Starten"
    Target = Join-Path $root "START-community.bat"
    Desc   = "KI-OS Community Edition starten -> http://localhost:3000"
  }
)

$createInFolder  = (-not $Desktop) -or $Both
$createOnDesktop = $Desktop -or $Both

foreach ($s in $shortcuts) {
  if ($createInFolder) {
    $lnkPath = Join-Path $root "$($s.Name).lnk"
    New-Shortcut -TargetPath $s.Target -ShortcutPath $lnkPath `
                 -Description $s.Desc -WorkingDir $root -IconPath $icoPath
    Write-Host "  OK $($s.Name).lnk  (KI-OS Ordner)" -ForegroundColor Green
  }
  if ($createOnDesktop) {
    $lnkPath = Join-Path $desktopDir "$($s.Name).lnk"
    New-Shortcut -TargetPath $s.Target -ShortcutPath $lnkPath `
                 -Description $s.Desc -WorkingDir $root -IconPath $icoPath
    Write-Host "  OK $($s.Name).lnk  (Desktop)" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "  Fertig! KI-OS Setup oder KI-OS Starten doppelklicken." -ForegroundColor Cyan
Write-Host ""
