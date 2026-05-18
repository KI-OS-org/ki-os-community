# KI-OS Community Edition — EXE erstellen

## Option 1: Bat To Exe Converter (Einfachste)

### Schritt 1: Converter herunterladen
Lade einen kostenlosen Batch-to-EXE Converter herunter:
- **Bat To Exe Converter**: https://www.f2ko.de/en/bat-to-exe-converter.php
- **Advanced Bat To Exe**: https://www.dragonfly.nu/products/advanced-bat-to-exe-converter/

### Schritt 2: Einstellungen

| Einstellung | Wert |
|-------------|------|
| **Batch File** | `KI-OS-Community.bat` |
| **Output EXE** | `KI-OS-Community.exe` |
| **Icon** | Wähle eine `.ico` Datei (siehe unten) |
| **Visibility** | Visible (sichtbar) |
| **Run as** | Current User |

### Schritt 3: Icon erstellen

1. Gehe zu https://www.convertico.com/
2. Lade ein PNG-Bild hoch (z.B. KI-OS Logo)
3. Konvertiere zu `.ico`
4. Speichere als `KI-OS-Icon.ico`

Oder verwende das PowerShell Script:
```powershell
.\create-icon.ps1
```

### Schritt 4: EXE erstellen
Klicke auf "Convert" oder "Compile"

---

## Option 2: PKG (Node.js zu EXE)

### Installation
```bash
npm install -g pkg
```

### EXE bauen
```bash
cd C:\Users\is\iCloudDrive\KI-OS\dist\community
pkg launcher.js --targets node20-win-x64 --output KI-OS-Community.exe
```

### Mit Icon (erfordert node-ico)
```bash
npm install -g node-ico
# Dann resource.h und icon.rc erstellen
```

---

## Option 3: Electron (Vollwertige App)

### Installation
```bash
npm install electron electron-packager --save-dev
```

### main.js erstellen
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'KI-OS-Icon.ico'),
    webPreferences: {
      nodeIntegration: true
    }
  });

  // Server starten
  serverProcess = spawn('node', ['runtime/local/server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: '8080' }
  });

  // Web UI laden
  mainWindow.loadURL('http://localhost:8080/Web/community.html');
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
  if (serverProcess) serverProcess.kill();
});
```

### App packen
```bash
npx electron-packager . KI-OS-Community --platform=win32 --arch=x64 --icon=KI-OS-Icon.ico
```

---

## 🎯 Empfohlene Lösung: **Option 1 (Bat To Exe)**

**Warum?**
- ✅ Einfachste Methode
- ✅ Kein Code ändern nötig
- ✅ Icon kann einfach getauscht werden
- ✅ Funktioniert sofort

---

## 📋 Dateien für die EXE

Bereitgestellte Dateien:
- `KI-OS-Community.bat` — Start-Skript (Basis für EXE)
- `launcher.js` — Node.js Launcher (für PKG)
- `create-icon.ps1` — Icon Generator
- `create-exe.vbs` — Verknüpfung Creator

---

## 🔗 Nützliche Links

| Tool | Link |
|------|------|
| Bat To Exe Converter | https://www.f2ko.de/en/bat-to-exe-converter.php |
| PNG to ICO Converter | https://www.convertico.com/ |
| Free Icons | https://www.iconfinder.com/ |
| Electron | https://www.electronjs.org/ |

---

**Viel Erfolg! **
