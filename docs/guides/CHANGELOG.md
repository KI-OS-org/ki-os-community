# KI-OS Changelog

---

## v1.7.0 — A2A Base Protocol · KIMBA Intelligence CLI · Security (2026-05-18)

### New Features — Community (AGPL-3.0)

**A2A Base Protocol (v1.10.0 → Community)**
- **Agent-to-Agent Interoperability** — KI-OS kann als A2A-Knoten fungieren: andere Agents registrieren sich, senden Nachrichten, empfangen Broadcasts. Kompatibel mit Agentforce, CrewAI, LangGraph und jedem A2A-konformen System. (`backend/services/a2a/`, `backend/controllers/a2a.controller.js`)
- **Agent Card Endpoint** — `GET /.well-known/agent.json` liefert standardisierte Agent-Metadaten (Name, Version, Capabilities). Discovery für externe Systeme ohne Konfiguration.
- **A2A REST API** — 13 Endpunkte: Agent-Registrierung/Abmeldung, Heartbeat, Status-Updates, Nachrichten senden/empfangen/bestätigen, Broadcast, Stats. (`/a2a/agents`, `/a2a/send`, `/a2a/broadcast`, `/a2a/messages/:id`, `/a2a/stats`)
- **Community-safe** — Kein Enterprise-Dependency. AGPL-3.0. A2A Federated (multi-organisatorische Verbindungen, Audit-Trails) kommt in Enterprise.

**KIMBA Intelligence CLI (vK1)**
- **Pattern Analyst** — Analysiert Missions und Aktivitäten, erkennt Schwerpunktthemen automatisch, generiert 3 priorisierte Empfehlungen mit Begründung. (`cli/src/kimba/pattern.analyst.ts`)
- **Erweitertes Nutzerprofil** — Interessen werden automatisch aus Mission-Titeln extrahiert. Explizite Ziele, Feedback-Signale, Focus-Score. (`cli/src/kimba/kimba.profile.ts`)
- **User Context Injector** — Kompakter Kontext-Block (Interessen, Arbeitsweise, Budget, Empfehlung) wird team-weit in alle Adapter injiziert — alle Modelle kennen die Erwartungshaltung. (`cli/src/context/user.context.injector.ts`)
- **Feedback-Loop** — Nach jedem Mission-Abschluss optionales 1-Satz-Feedback. Enter = positiv, kurzer Text = Verbesserungshinweis. Kein Zwang, immer überspringbar. (`cli/src/kimba/kimba.chat.ts`)
- CLI wird als separates `@ki-os/cli` npm-Paket verteilt.

### Security

- **npm audit**: 14 → 9 Vulnerabilities — alle 5 HIGH-Severity eliminiert (`hono`, `elliptic`, `@smithy` via overrides)
- **Abhängigkeits-Updates**: Kritische Pakete auf sichere Versionen angehoben ohne Breaking Changes

### Architecture

- A2A Base nutzt `handleA2aRequest()` Adapter — kompatibel mit KI-OS Custom HTTP Router (kein Express erforderlich)
- A2A Federated (Enterprise): Multi-Tenant Agent-Hubs, kreuzorganisatorische Verbindungen, Compliance-Audit-Trails
- Reflection Engine (Enterprise): Run-Bewertung, Team-weite Learnings, Qualitäts-Trends — bewusst nicht in Community um Enterprise-Mehrwert zu erhalten

### Engineering

- **Team:** Kimba (Architektur + Integration) · Codestral (A2A Wrapper) · Devstral (Reflection Wrapper) · Claude Code nativ (Routing + Build)
- Delegation: 2 OpenRouter-Modelle (Codestral + Devstral)

---

## v1.12.0 — Decision Theater · Twin Playground · Community Visibility Layer (2026-04-20)

### New Features — Community (AGPL-3.0)

**Decision Theater (v1.11-C)**
- **Theater Event Aggregator** — Vereint Run Registry, Routing Log und OTel-Spans pro Run zu einem einheitlichen, zeitlich sortierten Event-Stream (reasoning/route/tool/policy/memory/output). (`backend/services/theater/theater.aggregator.service.js`)
- **Theater Snapshot Service** — Erzeugt unveränderliche gzip-JSON-Snapshots mit automatischer Redaction: API-Keys, Emails, Telefonnummern, user_prompt-Felder. (`backend/services/theater/theater.snapshot.service.js`)
- **Theater Share Service** — Share-Tokens (unlisted/public/private), Redaction vor Upload, View-Count nur für nicht-private Shares. (`backend/services/theater/theater.share.service.js`)
- **Theater Gallery Service** — Öffentliche Gallery mit Star-System, Pagination, featured Items. (`backend/services/theater/theater.gallery.service.js`)
- **Theater DB** — SQLite `theater.db` mit `theater_shares` + `theater_gallery`, WAL-Mode, graceful better-sqlite3. (`backend/services/theater/theater.db.service.js`)
- **Theater Routes** — 7 Endpunkte: POST/GET snapshot, POST share, GET replay/:token, GET/POST gallery, DELETE share. (`backend/routes/theater.routes.js`)
- **Replay Page** — Öffentliche Next.js-Page `/theater/replay/[token]` mit OG-Tags für Social-Preview. KI-OS CI: Plus Jakarta Sans, CSS-Variablen, glass-card. (`frontend/orbit-control/app/theater/replay/[token]/page.tsx`)
- **Gallery Page** — Geschützte Page `/theater` mit Gallery-Grid, Share-Links, Tier-System. (`frontend/orbit-control/app/(protected)/theater/page.tsx`)
- **Theater Components** — `TheaterReplayPage` (Timeline + Szenen-Panel + Live-Meters) und `TheaterShareDialog` (Tier 1/2/3, interaktive Redaction-Preview, DSGVO-Hinweis). Vollständig auf KI-OS CI konvertiert. (`frontend/orbit-control/components/theater/`)

**Twin Playground (v1.12)**
- **Twin Store** — SQLite `twin.db` mit `scenarios`-Tabelle, Transaktions-sicheres fork(), UUID-Generierung, Whitelist-Update. (`backend/services/twin/twin.store.service.js`)
- **Scenario Bundle Format** — `.kios-scenario` Dateiformat (gezipptes JSON, max 5 MB). Serialize/Deserialize/Filename. (`backend/services/twin/scenario.bundle.js`)
- **Twin Simulator** — Führt Szenario-Fixtures als simulierte Connector-Calls aus, gibt Event-Stream zurück. (`backend/services/twin/twin.simulator.service.js`)
- **Marketplace Service** — Facade: list/get/import/export/fork/run/addStar. (`backend/services/twin/marketplace.service.js`)
- **Seed Szenarien** — 10 kuratierte Szenarien: Retail-Retoure, Preisverhandlung, Insurance, HR-Absagen, Supply-Chain, Legal, Support-Eskalation, Finance/EU-AI-Act, Multi-Agent-Handoff, DevOps-Incident. (`backend/services/twin/seed.scenarios.js`)
- **Playground Routes** — 7 Endpunkte: GET/POST scenarios, import/export, fork, star, POST run. (`backend/routes/playground.routes.js`)
- **Playground Page** — Geschützte Page `/playground` mit Tag-Filter, Szenario-Grid, Ergebnis-Panel. (`frontend/orbit-control/app/(protected)/playground/page.tsx`)
- **Playground Components** — `PlaygroundShell`, `ScenarioCard` (Fork-Badge, Stars, Run-Count), `RunResultPanel` (Steps mit Event-Farben, Theater-Share-Button). (`frontend/orbit-control/components/playground/`)
- **Doku** — `docs/QWEN_CLI_MCP_KONFIGURATION.md` — Vollständige Konfigurationsdoku: Qwen CLI, DashScope-Modelle, OpenRouter-Direktzugriff, KIMBA MCP Tools, Delegation-Workflow, Update-Anleitung.

### Architecture

- Decision Theater: kein neuer Run-Datenweg — nutzt Run Registry, Routing Log und OTel als Quellen
- Twin Playground: Zero-Dependency auf v1.11-B Enterprise Twin Shadow — eigenständige Community-Basis
- Beide Features nutzen den Theater Renderer als gemeinsame Visualisierungs-Komponente
- Routing in `server.js`: `/api/theater` + `/api/playground` registriert
- Redaction-Policy: PII/API-Keys/Prompts werden vor jedem Share entfernt, Preview zeigt Nutzer was geteilt wird

### Engineering

- **Team:** Kimba (Architektur + Briefing + Fixes) · Qwen CLI qwen3.5-plus (Builder, 4 Runs) · DeepSeek V3 via OpenRouter (Code-Review, 2 Runs) · Codex gpt-5.4 (Frontend-Konvertierung)
- **Tests:** 27/27 Theater ✓ · 29/29 Playground ✓ · **56 Tests gesamt, 0 Fehler**
- Workflow etabliert: Codex (UI-Konvertierung) → Qwen (Backend) → DeepSeek (Review) → Qwen (Fixes + Tests)

### Session Costs

- Qwen CLI qwen3.5-plus / DashScope (4 Runs, Builder): ~$0.003
- DeepSeek V3 via OpenRouter (2 Reviews): ~$0.001
- Codex gpt-5.4 via ChatGPT Plus (Frontend): ~$0.00 (Flat-Rate)
- **Session Total v1.12.0: ~$0.004**

---

## v1.10.0 — A2A Protocol · Agent-to-Agent Interoperability (2026-04-20)

### New Features — Community (AGPL-3.0)

- **A2A Service** — Eingehende Tasks von externen A2A-Agenten werden als AgentMesh-Runs ausgeführt. createTask / getTask / cancelTask. (`backend/services/a2a/a2a.service.js`)
- **A2A Routes + Agent Card** — `GET /.well-known/agent.json` (Agent Card: name, skills, capabilities), `POST /a2a` (Task einreichen), `GET /a2a/:taskId` (Status), `DELETE /a2a/:taskId` (Cancel). (`backend/routes/a2a.routes.js`)

### Architecture

- Google A2A Standard (Apache 2.0, April 2025) implementiert — KI-OS ist ab sofort als A2A-Agent auffindbar
- Kompatibel mit: Salesforce Agentforce · SAP Joule · ServiceNow · Workday · LangGraph · CrewAI · AutoGen

### Session Costs

- Codex gpt-5.4 (ChatGPT Plus, Builder): ~$0.00 (Flat-Rate)
- DeepSeek Code-Review: ~$0.0003
- **Session Total v1.10.0: ~$0.0003**

---

## v1.9.1 — LLM Smart Router · Circuit Breaker · Request Queue (2026-04-20)

### New Features — Community (AGPL-3.0)

- **LLM Router** — 5 Provider-Familien (deepseek/qwen/anthropic/openai/gemini) mit Fallback-Ketten: Direkt-API → OpenRouter → Anker. (`backend/services/core/llm.router.js`)
- **Retry + Exponential Backoff** — 429/503/529 → 800ms/1600ms/3200ms, max 3 Versuche pro Provider-Stufe.
- **Circuit Breaker** — CLOSED/OPEN/HALF_OPEN Zustandsautomat, 3 Fehler/60s → Provider gesperrt. ENV Kill-Switch: `CIRCUIT_BREAKER_ENABLED=false`. (`backend/services/core/circuit-breaker.js`)
- **LLM Queue** — Concurrency-Limit 5, Timeout-Message: "Maximale gleichzeitige Verbindungen erreicht". (`backend/services/core/llm.queue.js`)
- **mesh.runtime.js** — `llmCall()` delegiert jetzt an `llm.router.js` (1 Zeile, drop-in)

### Architecture

- Direkt-APIs (DEEPSEEK_API_KEY, DASHSCOPE_API_KEY) werden jetzt bevorzugt — OpenRouter ist Fallback, nicht primärer Kanal
- Kein Single-Point-of-Failure mehr bei OpenRouter-Ausfall

### Session Costs

- Codex gpt-5.4 (ChatGPT Plus, Builder): ~$0.00
- DeepSeek Code-Review: ~$0.0003
- **Session Total v1.9.1: ~$0.0003**

---

## v1.9.0 — WOW Layer Phase 8 · Replay · Evidence/Compliance (2026-04-19)

### New Features — Community (AGPL-3.0)

- **Replay Service (P2)** — Re-Run light: Neustart eines AgentMesh-Runs ab LangGraph-Checkpoint oder Run-Registry. getCheckpoints, isReplayable, replay, getReplayStatus. (`backend/services/agent/replay.service.js`)
- **Evidence / Compliance Service (P2)** — Audit-Reports aus OTel-Traces. ISO 27001 A.12.4.1 + A.17.1.2, EU AI Act Art. 9, DSGVO Art. 30. generateReport, exportAuditLog, getComplianceStatus, getEvidenceForRun. (`backend/services/compliance/evidence.service.js`)
- **C-Deck v3.0 WOW Layer Phase 8 ✅** — 7/7 QA-Tests grün: Health-Badge, Kosten-Ticker, WS-Event-Router (TEAM_STATUS + POLICY_STATE), Approval-Schema, statusToDot. (`tests/integration/v190.cdeck-qa.test.js`)

### Architecture

- v1.9.0 Sprint: WOW Layer Phase 8 abgeschlossen — alle 8 Phasen done
- P2-Features Replay + Evidence/Compliance: "light" Implementierung als Community-Basis
- C-Deck v3.0: Definition of Done vollständig erfüllt

### Session Costs

- Team Blau (Qwen 2.5-72B via OpenRouter): replay.service ~$0.000564, evidence.service ~$0.000896
- Team Gold (Gemini 2.0 Flash via OpenRouter): Phase 8 QA ~$0.000415
- **Session Total v1.9.0: ~$0.0019**

---

## v1.8.0 — Blueprint Complete: MCP Gateway · LangGraph · OTel · n8n · Memory Broker · Security (2026-04-19)

> Rückdatiert: Alle v1.7.x und v1.8.x Session-Commits werden als v1.8.0 zusammengefasst.

### New Features — Community (AGPL-3.0)

- **LangGraph Adapter** — Optionale StateGraph-Brücke für AgentMesh (AGENT_RUNTIME=langgraph). Checkpoints, HITL via interruptBefore, Replay-Basis. (`backend/services/agent/langgraph.adapter.js`)
- **OTel Exporter** — OTLP/HTTP Export ohne @opentelemetry SDK. GenAI Semantic Conventions, Retry, Batch. (`backend/services/core/otel-exporter.service.js`)
- **n8n Sidecar** — Bidirektionale n8n-Kopplung: API-Client + HMAC-gesicherter Inbound-Webhook. (`backend/services/n8n/`)
- **Memory Broker** — Provenance-gesteuerter Wissenszugriff in AgentMesh. Jeder Zugriff mit runId + agentRole geloggt. (`backend/services/memory/memory.broker.js`)
- **MCP Gateway** — Standard-MCP-Port für externe KI-Clients (Claude Desktop, Cursor, Claude Code). Tools: run_task, search_docs, list_agents, get_run, search_memory. Stdio + SSE Transport. (`backend/services/mcp/mcp.gateway.service.js`)
- **Run Registry** — Persistentes SQLite-Logbuch aller AgentMesh-Runs. FTS5-Suche, Statistiken, Prune. (`backend/services/registry/run.registry.service.js`)
- **Routing Decision Log** — Economic Router loggt jede Modell-/Provider-Wahl strukturiert (In-Memory Ring + SQLite). (`backend/services/core/routing-decision.log.js`)
- **LLM Output Filter** — Automatischer Schutz gegen Training-Injections (CJK/CCP-Propaganda), Prompt-Injection, Jailbreak. In openrouter.provider.js integriert. (`backend/services/core/llm-output-filter.service.js`)
- **Projekt-DB** — SQLite/FTS5 für alle 212 Projekt-Docs. Optional sqlite-vec für Vektor-Suche. (`backend/services/db/project.db.service.js`)
- **Docs-Ingest-Script** — Alle /docs/*.md in Projekt-DB einlesen mit Kategorie-Auto-Detection. (`backend/scripts/ingest-docs.js`)
- **AGPL-3.0-only Header** — Alle 207 backend JS-Dateien mit korrektem Copyright + Lizenz-Header.
- **Integration Tests** — 16 Tests für alle neuen Services (node:test, kein Framework). (`tests/integration/v180.integration.test.js`)

### New Features — Enterprise (Proprietär, nicht in Community)

- **One Voice 1.5 Brand Voice Engine** — DNA-Extraktion, Multi-Channel-Rendering, Scoring, Feedback-Loop
- **Command Deck v3** — 4 Teams (Engineering, Business, Marketing, Operations), WOW Layer, Ghost Route
- **KIMBA MCP Server** — 13 Tools, OpenRouter-Delegation, Policy-Service, Budget-Tracking
- **Ghost Control** — Visual Fail-Detection, Re-Planning, LLM-Fallback (Enterprise-only Tiefe)
- **Swarm Intelligence** — AgentMesh Swarm Mode, Dev-Team-Memory (LanceDB), UCB1 (pausiert)

### Security

- LLM Output Filter erkennt DeepSeek-Training-Injection (HIGH: CJK-Block, Prompt-Injection; MEDIUM: Politischer Inhalt, Excessive Non-ASCII; LOW: Instruction-Override)
- Security Audit: 216 JS-Dateien, 28.777 Zeilen — CLEAN (2026-04-19)

### Architecture

- Blueprint `ki-os_blueprint_core_plus_sidecars.md` umgesetzt: P0 + P1 vollständig
- P0-Lücken geschlossen: MCP Gateway, Run Registry, Routing-Decision-Log
- Alle P1-Satelliten live: Memory Broker, LanceDB, n8n, OTel

### Breaking Changes

- `memory.broker.js` exportiert jetzt Singleton (`module.exports = new MemoryBroker()`)
- `n8n.sidecar.service.js` `isEnabled()` prüft jetzt `N8N_API_URL` statt `N8N_ENABLED`

### Kosten (Team-Budget Session 2026-04-19)
Qwen 2.5-72B + DeepSeek Chat via OpenRouter: **~$0.0089 gesamt**

---

## v1.6.0 — Ghost Control Vision + Swarm Memory + Native Providers (2026-04-15)

### New Features
- **Ghost Control Phase 2** — `replanOnVisionFail()`, `/ghost/replan` endpoint, Vision-Fail Re-Planning (max 2 retries, LLM-Fallback)
- **Swarm Memory API** — 6 REST endpoints (store, retrieve, feedback, stats, entries, prune), 19/19 tests green
- **Swarm Memory Live Demo** — Canvas visualization with ACO-nodes, pulse animation, real-time sync
- **LanceDB Adapter** — Embedding service + LanceDB integration for vector memory
- **Qwen / DashScope Provider** — Native Alibaba Cloud integration (`DASHSCOPE_API_KEY`), default model: `qwen-turbo`
- **Windows Shortcuts** — `scripts/create-shortcuts.ps1` creates .lnk files with KI-OS icon (no bat2exe)
- **macOS App Bundles** — `create-macos-app.sh` creates .app bundles via `sips` + `iconutil` (no third-party tools)
- **License Manager Service** — Foundation for edition management
- **Connector Profiles + Capability Registry** — Extended connector infrastructure

### Fixes
- Removed AWS SDK hard dependency from Community Edition
- Frontend API routes use `orbitFetch` instead of hardcoded localhost
- No `console.log` leaks in ghost/verify and ghost/replan routes

### Provider Support
OpenAI · Anthropic · Google Gemini · DeepSeek · OpenRouter · **Qwen/DashScope** (new, opt-in)

---

## v1.5.0 — Enterprise Foundation: OAuth/SSO + Connectors [PLANNED]

> **Target Date:** Q3 2026 · Status: Blueprint + Planning

### 🔐 Auth & Identity (Priority 1 — Enterprise Blocker)

Without SSO there is no first Enterprise deal. IT security decision-makers ask for it first.

- **OAuth 2.0 / OpenID Connect (OIDC)** — Standard for all Enterprise customers
- **SAML 2.0** — Azure Active Directory, LDAP, Okta
- **Single Sign-On** — Entire organization, one login
- Community stays on API Keys — Enterprise requires centralized auth
- Files: `backend/services/auth/oauth.service.js`, `backend/services/auth/saml.service.js`

### 🔌 Enterprise Connectors

#### Agentforce Connector (Salesforce)
KIMBA orchestrates Salesforce Agentforce as an internal CRM agent.
- `backend/connectors/agentforce/agentforce.connector.js` — OAuth 2.0 Client Credentials
- `backend/connectors/agentforce/agentforce.provider.js` — Router Adapter
- Intent routing: `crm`, `sales`, `lead`, `opportunity`, `case`

#### SAP Joule Connector
KIMBA orchestrates SAP Joule (AI Core) as an internal ERP agent.
- `backend/connectors/sap-joule/joule.connector.js` — SAP BTP OAuth 2.0
- `backend/connectors/sap-joule/joule.odata.js` — S/4HANA OData Helper
- Intent routing: `finance`, `erp`, `supply-chain`, `hr`, `procurement`
- Compliance: EU10 region, GDPR-compliant

### 📋 Compliance
- EU AI Act High Risk (Art. 9–15) — full implementation
- GDPR Data Residency Controls
- Complete audit log in Policy Engine

---

## v1.4.0 — Voice Control: STT Input Pipeline ✅ SHIPPED (2026-04-11)

> **Sprint:** Block 3 · Team: KIMBA (Claude + DeepSeek via OpenRouter)

TTS output was already complete. This sprint closes the full voice loop.

### 🎤 What was built

**Backend:**
- `backend/services/stt/stt.service.js` — OpenAI Whisper API (Base64 Audio → Text)
  - Supported formats: webm, mp4, ogg, wav, mp3 (automatic MIME detection)
  - Language auto-detect or explicit language tag (de, en, ...)
- `backend/services/stt/voice.executor.js` — STT text → Kimba Chat → TTS Audio
  - Closes the full voice loop
  - TTS response as Base64 data URL directly in the response
- `backend/services/stt/voice.controller.js` — Request Handler

**API Endpoints:**
- `POST /voice/transcribe` — STT only: Audio → Text
- `POST /voice/chat` — Full loop: Audio → Kimba → TTS Audio

**Frontend:**
- `components/voice/VoiceInput.tsx` — Push-to-Talk + Wake Word "Hey KI-OS"
- `components/voice/VoiceIndicator.tsx` — Animated status indicator (waves, spinner)
- `app/api/audio/stt/route.ts` — Next.js proxy → `/voice/transcribe`
- `app/api/audio/voice-chat/route.ts` — Next.js proxy → `/voice/chat`

### Voice Loop
```
Microphone → MediaRecorder → Base64 → Whisper → Kimba Chat → TTS → Audio
```

### Wake Word
"Hey KI-OS" → Browser SpeechRecognition API (best-effort)  
Fallback: Push-to-Talk Button

### ENV
```env
STT_MODEL=whisper-1
STT_TIMEOUT_MS=30000
VOICE_TTS_ENABLED=true
```

---

## v1.3.0 — Ghost Control: Backend + Full Pipeline ✅ SHIPPED (2026-04-11)

> **Sprint:** Block 1 · Team: KIMBA (Claude as Architect, DeepSeek as Reviewer via OpenRouter)

Frontend was 95% complete. This sprint builds the missing backend.

### 👻 What was built

**Backend:**
- `backend/services/ghost/ghost.plan.service.js` — LLM-based plan generator
  - KIMBA analyzes user goal → generates a navigable step sequence
  - All 50+ `data-ghost` selectors from the frontend registry in the prompt
  - Fallback chain: Anthropic → OpenRouter → OpenAI
- `backend/services/ghost/ghost.plan.controller.js` — Request Handler + Validation

**API:**
- `POST /ghost/plan` — `{ goal, mode }` → `{ needsClarification, plan }` or `{ needsClarification: true, question }`

**Route:**
- `core/app.js` — `/ghost/*` registered

### Example
```
User: "Create an agent named Marketing Scout"
KIMBA: [navigate /agents] → [spotlight new-agent-btn] → [click new-agent-btn]
     → [fill agent-name: "Marketing Scout"] → [click agent-save] → [speak "Done!"]
```

### Step Types
`navigate`, `spotlight`, `click`, `fill`, `speak`, `wait`, `confirm`, `api_call`

---

## v1.2.0 — Qwen Builder Agent ✅ SHIPPED (2026-04-11)

> **Sprint:** Block 2 · Team: KIMBA (Qwen writes its own builder via OpenRouter)

### 🤖 What was built

**No DashScope** — Qwen runs via OpenRouter with the existing provider.

- `backend/services/agent/qwen.builder.agent.js` — Qwen 2.5 72B Execution Agent
  - `build(task, options)` — Code generation with Qwen 2.5 72B
  - `analyze(input, question)` — Code/data analysis
  - `review(code, task)` — Code review with DeepSeek (reviewer role)
- `tools.registry.js` — 3 new tools: `qwen_build`, `qwen_analyze`, `qwen_review`
- `.env` — `QWEN_BUILDER_MODEL=qwen/qwen-2.5-72b-instruct`, `ROUTER_CODE_PROVIDER=openrouter`

### Kimba Hierarchy after v1.2.0
```
Supervisor  →  Claude (Anthropic)        — Strategy
Planner     →  Claude (Anthropic)        — Plan creation
Researcher  →  Qwen 2.5 72B (OpenRouter) — Synthesis
Executor    →  Qwen 2.5 72B (OpenRouter) — Code generation  ← NEW
Reviewer    →  DeepSeek Chat (OpenRouter) — Code review     ← NEW
Synthesizer →  Claude (Anthropic)        — Final response
```

### Cost Savings
| Role | Model | vs. pure Claude |
|---|---|---|
| Researcher | Qwen 2.5 72B | -50% |
| Reviewer | DeepSeek Chat | -82% |
| **Total per run** | | **~-60%** |

---

## v1.0.3 — OpenRouter Multi-Model Routing + Budget Tracking ✅ SHIPPED (2026-04-11)

> **Pre-Sprint Hardening** · Team: KIMBA

### ⚡ What was built

- `mesh.runtime.js` — `llmCall()` with OpenRouter branch for `qwen/*` + `deepseek/*` models
- **Cost tracking per run** — `logCost()` + `getCostSummary()` in every `llmCall()`
  - Model, provider, estimated tokens, USD per agent step
  - `costSummary` in `run.result` + `metrics` + log at `mesh.run.completed`
  - Baseline comparison against pure Claude operation
- **Role-specific model ENV:**
  ```env
  MESH_REVIEWER_MODEL=deepseek/deepseek-chat
  MESH_RESEARCHER_MODEL=qwen/qwen-2.5-72b-instruct
  ```
- No new provider code — OpenRouter was already implemented

---

## v1.1.0 — Production Ready (2026-04-03)

### 🎉 Highlights

- **Trust Center API** — Real Approve/Reject endpoints with audit logging
- **Frontend Authentication** — NextAuth v5 with backend integration
- **DAG Governance Nodes** — 4 new nodes (Governance Check, Privacy Mask, Memory Retrieve, Approval)
- **Capability Map UI** — Strategic overview for CIOs
- **Privacy UI** — GDPR Compliance Dashboard
- **Self Repair Error Reporting** — Automatic error tracking with email notification
- **Security Gateway** — Rate limiting, attack pattern detection, input sanitization

### 📊 Statistics

- **Code:** ~17,450 lines newly created
- **Tests:** 28 unit tests (100% passing), 55 E2E tests (ready)
- **Documentation:** 17+ new documents
- **Security:** 100% security coverage

### 🔒 Security

- Rate limiting (10 requests/hour)
- Attack pattern detection (XSS, SQL injection, etc.)
- Input sanitization · IP blacklisting
- Payload size limit (10KB) · CORS protection · Security headers

---

## v1.0.2 — Community Edition (2026-03-28)

### Features

- Agent Registry (CRUD)
- Intent analysis (keyword scoring)
- DAG Runtime · Policy Engine · Semantic Memory
- Supervisor · SelfRepair · Dynamic Routing
- Multi-Tenancy · Desktop Control

---

*Changelog last updated: 2026-04-11 — Sprint v1.2.0 / v1.3.0 / v1.4.0 SHIPPED*
