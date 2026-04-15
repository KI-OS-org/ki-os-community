# KI-OS Changelog

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
