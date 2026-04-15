# KI-OS Community EXE — Schnell-Anleitung

## ✅ Fertig! Hier ist was Du tun musst:

### Schritt 1: Icon konvertieren (2 Minuten)

1. Gehe zu: **https://cloudconvert.com/png-to-ico**
2. Lade diese Datei hoch: `C:\Users\is\iCloudDrive\KI-OS\dist\community\KI-OS-Icon.png`
3. Klicke auf "Convert"
4. Lade `KI-OS-Icon.ico` herunter
5. Speichere im gleichen Verzeichnis

### Schritt 2: EXE erstellen (5 Minuten)

**Methode A: Online Converter**
1. Gehe zu: **https://www.f2ko.de/en/bat-to-exe-converter.php**
2. Lade "Bat To Exe Converter" herunter und installiere
3. Öffne das Programm
4. Wähle: `KI-OS-Community.bat`
5. Wähle Icon: `KI-OS-Icon.ico`
6. Klicke "Convert"
7. Fertig! Du hast `KI-OS-Community.exe`

**Methode B: PowerShell (ohne Icon)**
```powershell
cd C:\Users\is\iCloudDrive\KI-OS\dist\community
$i = (New-Object Net.WebClient).DownloadFile('https://raw.githubusercontent.com/f2ko/bat-to-exe/master/BatToExe.exe', 'BatToExe.exe')
.\BatToExe.exe /in:KI-OS-Community.bat /out:KI-OS-Community.exe /icon:KI-OS-Icon.ico /ver:1.1.1.0
```

### Schritt 3: Desktop-Verknüpfung

Die EXE erstellt automatisch eine Verknüpfung!

Oder manuell:
1. Rechtsklick auf `KI-OS-Community.exe`
2. "Senden an" → "Desktop (Verknüpfung erstellen)"

---

## 🎉 Fertig!

Du hast jetzt:
- ✅ `KI-OS-Community.exe` — Die App
- ✅ `KI-OS-Icon.ico` — Das Logo
- ✅ Desktop-Verknüpfung

**Doppelklicken und starten!** 🚀

---

## 📂 Dateien im Überblick

| Datei | Zweck |
|-------|-------|
| `KI-OS-Community.bat` | Start-Skript (Basis für EXE) |
| `KI-OS-Icon.png` | Logo als PNG |
| `KI-OS-Icon.ico` | Logo als ICO (nach Konvertierung) |
| `KI-OS-Community.exe` | Die fertige App |
| `BUILD-EXE.md` | Detaillierte Anleitung |

---

## ❓ Fragen?

Siehe `BUILD-EXE.md` für alle Optionen!
