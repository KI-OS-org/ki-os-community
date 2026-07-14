# KI-OS Community Edition API Reference (v1.23.0)

> **Hinweis**: Diese Dokumentation beschreibt die **Community Edition** von KI-OS (AGPL v3). Enterprise-only-Funktionen sind am Ende aufgeführt, aber nicht dokumentiert.

---

## System

### Health & Status
- `GET /health` — Systemstatus prüfen
- `GET /ready` — Prüfung, ob System bereit ist
- `GET /status` — Detaillierter Systemstatus
- `GET /metrics` — Metriken im Prometheus-Format

---

## Chat

### Chat & Stream
- `POST /chat` — Nachricht an KIMBA senden
- `GET /ui/stream` — SSE-Event-Stream für UI-Ereignisse

---

## Agents (Registry)

### Agentenverwaltung
- `GET /agents` — Liste aller Agenten
- `GET /agents/stats` — Statistiken zu Agenten
- `GET /agents/:id` — Einzelner Agent

---

## AgentMesh — Multi-Agent Runs

### Run-Management
- `POST /agentmesh/runs` — Neuen Run starten
- `GET /agentmesh/runs` — Liste aller Runs
- `GET /agentmesh/runs/:id` — Einzelner Run

---

## A2A Protocol (Agent-to-Agent)

### Kommunikation & Nachrichten
- `POST /agents` — Agent registrieren
- `DELETE /agents/:id` — Agent abmelden
- `GET /agents/capabilities/:capability` — Capabilities abrufen
- `POST /agents/:id/heartbeat` — Heartbeat senden
- `PATCH /agents/:id/status` — Status aktualisieren
- `POST /send` — Nachricht senden
- `POST /broadcast` — Broadcast-Nachricht
- `GET /messages/:agentId` — Nachrichten eines Agenten
- `DELETE /messages/:id` — Nachricht als gelesen markieren
- `POST /messages/:id/complete` — Nachricht abschließen
- `GET /stats` — Kommunikationsstatistiken

---

## Memory (Generisch)

### Speichern & Suchen
- `GET/POST /memory/retrieve` — Memory abrufen/speichern
- `/memory/*` — Weitere Memory-Operationen (Get/Store/Delete/Search)

---

## Swarm Memory — /api/swarm

### Kollektives Gedächtnis
- `POST /store` — Text speichern
- `POST /search` — Ähnlichkeitssuche
- `GET /stats` — Statistiken
- `GET /entries` — Einträge abrufen (limit, type)
- `POST /feedback` — Feedback senden (positive/negative)
- `GET /context` — Kontext aus Broker-Suche
- `POST /brief` — Formatierter Memory-Briefing für Task

---

## Routing

### Routing & Entscheidungen
- `GET /routing/resolve` — Routing-Entscheidung
- `GET /routing/profiles` — Routing-Profile
- `GET /routing/decisions` — Entscheidungen abrufen
- `GET /routing/scorecards` — Scorecards abrufen

---

## Governance — /api/governance

### Governance & Policy
- `GET /status` — Governance-Status
- `GET /policy` — Aktuelle Policy
- `POST /audit` — Audit-Log (runId, event)
- `GET /governance/policies` — Policies abrufen
- `GET /governance/registry` — Registry abrufen
- `POST /governance/simulate` — Policy simulieren

---

## Privacy

### Datenschutz
- `POST /privacy/analyze` — Inhalt auf Sensibilität prüfen
- `POST /privacy/mask` — Sensible Daten maskieren
- `POST /privacy/demask` — Maskierte Daten entschlüsseln

---

## Files

### Dateiverwaltung
- `POST /files/upload` — Datei hochladen
- `GET /files/fabric` — Dateien über Fabric suchen
- `GET /files` — Liste aller Dateien
- `GET /files/:id` — Einzelne Datei abrufen

---

## Connectors (MCP)

### Generische Connector-API
- `GET /connectors/capabilities` — Unterstützte Capabilities
- `GET /connectors/health` — Connector-Status
- `POST /connectors/resolve` — Connector auflösen
- `GET /connectors` — Connector-Manifest abrufen

---

## MCP Gateway — /mcp/gateway

### Gateway-Funktionen
- `GET /status` — Gateway-Status
- `GET /sse` — SSE-Stream (wenn aktiviert)
- `POST /message` — Nachricht senden

---

## MCP↔OpenAPI Bridge — /mcp/bridge

### Bridge-Funktionen
- `POST /register` — Tool registrieren
- `GET /tools` — Tools abrufen
- `POST /execute` — Tool ausführen
- `DELETE /spec/:id` — Spezifikation löschen
- `GET /specs` — Spezifikationen abrufen

---

## Automation

### Automatisierung
- `POST /automation/webhook` — Webhook auslösen

---

## Media

### Medienverarbeitung
- `POST /media/image` — Bild verarbeiten
- `POST /media/video` — Video verarbeiten
- `GET /media/status` — Medienstatus abrufen

---

## Self-Repair

### Selbstheilung
- `GET /selfrepair/stats` — Statistiken zur Selbstheilung
- `POST /selfrepair/trigger` — Selbstheilung manuell auslösen

---

## Notifications

### Benachrichtigungen
- `GET /notifications/feed` — Benachrichtigungsfeed
- `GET /notifications/count` — Anzahl ungelesener Benachrichtigungen
- `POST /notifications/mark-all-read` — Alle als gelesen markieren

---

## AI Service Platform — /api/platform

### KI-Dienste verwalten
- `GET /services` — Alle Dienste + Status
- `GET /services/:id` — Einzelner Dienst
- `POST /services/:id/enable` — Dienst aktivieren
- `POST /services/:id/disable` — Dienst deaktivieren
- `GET /backends` — Verfügbare KI-Backends
- `GET /backends/:id` — Einzelnes Backend
- `POST /route` — Route für Anfrage bestimmen
- `GET /costs` — Kostenübersicht

---

## ClawHub-Kompatibilitäts-Layer — /api/claws

### Claw-Skills verwalten
- `POST /scan` — Claw-Skill scannen (Ampel: rot/gelb/grün)
- `POST /install` — Skill installieren (403 bei rot)
- `DELETE /uninstall/:name` — Skill deinstallieren
- `GET /list` — Liste installierter Skills
- `GET /docker-status` — Docker-Status
- `POST /run/:name` — Skill ausführen (mit Re-Scan)

---

## Channel-Parität — /api/channels

### Kanäle verwalten
- `GET /status` — Status aller Kanäle
- `GET /status/:name` — Einzelner Kanal
- `POST /:name/start` — Kanal starten
- `POST /:name/stop` — Kanal stoppen
- `POST /:name/send` — Nachricht senden

---

## SkillForge — /api/skillforge

### Skills erstellen & genehmigen
- `POST /propose` — Skill-Vorschlag einreichen
- `GET /proposals` — Liste der Vorschläge
- `GET /proposals/:id` — Einzelner Vorschlag
- `POST /proposals/:id/approve` — Vorschlag genehmigen
- `POST /proposals/:id/reject` — Vorschlag ablehnen

---

## Timeline — /api/timeline

### Aktivitätsverlauf
- `POST /append` — Eintrag hinzufügen
- `GET /recent` — Letzte Einträge
- `GET /search` — Semantische Suche
- `GET /blacklist` — Blacklist abrufen
- `POST /blacklist` — Apps zur Blacklist hinzufügen
- `POST /blacklist/add` — Einzelne App hinzufügen
- `POST /blacklist/remove` — Einzelne App entfernen
- `POST /delete-range` — Bereich löschen

---

## Skills Registry — /api/skills

### Skill-Verwaltung
- `GET /` — Alle Skills
- `POST /invoke` — Skill aufrufen
- `POST /install` — Skill installieren
- `DELETE /uninstall/:name` — Skill deinstallieren
- `GET /catalog` — Skill-Katalog
- `GET /installed` — Installierte Skills

---

## Control Tower — /api/tower

### Überwachung & Steuerung
- `GET /runs` — Runs abrufen
- `GET /costs` — Kostenübersicht
- `GET /costs/session` — Session-Kosten
- `DELETE /costs/session` — Session-Kosten löschen
- `GET /costs/live` — Live-Kosten
- `GET /connectors` — Connector-Status
- `GET /policy` — Aktuelle Policy
- `POST /policy/override` — Policy überschreiben
- `DELETE /policy/override` — Override entfernen

---

## Hierarchical Teams — /api/hierarchical

### Team-Management
- `POST /run` — Run für Team starten
- `GET /teams` — Teams abrufen
- `GET /stats` — Team-Statistiken

---

## Missions & War Rooms — /api/missions

### Missionen & Entscheidungen
- `GET /inbox` — Inbox abrufen
- `GET /seeds` — Seeds abrufen
- `POST /seeds/:id/confirm` — Seed bestätigen
- `POST /seeds/:id/dismiss` — Seed verwerfen
- `GET /warrooms` — War Rooms abrufen
- `GET /warrooms/:id` — Einzelner War Room
- `PATCH /warrooms/:id` — War Room aktualisieren
- `POST /warrooms/:id/decision` — Entscheidung treffen
- `POST /warrooms/:id/next-step` — Nächsten Schritt setzen
- `POST /warrooms/:id/close` — War Room schließen
- `GET /stream` — Stream abrufen
- `POST /process` — Prozess starten

---

## Signal Router — /api/signals

### Signalverarbeitung
- `GET /status` — Router-Status
- `POST /route` — Signal weiterleiten
- `GET /queue` — Warteschlange abrufen
- `POST /flush` — Queue leeren
- `GET /channels` — Kanäle abrufen
- `GET /stream` — Stream abrufen

---

## Decision Engine — /api/decisions

### Entscheidungslogik
- `POST /compress/:warRoomId` — Entscheidung komprimieren
- `GET /capsule/:warRoomId` — Entscheidungskapsel abrufen
- `GET /capsules` — Kapseln abrufen
- `GET /models` — Modelle abrufen
- `POST /score` — Score berechnen

---

## Earpiece — /api/earpiece

### Meeting & Whisper-Funktionen
- `GET /status` — Status abrufen
- `POST /meeting/start` — Meeting starten
- `POST /meeting/pre` — Vorbereitung
- `POST /meeting/end` — Meeting beenden
- `POST /whisper` — Whisper senden
- `GET /stream` — Stream abrufen
- `GET /transcript` — Transkript abrufen

---

## Audio Cache — /api/audio-cache

### Audioverwaltung
- `GET /stats` — Statistiken
- `GET /entries` — Einträge abrufen
- `POST /search` — Audio suchen
- `DELETE /clear` — Cache leeren
- `GET /catalog` — Katalog abrufen

---

## Persona — /api/persona

### Persona-Management
- `GET /` — Aktuelle Persona
- `POST /` — Neue Persona setzen
- `DELETE /` — Persona zurücksetzen

---

## Autopsy — /api/autopsy

### Run-Analyse
- `GET /` — Liste der Runs
- `GET /:runId` — Einzelner Run

---

## WhatsApp / Meta — /api/whatsapp

### WhatsApp-Integration
- `POST /inbound` — Twilio-Webhook
- `GET /seeds` — Seeds abrufen
- `GET /meta/verify` — Meta-Verifizierung
- `POST /meta/inbound` — Meta-Inbound-Nachricht

---

## Microsoft Teams/Outlook (Agent365) — /api/agent365

### Agent365-Integration
- `POST /message` — Nachricht senden (signaturvalidiert)
- `GET /manifest` — Manifest abrufen
- `GET /status` — Status abrufen

---

## Markdown Viewer — /api/md-viewer

### Markdown-Ansicht
- `GET /tree` — Verzeichnisstruktur
- `GET /load` — Datei laden
- `POST /save` — Datei speichern

---

## Sales / CRM — /api/sales

### Vertrieb & Kontakte
- `GET /pipeline` — Pipeline abrufen
- `GET /contacts` — Kontakte abrufen
- `POST /contacts` — Kontakt erstellen
- `PUT /contacts/:id/status` — Status ändern
- `POST /contacts/:id/offers` — Angebot erstellen
- `GET /contacts/overdue` — Überfällige Kontakte
- `POST /dna/profile` — Profil erstellen/abrufen
- `POST /dna/interview` — Interview erstellen/abrufen
- `POST /dna/style` — Stil erstellen/abrufen
- `POST /dna/linkedin/url` — LinkedIn-URL importieren
- `POST /dna/linkedin/csv` — LinkedIn-CSV importieren
- `POST /dna/cv` — Lebenslauf importieren
- `POST /contacts/:id/outreach` — Outreach erstellen/abrufen
- `PUT /outreach/:draftId/status` — Outreach-Status ändern
- `GET /followups/due` — Fällige Follow-ups
- `GET /catalog` — Katalog abrufen
- `GET /catalog/:sku` — Einzelnes Produkt
- `POST /catalog/import` — Katalog importieren
- `PUT /catalog/:sku/price` — Preis ändern
- `GET /pricing/rules` — Preisregeln
- `POST /pricing/rules` — Regel erstellen
- `POST /pricing/calculate` — Preis berechnen
- `POST /pricing/quote` — Angebot erstellen

---

## Mobile API

### Mobile Endpunkte
- `GET /api/mobile/fs/tree` — Dateibaum abrufen
- `GET /api/mobile/fs/file` — Datei abrufen
- `POST /api/mobile/fs/mkdir` — Verzeichnis erstellen
- `POST /api/mobile/fs/init` — FS initialisieren
- `POST /api/mobile/ask` — Frage stellen
- `POST /api/mobile/run-claude` — Claude ausführen
- `POST /api/voice/transcribe` — Transkription
- `GET /api/voice/voices` — Stimmen abrufen
- `POST /api/voice/tts` — Text-to-Speech

---

## Auth & Rollen

### Authentifizierung & Rollen
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Registrieren
- `POST /api/auth/refresh` — Token erneuern
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Eigenen Nutzer abrufen
- `GET /api/roles` — Rollen abrufen
- `GET /api/roles/:name` — Einzelne Rolle
- `POST /api/roles/recommend` — Rolle empfehlen

---

## Handoff & Scorecard & Intelligence & License

### Handoff & Bewertung
- `GET /api/handoff/:runId` — Handoff abrufen
- `GET /api/scorecard/scorecard` — Scorecard abrufen
- `POST /api/scorecard/scorecard/record` — Eintrag hinzufügen
- `GET /api/scorecard/scorecard/recommend` — Empfehlung abrufen
- `GET /api/intelligence/proposals` — Vorschläge abrufen
- `POST /api/intelligence/scan` — Scan durchführen
- `PATCH /api/intelligence/proposals/:id` — Vorschlag aktualisieren
- `GET /api/intelligence/router/recommend` — Router-Empfehlung
- `GET /api/license/status` — Lizenzstatus
- `POST /api/license/refresh` — Lizenz erneuern

---

## n8n Integration

### n8n-Workflows
- `POST /n8n/webhook/:event` — Webhook auslösen
- `GET /n8n/status` — n8n-Status
- `GET /n8n/workflows` — Workflows abrufen
- `POST /n8n/workflows/:id/trigger` — Workflow auslösen
- `GET /n8n/callbacks` — Callbacks abrufen

---

## Error Format

```json
{ "success": false, "error": "error_code", "runId": "optional-run-id" }
```

HTTP-Status je nach Fehlerart: `400` ungültige Parameter, `401`/`403` Auth/Berechtigung, `404` nicht gefunden, `409` Konflikt/Sperre, `423` gesperrt, `500` interner Fehler, `503` deaktiviert/nicht unterstützt.

---

## Enterprise-Only Endpoints

Folgende Funktionen sind **nicht Teil der Community Edition** und liefern bei Zugriff einen `403 enterprise_only`-Fehler:

- **Multi-Tenancy** (`/tenant/*`)
- **Federation** (`/federation/*`)
- **Economic/Federation-Optimizer** (`/economic/*`)
- **DAG Execution Engine** (`/dag/*`)
- **Workspace Advanced Features** (`/workspace/*`)
- **State Fabric** (`/state/*`)
- **Desktop Control** (Beobachtung & Aktionen wie klicken/tippen/Apps steuern)
- **Ghost Control** (`/api/ghost`)
- **Compliance/Audit-Reports** (`/api/compliance`)
- **Trace-Analytics** (`/api/analytics`)
- **Voice Synthesis/Cloning** (`/api/voice-clone`, HeyGen Video-Avatar)
- **Retail/Sales-Erweiterungen** (basierend auf `backend/services/retail`/`retail-brain`)
- **Simulations** (`/simulations/*`)
- **Packs** (`/packs/*`)
- **PKI/Verifier-Services**
- **Resilience-Services**
- **Campaigns** (`/campaign/*`) – nur Enterprise-Connectoren wie SAP/Salesforce/Teams

> Hinweis: Die Basis-Campaign-Engine ist in der Community Edition enthalten.

**Enterprise inquiry:** [enterprise@ki-os.org](mailto:enterprise@ki-os.org)

---

*KI-OS Community Edition v1.23.0 — AGPL-3.0 — [ki-os.org](https://ki-os.org)*
