# KI-OS Community Edition — Icon Creator
# Erstellt ein einfaches PNG/ICO Icon

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# Icon Größe
$width = 256
$height = 256

# Bitmap erstellen
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Hintergrund (dunkelblau)
$backgroundColor = [System.Drawing.Color]::FromArgb(10, 15, 30)
$graphics.Clear($backgroundColor)

# KI-OS Text (vereinfacht)
$font = New-Object System.Drawing.Font("Arial", 80, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 196, 255))
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

# "KI" Text zeichnen
$graphics.DrawString("KI", $font, $brush, ($width/2), ($height/2 - 40), $stringFormat)

# "OS" Text darunter
$font2 = New-Object System.Drawing.Font("Arial", 80, [System.Drawing.FontStyle]::Bold)
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 211, 153))
$graphics.DrawString("OS", $font2, $brush2, ($width/2), ($height/2 + 50), $stringFormat)

# Speichern
$iconPath = Join-Path $PSScriptRoot "KI-OS-Icon.png"
$bitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Aufräumen
$graphics.Dispose()
$bitmap.Dispose()
$brush.Dispose()
$brush2.Dispose()
$font.Dispose()
$font2.Dispose()
$stringFormat.Dispose()

Write-Host "✅ Icon erstellt: $iconPath"
Write-Host ""
Write-Host "Für .ico Datei konvertieren:"
Write-Host "https://cloudconvert.com/png-to-ico"
