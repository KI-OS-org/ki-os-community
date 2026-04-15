# KI-OS Discord Setup Guide

## 1 — Bot erstellen (Discord Developer Portal)

1. Öffne https://discord.com/developers/applications
2. **"New Application"** → Name: `KIMBA`
3. → **Bot** → "Add Bot"
4. Aktiviere unter **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Kopiere den **Bot Token** → in `.env` als `DISCORD_BOT_TOKEN`
6. Kopiere die **Application ID** → in `.env` als `DISCORD_CLIENT_ID`

## 2 — Bot einladen

```
https://discord.com/api/oauth2/authorize?client_id=DEINE_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Ersetze `DEINE_CLIENT_ID` mit deiner Client ID.

## 3 — Server-IDs ermitteln

In Discord: Einstellungen → Erweitert → **Entwicklermodus** aktivieren.
Dann Rechtsklick auf Server/Kanal/Rolle → "ID kopieren".

## 4 — .env Einträge

```env
# Discord Bot
DISCORD_BOT_TOKEN=dein-bot-token
DISCORD_CLIENT_ID=deine-client-id
DISCORD_GUILD_ID=deine-server-id

# Kanal-IDs (nach Kanal-Erstellung eintragen)
DISCORD_CHANNEL_WELCOME=
DISCORD_CHANNEL_ANNOUNCEMENTS=
DISCORD_CHANNEL_RELEASES=
DISCORD_CHANNEL_GENERAL=
DISCORD_CHANNEL_SUPPORT=
DISCORD_CHANNEL_SHOWCASE=

# Rollen-IDs (nach Rollen-Erstellung eintragen)
DISCORD_ROLE_COMMUNITY=
DISCORD_ROLE_BUILDER=
DISCORD_ROLE_ENTERPRISE=
DISCORD_ROLE_TEAM=

# KI-OS API (optional, für /ask command)
KI_OS_API_URL=http://localhost:3000
```

## 5 — Empfohlene Kanal-Struktur

```
📢 INFO
├── #announcements    (nur Team kann schreiben)
├── #releases         (GitHub Release Webhook landet hier)
└── #roadmap          (read-only Roadmap)

💬 COMMUNITY
├── #general          (allgemeine Diskussion)
├── #introductions    (neue Mitglieder stellen sich vor)
└── #showcase         (eigene KI-OS Builds zeigen)

🛠️ SUPPORT
├── #help             (Fragen zur Installation & Nutzung)
├── #bugs             (Bug Reports)
└── #feature-requests (Feature Wünsche)

🔨 BUILDERS
├── #dev-talk         (technische Diskussion)
├── #pull-requests    (PR Diskussionen)
└── #agent-recipes    (Agent Konfigurationen teilen)

📚 RESOURCES
├── #docs-links       (Dokumentations-Links)
└── #book             (KI-OS: AI Operating System)
```

## 6 — Rollen erstellen

| Rolle        | Farbe    | Beschreibung                        |
|---|---|---|
| 🌐 Community  | #5AC4FF  | Alle Mitglieder (auto-assign)       |
| 🔨 Builder    | #22c55e  | Aktive Contributor (self-assign)    |
| 🏢 Enterprise | #f59e0b  | Enterprise Kunden (manual)          |
| ⚡ KI-OS Team | #ef4444  | Team Mitglieder (manual)            |

## 7 — GitHub → Discord Webhook

1. In Discord: Kanaleinstellungen von `#releases` → **Integrationen** → **Webhooks** → "New Webhook"
2. Name: `GitHub Releases`, kopiere Webhook URL
3. In GitHub: Repository Settings → Webhooks → Add webhook:
   - Payload URL: `DISCORD_WEBHOOK_URL/github`
   - Content type: `application/json`
   - Events: `Releases`, `Issues` (optional)

Oder via CLI:
```bash
gh api repos/KI-OS-org/ki-os/hooks --method POST \
  -f "config[url]=DISCORD_WEBHOOK_URL/github" \
  -f "config[content_type]=json" \
  -f events[]="release"
```

## 8 — Bot starten

```bash
# Abhängigkeit installieren
npm install discord.js

# Bot starten
node scripts/discord-bot.js
```

## 9 — Bot als Service (PM2)

```bash
npm install -g pm2
pm2 start scripts/discord-bot.js --name "ki-os-discord"
pm2 save
pm2 startup
```
