# KI-OS Discord — Setup & Access Documentation

> Last updated: 2026-04-13  
> Status: **LIVE** — Bot active, channels set up, GitHub webhook active

---

## Server

| Property | Value |
|---|---|
| Server Name | KI-OS |
| Invite Link | https://discord.gg/HJ9aHaNB |
| Guild ID | `1493193129073840168` |

---

## Bot: KIMBA

| Property | Value |
|---|---|
| Bot Name | Kimba |
| Bot User ID | `1493200530208587848` |
| Application ID | `1493200630208587848` |
| Developer Portal | https://discord.com/developers/applications/1493200630208587848 |
| Invite URL | https://discord.com/api/oauth2/authorize?client_id=1493200530208587848&permissions=8&scope=bot%20applications.commands |

> ⚠️ **Bot Token** is stored in `.env` as `DISCORD_BOT_TOKEN` — never commit to git.

### Bot Commands

| Command | Description |
|---|---|
| `/ask <question>` | Ask KIMBA a question via KI-OS API (live AI) |
| `/docs` | Get documentation links |
| `/status` | Check KI-OS system health |
| `/builder` | Self-assign the Builder role |
| `/roadmap` | Show current roadmap |

### Start Bot

```bash
npm install discord.js
node scripts/discord-bot.js

# As persistent service (PM2)
npm install -g pm2
pm2 start scripts/discord-bot.js --name "ki-os-discord"
pm2 save && pm2 startup
```

---

## Channel Structure

### 📢 INFO (`1493202160287219719`)
| Channel | ID | Purpose |
|---|---|---|
| #rules | `1493208582345195601` | Community rules — read-only, all members |
| #announcements | `1493202169120428196` | Official KI-OS announcements (admin-only write) |
| #releases | `1493202173939548356` | GitHub release webhook notifications |
| #roadmap | `1493202178066878504` | Product roadmap (read-only) |

### 💬 COMMUNITY (`1493202182160388307`)
| Channel | ID | Purpose |
|---|---|---|
| #general | `1493202186283389099` | General discussion + welcome channel |
| #introductions | `1493202190297206784` | New members introduce themselves |
| #showcase | `1493202194210619432` | Share KI-OS builds and automations |

### 🛠️ SUPPORT (`1493202198081830944`)
| Channel | ID | Purpose |
|---|---|---|
| #help | `1493202206793662464` | Installation and usage questions |
| #bugs | *(manual)* | Bug reports — include version + logs |
| #feature-requests | `1493202214624428036` | Feature suggestions |

### 🔨 BUILDERS (`1493202219321921696`)
| Channel | ID | Purpose |
|---|---|---|
| #dev-talk | `1493202223453175859` | Technical architecture discussion |
| #agent-recipes | `1493202227719049226` | Share agent configs and prompts |

---

## Roles

| Role | ID | Color | Assignment |
|---|---|---|---|
| 🌐 Community | `1493202377468153987` | #5AC4FF | Auto on join |
| 🔨 Builder | `1493202381393891413` | #22c55e | Self-assign via `/builder` |
| 🏢 Enterprise | `1493202385739452436` | #f59e0b | Manual (admin) |
| ⚡ KI-OS Team | `1493202389686026320` | #ee4242 | Manual (admin) |

---

## GitHub → Discord Webhook

| Property | Value |
|---|---|
| Hook ID | `605967161` |
| Target Channel | #releases |
| Events | `release`, `issues`, `pull_request`, `star` |
| Webhook URL | stored in `.env` as `DISCORD_WEBHOOK_RELEASES` |

Manage at: https://github.com/KI-OS-org/ki-os/settings/hooks

---

## Environment Variables

All Discord credentials live in `.env` (both PC and Mac):

```env
DISCORD_BOT_TOKEN=         # Bot token — reset at Developer Portal if compromised
DISCORD_CLIENT_ID=1493200630208587848
DISCORD_GUILD_ID=1493193129073840168
DISCORD_CHANNEL_WELCOME=1493202186283389099
DISCORD_CHANNEL_ANNOUNCEMENTS=1493202169120428196
DISCORD_CHANNEL_RELEASES=1493202173939548356
DISCORD_CHANNEL_GENERAL=1493202186283389099
DISCORD_CHANNEL_SUPPORT=1493202206793662464
DISCORD_CHANNEL_SHOWCASE=1493202194210619432
DISCORD_ROLE_COMMUNITY=1493202377468153987
DISCORD_ROLE_BUILDER=1493202381393891413
DISCORD_ROLE_ENTERPRISE=1493202385739452436
DISCORD_ROLE_TEAM=1493202389686026320
DISCORD_WEBHOOK_RELEASES=  # stored in .env — do not expose publicly
```

---

## Pending Manual Steps

- [ ] Create `#bugs` channel under 🛠️ SUPPORT (Discord UI: Rechtsklick → Create Channel)
- [ ] Set `#announcements` to read-only for Community role (Channel Permissions → Community → deny Send Messages)
- [ ] Set `#roadmap` to read-only for Community role
- [ ] Assign yourself the ⚡ KI-OS Team role
- [ ] Enable Community Mode: Server Settings → Enable Community
- [ ] Set server icon
- [ ] Regenerate Bot Token at Developer Portal (token was shared in chat session 2026-04-13)

---

## Files

| File | Purpose |
|---|---|
| `scripts/discord-bot.js` | KIMBA Discord Bot (slash commands, welcome, automod) |
| `scripts/discord-setup-guide.md` | Step-by-step setup guide |
| `docs/discord/README.md` | This file — access reference |
