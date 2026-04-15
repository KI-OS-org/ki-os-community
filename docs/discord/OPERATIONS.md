# KI-OS Discord — Operations Guide

> Was kann KIMBA (via Claude) direkt steuern, was braucht einen Menschen?

---

## Steuerung via Claude (API — kein Login nötig)

Alles was ich mit Bot-Token + API machen kann — du schreibst einfach in den Chat:

| Aufgabe | Beispiel-Befehl |
|---|---|
| Nachricht posten | "Poste in #announcements: v1.6.0 ist live" |
| Kanal anlegen | "Lege #enterprise-talk unter BUILDERS an" |
| Kanal löschen | "Lösche den alten #community-ki-osorg Kanal" |
| Rolle vergeben | "Gib User XYZ die Enterprise-Rolle" |
| Permissions setzen | "Mache #releases read-only" |
| Nachricht löschen | "Lösche die letzte Nachricht in #general" |
| Rollen erstellen | "Erstelle eine neue Rolle Premium in Gold" |
| Webhook einrichten | "Richte einen neuen GitHub Webhook ein" |
| Kanal-Topic ändern | "Ändere das Topic von #help auf: ..." |

**Voraussetzung:** Bot-Token in `.env` ist aktuell (nicht regeneriert).

---

## Steuerung via KIMBA Bot (läuft autonom)

Wenn `node scripts/discord-bot.js` läuft, macht KIMBA automatisch:

| Aufgabe | Trigger |
|---|---|
| Willkommensnachricht | Neues Mitglied tritt bei |
| Community-Rolle zuweisen | Automatisch bei Join |
| `/ask` beantworten | User tippt `/ask` |
| Spam-Schutz | Fremde Discord-Invites → auto-delete |

**Vorteil:** Läuft ohne Claude, 24/7, sobald der Bot-Prozess läuft.

---

## Steuerung NUR durch Menschen (Discord UI)

| Aufgabe | Warum manuell |
|---|---|
| Community Mode aktivieren | Discord verifiziert das manuell |
| Bot Token regenerieren | Sicherheitsmaßnahme |
| Server Icon setzen | Datei-Upload nur per UI |
| 2FA / Sicherheitseinstellungen | Authentifizierung erforderlich |
| Nitro / Boost verwalten | Billing |
| Discord Developer Portal | App-Konfiguration |

---

## Delegation an Dritte

### Option A — Claude bleibt zuständig (empfohlen)
**Wann:** Solange das Team klein ist und alles über diesen Chat läuft.  
**Vorteil:** Alles dokumentiert, nachvollziehbar, kein separates Tool.  
**Nachteil:** Braucht aktive Session + Bot-Token muss aktuell sein.

### Option B — KIMBA Bot als Standalone
**Wann:** Wenn Community wächst und 24/7-Reaktion nötig ist.  
**Setup:** `pm2 start scripts/discord-bot.js` auf dem PC oder einem VPS.  
**Vorteil:** Läuft autonom, kein Claude nötig für Routineaufgaben.  
**Erweiterbar um:** Admin-Commands (`/announce`, `/kick`, `/warn`).

### Option C — Discord-Moderatoren
**Wann:** Community > 500 Member, tägliche Moderation nötig.  
**Setup:** Community-Mitglieder bekommen die Moderator-Rolle.  
**Aufgaben:** Fragen beantworten, Spam löschen, neue Member begrüßen.

---

## Empfehlung für KI-OS

```
Jetzt:        Claude on demand + KIMBA Bot (Automated Welcome)
Bei Launch:   + 1-2 Community Moderatoren aus der Builder-Community
Bei >1000:    Dedicated Community Manager
```

**Konkret — nächster Schritt:**
1. Bot Token regenerieren + `npm start discord-bot` → KIMBA läuft 24/7
2. Ersten aktiven Community-Beitrag suchen → Builder-Rolle vergeben → als Moderator einsetzen

---

## Schnellreferenz — häufige Admin-Tasks

```bash
# Bot starten
node scripts/discord-bot.js

# Bot als Daemon (läuft im Hintergrund)
pm2 start scripts/discord-bot.js --name ki-os-discord

# Slash Commands neu registrieren (nach Änderungen am Bot)
node -e "require('./scripts/discord-bot.js')" # registriert beim Start automatisch

# Webhook testen
gh api repos/KI-OS-org/ki-os/hooks/605967161/test --method POST
```
