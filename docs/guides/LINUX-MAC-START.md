# KI-OS Community — Linux & macOS Start-Anleitung

## ✅ Plattformen

| Plattform | Start-Datei | App Format |
|-----------|-------------|------------|
| **Windows** | `KI-OS-Community.bat` | `.exe` |
| **macOS** | `KI-OS-Community.sh` | `.app` |
| **Linux** | `KI-OS-Community.sh` | `.AppImage` |

---

## 🐧 Linux

### Option 1: Shell Script (Sofort startklar)

```bash
cd /path/to/ki-os/dist/community
chmod +x KI-OS-Community.sh
./KI-OS-Community.sh
```

### Option 2: AppImage erstellen

**Schritt 1: AppImageTools installieren**
```bash
# Ubuntu/Debian
sudo apt install appimagekit

# Oder linuxdeploy
wget https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage
chmod +x linuxdeploy-x86_64.AppImage
```

**Schritt 2: AppImage erstellen**
```bash
# AppDir Struktur erstellen
mkdir -p KI-OS.AppDir/usr/bin
mkdir -p KI-OS.AppDir/usr/share/icons/hicolor/256x256/apps

# Dateien kopieren
cp -r * KI-OS.AppDir/usr/bin/
cp KI-OS-Icon.png KI-OS.AppDir/usr/share/icons/hicolor/256x256/apps/ki-os.png

# Desktop Datei erstellen
cat > KI-OS.AppDir/ki-os.desktop << EOF
[Desktop Entry]
Name=KI-OS Community
Comment=AI Operating System
Exec=usr/bin/KI-OS-Community.sh
Icon=ki-os
Type=Application
Categories=Development;
EOF

# AppImage bauen
./linuxdeploy-x86_64.AppImage --appdir KI-OS.AppDir --output appimage
```

### Option 3: Als Systemdienst installieren

```bash
# Script nach /usr/local/bin kopieren
sudo cp KI-OS-Community.sh /usr/local/bin/ki-os
sudo chmod +x /usr/local/bin/ki-os

# Überall starten mit:
ki-os
```

---

## 🍎 macOS

### Option 1: Shell Script

```bash
cd /path/to/ki-os/dist/community
chmod +x KI-OS-Community.sh
./KI-OS-Community.sh
```

### Option 2: macOS App (.app)

**Schritt 1: App Bundle erstellen**
```bash
chmod +x create-macos-app.sh
./create-macos-app.sh
```

**Schritt 2: App installieren**
```bash
# In Applications Ordner bewegen
mv "KI-OS Community.app" /Applications/

# Oder Alias auf Desktop erstellen
ln -s "/Applications/KI-OS Community.app" ~/Desktop/
```

**Schritt 3: Erster Start**
- Rechtsklick auf die App
- "Öffnen" klicken (wegen "Unidentified Developer")
- Ab jetzt normal per Doppelklick startbar

### Option 3: Mit Homebrew installieren

```bash
# Homebrew Cask erstellen (fortgeschritten)
brew tap ki-os/ki-os
brew install --cask ki-os-community
```

---

## 🪟 Windows

### Option 1: Batch-Datei
```cmd
cd C:\Users\is\iCloudDrive\KI-OS\dist\community
KI-OS-Community.bat
```

### Option 2: EXE erstellen
Siehe `EXE-ANLEITUNG.md`

---

## 📋 Alle Start-Dateien

| Datei | Plattform | Beschreibung |
|-------|-----------|--------------|
| `KI-OS-Community.bat` | Windows | Batch-Start |
| `KI-OS-Community.sh` | macOS/Linux | Shell-Start |
| `KI-OS-Community.exe` | Windows | EXE-App (nach Build) |
| `KI-OS Community.app` | macOS | macOS App (nach Build) |
| `KI-OS-Community.AppImage` | Linux | Linux AppImage (nach Build) |

---

## 🎯 Empfohlene Methode pro Plattform

| Plattform | Empfohlen | Alternative |
|-----------|-----------|-------------|
| **Windows** | `.exe` (nach Build) | `.bat` (sofort) |
| **macOS** | `.app` (nach Build) | `.sh` (sofort) |
| **Linux** | AppImage (nach Build) | `.sh` (sofort) |

---

## ❓ Häufige Fragen

### "Permission denied" bei .sh
```bash
chmod +x KI-OS-Community.sh
```

### "Unidentified Developer" auf macOS
1. Rechtsklick auf App
2. "Öffnen" wählen
3. Einmal bestätigen
4. Ab jetzt normal startbar

### Node.js nicht gefunden
```bash
# macOS
brew install node

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Linux (Fedora/RHEL)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

---

**Fertig! KI-OS läuft auf allen Plattformen! 🚀**
