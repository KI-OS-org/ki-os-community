<div align="center">

<img src="Web/logo.png" alt="KI-OS Logo" width="110" />

<h1>KI-OS — The AI Operating System</h1>

<p><strong>The definitive runtime layer for models, agents, memory, and autonomous execution.</strong><br/>
We do not integrate AI tools. We are the sovereign system that runs them.</p>

[![Version](https://img.shields.io/badge/version-1.23.0-blue?style=for-the-badge)](https://github.com/KI-OS-org/ki-os/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-green?style=for-the-badge)](LICENSE-AGPL)
[![Book](https://img.shields.io/badge/Book-April_2026-orange?style=for-the-badge)](https://ki-os.org/book.html)
[![Community](https://img.shields.io/badge/Edition-Community-brightgreen?style=for-the-badge)](#)

<br/>

[Website](https://ki-os.org) · [Live Demo](https://ki-os.org) · [Documentation](docs/COMMUNITY_API.md) · [Contact Sales](mailto:enterprise@ki-os.org) · [The Book](https://ki-os.org/book.html)

</div>

---

## The AI Operating System — Now Also an AI Service Platform

KI-OS remains what it has always been: the open AI Operating System, built around local control, transparency, and extensibility. What's new is that the same runtime now also serves as an **AI Service Platform** — a single, coherent layer spanning experience, governance, orchestration, model routing, connectors, and memory, all working together instead of as isolated features. *(Full architecture breakdown in Pillar 6 below.)*

> *"One Voice. Many Agents. Infinite Impact."*

This isn't a cloud requirement. The Community Edition runs entirely on your own machine — no Kubernetes, no managed cloud, no external dependency required. Cloud, container orchestration, and multi-region deployment are options KI-OS supports for teams who choose to run their own infrastructure that way — never a prerequisite.

Layered on top of this platform, KI-OS has also grown from a request-response tool into an ambient presence — one that watches your screen for context, remembers what you did weeks ago, speaks in a voice you can interrupt mid-sentence, reaches you wherever you already are, and quietly builds new capabilities for itself when it notices you doing the same thing three times.

| Capability | What It Means For You |
|---|---|
| Visual Timeline Memory | Remembers everything visible on your screen across time — searchable in natural language, with sensitive apps automatically excluded. |
| Multi-Channel Presence | Reaches you on WhatsApp, Signal, iMessage, Telegram, and Discord so the conversation continues wherever you already are. |
| Autonomous Skill Discovery | Detects your recurring work patterns and proposes reusable skills you can approve once — the system keeps and improves them. |
| Secure Third-Party Skills | Imports skills from others and executes them in a fully isolated environment — every skill is scanned before it ever runs. |
| Interruptible Voice & Avatar | Lets you cut in mid-sentence while the avatar reacts with genuine emotional response instead of a static expression. |
| Unified Mission Control | Gives you one dashboard over every local model, cloud API, and installed skill with automatic, privacy-aware routing. |

---

## What "Operating System" Actually Means Here

A normal operating system doesn't run your applications for you — it manages the
resources they all need: CPU time, memory, disk, processes, permissions. Without
it, every application would have to reinvent scheduling, memory management, and
device drivers on its own.

KI-OS does the same job, one layer up. Every AI tool you use — a chat model, a
browser agent, a voice assistant, a third-party skill — needs the same underlying
resources: which model to call and at what cost, where to store what it learned,
who is allowed to run what, and how to reach you. Today, every tool solves that
separately. None of them talk to each other. None of them remember what the
others learned. None of them enforce the same security policy.

KI-OS is the layer underneath all of them:

| Resource every AI tool needs | Without KI-OS | With KI-OS |
|---|---|---|
| **Which model to use** | Hardcoded per tool, no fallback | Routed automatically by cost/latency/privacy — one call, any model |
| **What it learned** | Lost when the session ends | Persisted in Swarm Memory, shared across every agent |
| **What it's allowed to do** | Trust the vendor, or don't use it | Scanned and sandboxed before first run (ClawHub layer), scored daily against your own codebase's baseline (German Shepherd) |
| **Where it reaches you** | One app, one channel | WhatsApp, Signal, iMessage, Telegram, Discord — same agent, your choice of channel |
| **Where your data lives** | Wherever the vendor's servers are | On your machine, by default, permanently — not a setting you can accidentally turn off |

None of this requires you to change how you already work with AI — you still
type a message or say a sentence. What changes is what happens to it afterward:
it gets routed, remembered, governed, and made available everywhere you are,
instead of evaporating the moment the chat window closes.

---

## Current Documentation

For the current verified system view, start with `docs/CURRENT_STATE.md`.
For historical sprint, release, and handoff material, use `docs/ARCHIVE_GUIDE.md` before relying on older documents.

---

## The 365-Day Advantage

> *"Not the best assistant on day one. The only one that's irreplaceable on day 365."*

Every mission, every sprint, every decision feeds a personal intelligence layer that compounds over time. Swarm Memory learns your routing preferences. German Shepherd learns your codebase DNA. The A2A network deepens with every connected agent. A competitor starting today has none of this history — and cannot buy it.

**Features are replicable in nine months. Accumulated intelligence is not.**

---

## The Architectural Manifesto

> *"This book is an invitation. Not to treat KI-OS as a tool. But to treat it as operational intelligence."*

The AI Era demands a massive shift from pure experimentation to relentless, scalable execution. KI-OS is the foundational layer that turns generative noise into robust corporate infrastructure. By fully abstracting models, agents, memory, and governance, KI-OS creates an immutable, highly stable environment for autonomous work at enterprise scale.

**We are moving past the era of prompt engineering. We are entering the era of AI systems engineering.**

---

## The End of AI Chaos

Most organizations don't have an AI problem. They have a **catastrophic AI chaos problem** — isolated tools, zero coordination, automations that break with every model update.

| BEFORE | AFTER |
|---|---|
| 12 disconnected tools | 1 unified execution system |
| 5 fragile APIs | Swarm intelligence |
| Broken workflows | Complete data sovereignty |
| Zero memory | Production-grade workflows |

KI-OS sits securely between your workforce and the fragmented AI landscape — routing intelligently, remembering context, enforcing governance, and orchestrating agents that **actually finish what they start**.

> *"AI without orchestration is noise. AI with KI-OS becomes infrastructure."*

---

## Where KI-OS Stands

| | **KI-OS** | LangGraph | CrewAI |
|---|:---:|:---:|:---:|
| Runs standalone out of the box | ✅ | ❌ library, you build the app | 🟡 CLI scaffold, still code-first |
| Built-in security guardian (daily code scan) | ✅ | ❌ | ❌ |
| Voice, Avatar & Screen Presence | ✅ | ❌ | ❌ |
| Local-first model routing¹ | ✅ | 🟡 bring-your-own | 🟡 bring-your-own |
| Open governance/compliance engine built-in | ✅ | ❌ | 🟡 Enterprise-only |
| Open A2A interoperability | ✅ | ❌ | ❌ |
| Persistent Swarm Memory across runs | ✅ | 🟡 bring-your-own | 🟡 bring-your-own |
| Open source (AGPL) | ✅ | ✅ MIT | ✅ MIT (core) |

> LangGraph and CrewAI are excellent orchestration *libraries* — they give you the building blocks, and you assemble the application around them. KI-OS is the application: multi-agent orchestration, governance, memory, voice, and screen presence, running out of the box, on your own machine.
>
> ¹ Fully true for the Community Edition. Business/Enterprise are self-hosted on your own infrastructure — your data never leaves it — but periodically validate a license key against `license.ki-os.org` (key only, never data).

---

## How It Works — The Six Core Pillars

### 1 — One Voice Agent: Multi-Model Routing

KI-OS evaluates every prompt in real-time and routes it to the optimal model — based on cost, latency, and reasoning depth. One unified interface. Any model. Automatic fallback.

<div align="center">
  <img src="Web/One-Voice-Agent.gif" alt="One Voice Agent — Multi-Model Routing Demo" width="820" />
  <br/><br/>
  <a href="https://ki-os.org">▶ Live Demo on ki-os.org</a>
</div>

| Capability | Status |
|---|---|
| Multi-Model Execution Engine | BUILT-IN |
| Intelligent Real-Time Model Routing | ACTIVE |
| Cost, Latency and Quality Optimization | FULLY AUTOMATED |
| Model Failure Fallback System | SELF-HEALING |
| Parallel Multi-Model Execution | SUPPORTED |

**Flagship Fleet:** OpenAI GPT · Anthropic Claude · Google Gemini · DeepSeek · Qwen · Meta Llama · Local / On-Premises (air-gapped)

---

### 2 — AgentMesh: Multi-Agent Orchestration

A living, breathing multi-agent runtime engineered for complex, multi-stage enterprise operations. Planner → Executor → Reviewer roles work in parallel with self-healing loops and autonomous agent-to-agent communication.

<div align="center">
  <img src="Web/AgentMesh.gif" alt="AgentMesh — Multi-Agent Orchestration Demo" width="820" />
  <br/><br/>
  <a href="https://ki-os.org">▶ Live Demo on ki-os.org</a>
</div>

| Capability | Status |
|---|---|
| Planner, Executor and Reviewer Roles | BUILT-IN |
| Supervisor Mesh Layer | SELF-RECOVERY |
| Self-Healing and Repair Loops | ADD-ON / INTEGRATED |
| Multi-Agent Parallel Runs | YES |
| Long-Running Stateful Workflows | YES |
| Autonomous Agent-to-Agent Communication | YES |

---

### 3 — Ghost Control: Autonomous Browser Agent

KI-OS v1.23.0 includes Ghost Control as a core autonomous browser agent pipeline. A Planner decomposes goals into steps, an Executor performs real browser actions, and a Vision module validates each result. If validation fails, the system re-plans automatically.

<div align="center">
  <img src="Web/GhostControl.gif" alt="Ghost Control — Autonomous Browser Agent Demo" width="820" />
  <br/><br/>
  <a href="https://ki-os.org/ghost-demo.html">▶ Interactive Ghost Control Demo →</a>
</div>

| Capability | Status |
|---|---|
| Goal → Plan decomposition (Planner Agent) | BUILT-IN |
| Browser action execution (Executor Agent) | BUILT-IN |
| Vision-based step verification | BUILT-IN |
| Automatic re-planning on failure | SELF-HEALING |
| No Selenium / no Playwright dependency | NATIVE |

---

### 4 — Galaxy Connectors: Enterprise Execution

Universal connector layer that bridges AI agents to any enterprise system — from SAP to Slack to your custom webhook — without writing glue code.

<div align="center">
  <img src="Web/Galaxyx.gif" alt="Galaxy Connectors — Enterprise Integration Demo" width="820" />
  <br/><br/>
  <a href="https://ki-os.org">▶ Live Demo on ki-os.org</a>
</div>

| Category | Systems |
|---|---|
| Enterprise AI | SAP Joule · Salesforce Agentforce · M365 Copilot · ServiceNow GenAI |
| ERP | SAP S/4HANA · Oracle ERP |
| CRM | Salesforce · HubSpot · Pipedrive · Microsoft Dynamics |
| Collaboration | Jira · Confluence · Slack · Teams · Google Workspace |
| Automation | n8n · Zapier · Make · Custom Webhooks |
| Data & Analytics | Snowflake · BigQuery · Databricks · S3 · Azure Blob |

---

### 5 — Swarm Intelligence: The Memory Layer

KI-OS memory is a hybrid architecture. The Community Edition provides local data sovereignty for individual use. The Business Edition runs a self-hosted central KI-OS server — your team shares one memory, your data never leaves your infrastructure. Both editions are built on the same sovereignty principle: **your data stays where you put it.**

<div align="center">
  <img src="Web/SWARM.gif" alt="KI-OS Swarm Intelligence — Collective AI Memory Demo" width="820" />
  <br/><br/>
  <a href="https://ki-os.org">▶ Live Demo on ki-os.org</a>
</div>

| Capability | Status |
|---|---|
| Persistent Vector Memory Store (LanceDB) | BUILT-IN |
| Cross-Run Learning and Pattern Reinforcement | YES |
| Shared Swarm Memory Across All Agents | YES |
| Confidence Scoring and Anti-Pattern Detection | YES |

---

### 6 — AI Service Platform: One Control Layer for Every AI You Use

KI-OS automatically routes every request to the optimal backend — whether local models via Ollama or MLX, cloud APIs through OpenRouter, Anthropic or OpenAI, or external agents and skills — based on cost, privacy requirements and output quality. A unified Service Catalog lets users enable or disable individual services such as Briefing, Research or Watch at any time, while the Control Plane provides live visibility into all connected backends.

<div align="center">
  <img src="Web/ai-service-platform.png" alt="AI Service Platform — Service Catalog, Control Plane, Model Router" width="820" />
  <br/><br/>
  <a href="https://ki-os.org/ai-service-platform.html">▶ Explore the full architecture on ki-os.org</a>
</div>

| Capability | Status |
|---|---|
| Service Catalog (enable/disable individual AI services) | ACTIVE |
| Control Plane (live backend availability: local + cloud) | ACTIVE |
| Cost, Privacy and Quality-Aware Routing | FULLY AUTOMATED |
| Local Models (Ollama/MLX) + Cloud APIs (OpenRouter, Anthropic, OpenAI) — Unified | SUPPORTED |
| Third-Party Skill Execution (sandboxed by default) | BUILT-IN |

---

## German Shepherd — Your Built-in Security Guardian

> *"The only AI OS with a security agent that learns your codebase — not just the rules."*

German Shepherd runs daily. After months of scans it builds a behavioral baseline specific to your project: what is normal for your code, which dependencies you use, which patterns are yours. Threats are caught not only by generic CVE databases, but by **deviation from your own pattern**.

| Layer | Coverage |
|---|---|
| **Code rules** (S001–S012) | Shell-injection · SQL-injection · Hardcoded secrets · eval() · Path-traversal · CORS · JWT · Rate-limiting · HTTP leaks · License bypass |
| **CVE Layer 1–4** | npm audit · OSV.dev · NVD/NIST · GitHub Advisory |
| **CVE Layer 5–6** | RSS security feeds · Gemini web search for zero-days |
| **Ampel system** | KRITISCH / HOCH / MITTEL / NIEDRIG — Telegram alerts + `--approve` autofix |

In a world where Recall is "still radioactive" and Operator leaves no audit trail — German Shepherd is the transparent, auditable security layer that runs every morning, locally, without cloud.

---

## Governance & Trust: Adaptable Compliance

> *"Governance by Design — The five building blocks: Governance Check, Privacy Mask, Memory Retrieve, Connector Call, Approval Step."*

The EU AI Act framework is natively built-in but remains fully adaptable. KI-OS allows you to self-configure Governance and Trust settings according to your specific compliance requirements. Every prompt, agent decision, and API call is filtered through your customized policy engine — including military-grade PII masking and human-in-the-loop approval gates.

### Compliance & Certifications

| Standard | Status | Details |
|---|---|---|
| **DSGVO (GDPR)** | ✅ Compliant | Data sovereignty, PII masking, audit logs, right to erasure |
| **EU AI Act** | ✅ Adaptable | Basic (Community) → High-Risk Ready Art. 9–15 (Enterprise) |
| **ISO 27001** | 🔄 In Progress | Security controls implemented, certification pending |
| **SOC 2 Type II** | 🔄 Planned | 2026 Q3 target |
| **BSI C5** | 🔄 Planned | 2026 Q4 target |

### Security Features

- ✅ **Data Sovereignty:** All data stays on your hardware (Community/Business) or explicitly contracted managed hosting (Enterprise)
- ✅ **PII Masking:** Military-grade personally identifiable information masking with reversible tokens
- ✅ **Audit Logs:** Complete NDJSON audit trail for all agent decisions and API calls
- ✅ **Access Control:** SQLite + JWT (Community), OAuth 2.0 / OIDC / SAML 2.0 (Enterprise)
- ✅ **Multi-Tenant Isolation:** Database-level isolation for Enterprise deployments
- ✅ **Encryption:** AES-256 for data at rest, TLS 1.3 for data in transit

---

## KIMBA Earpiece, Voice & Desktop Control

### 🎧 KIMBA Earpiece System (vP6–vP8)

KIMBA listens passively during meetings, whispers proactive hints via TTS (Aoede/Gemini) and detects emotions using screenshots + Gemini Vision.

**Requirements (macOS):**
```bash
brew install ffmpeg          # Audio capture + conversion
npm install -g pm2           # Process manager for auto-start
# Install BlackHole 2ch: https://existential.audio/blackhole/
# System Settings → Privacy → Screen & System Audio Recording → Terminal ✓
```

**Features:**
- ✅ **VAD:** Whisper detection (-40 to -25 dBFS), speech segmentation
- ✅ **STT:** OpenAI Whisper for transcription
- ✅ **Opinion Engine:** Silent trigger word `hmmm` → KIMBA analyzes the meeting and whispers its opinion back (max. 12 words)
- ✅ **Emotion Observer:** Screenshot every 20s + on audio signal → Gemini Vision detects participants' emotional states
- ✅ **TTS:** Gemini 2.5 Flash + Aoede voice — real whispering via `Say in a very quiet whisper...` prefix
- ✅ **HARDRULE:** Audio isolation — KIMBA is never audible in the meeting channel (`OVERRIDABLE=false`)

### 🎙️ Wake Word Voice Loop (vJ3)

Say **“KIMBA”** — KIMBA listens, transcribes and answers you directly by voice.

```bash
npm run voice               # Start manually
pm2 start ecosystem.mac.config.js   # Start with KI-OS (auto-restart)
```

State machine: `IDLE → WAKE_CHECK → RECORDING → TRANSCRIBING → KIMBA responds`

### 🖥️ Desktop Control (vD3)

```bash
# macOS: enable Screen Recording permission
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
# Add Terminal → toggle on
```

- ✅ macOS Swift helper (compiles automatically via `xcrun swiftc`)
- ✅ Windows PowerShell adapter
- ✅ Screenshot, mouse, keyboard, app launch, clipboard
- ✅ `DESKTOP_CONTROL_ENABLED=true` in `.env` to enable

---

## Skills System, Energy-VAD Voice & Mobile App

### 🔧 KIMBA Skills Registry (vJ3)

`*.skill.js` files in the `skills/` directory are loaded automatically at startup and can be invoked by keyword or name:

```bash
GET  /api/skills              # list all skills
POST /api/skills/invoke       # { "name": "server-info" }
POST /api/skills/invoke       # { "query": "how much RAM?" }  ← free-text routing
```

Built-in: `health-check` · `server-info` · `git-status` · `kimba-briefing`

Your own skill: create `skills/mein-skill.skill.js` with `name`, `description`, `triggers[]`, `execute()` → it is registered automatically.

### 🌐 External Skills API (vJ4)

```bash
POST /api/skills/install    { "source": "npm:@ki-os/skill-weather" }
POST /api/skills/install    { "source": "git:https://github.com/ki-os-org/skill-x" }
GET  /api/skills/installed
DELETE /api/skills/uninstall/:name
```

Security: npm allowlist (`@ki-os/skill-*`), git domain whitelist (`SKILL_GIT_DOMAINS` env), 10s timeout guard.

### 🎙️ Energy-VAD Voice Loop (vV1)

The voice loop now detects the actual end of speech instead of fixed 4s chunks.

State machine: `CAL → SIL → VOI → HLD`
- 2s calibration → dynamic baseline level + 6 dB threshold
- Min. speech length 200ms (no accidental trigger), hold-off 300ms, max 30s

```bash
node scripts/voice-loop.mjs --device 1
```

### 📸 Screenshot Capture (vD2)

```bash
node scripts/capture-screenshots.mjs --out output/screenshots/snap.png
node scripts/capture-screenshots.mjs --sequence scripts/seq.json     # sequence
node scripts/capture-screenshots.mjs --interval 3000 --count 5       # Timed
CAPTURE_DISPLAY=2 node scripts/capture-screenshots.mjs --out s2.png  # Multi-Monitor
```

### 📱 Mobile App — 9 Screens (Business/Enterprise)

All screens are now integrated into the PagerView:

`⚡ TOWER` · `◉ KIMBA` · `◈ DECK` · `▷ CMD` · `⊞ FILES` · `☰ LOG` · `◇ MEM` · `▶ DEMO` · `⚙ SYS`

Horizontal swipe navigation, BottomNav shows the label only for the active tab.

---

## Channels, Voice & AI Services

### 💬 Discord Bridge (vJ1)

KIMBA lives as a full-fledged Discord member — free-form chat, slash commands, file access, and shell execution directly from Discord.

```bash
# Slash commands (anywhere in the server)
/claude <question>     # KIMBA via Claude Code CLI
/codex  <question>     # KIMBA via OpenAI Codex
/qwen   <question>     # KIMBA via Qwen3

# Free-form chat: address @KIMBA like a team member
# Tools: read_file, run_command (shell access to the Mac)
```

Requirements: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` in `.env`.
Auto-start: LaunchAgent `org.ki-os.discord` (macOS).

### 📱 Telegram Bridge (vJ1)

```bash
!claude  <frage>    # Claude Code CLI via Telegram
!codex   <frage>    # Codex via Telegram
!qwen    <frage>    # Qwen via Telegram
```

KIMBA automatically sends a morning briefing (08:00) and an evening report (19:00) via Telegram.
Requirement: `TELEGRAM_BOT_TOKEN` in `.env`.

### 💬 WhatsApp Integration

Two channels in parallel:
- **Twilio Inbound** (`POST /api/whatsapp/inbound`) — incoming messages as mission seeds
- **Meta Cloud API** (`GET /api/whatsapp/meta/verify` + `POST /api/whatsapp/meta/inbound`) — no Twilio required

Requirements: `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` (Twilio) or `WHATSAPP_META_TOKEN`/`WHATSAPP_PHONE_ID` (Meta).

### 🎤 Voice Cloning (vVOICE-4)

KIMBA speaks in the user's voice — enroll your voice once, then all responses come back in that voice.

```bash
# CLI
kios voice-clone enroll --file my-voice.wav --user ingo
kios voice-clone say "Good morning, this is KIMBA" --play
kios voice-clone list
kios voice-clone delete --user ingo

# API
POST /api/voice-clone/enroll       { userId, audioBase64, mimeType }
POST /api/voice-clone/synthesize   { userId, text }
```

### 🌐 OpenAPI-to-MCP Bridge (vMCP-1)

Every REST API automatically becomes a KIMBA tool — submit an OpenAPI spec and it is instantly available as an MCP tool.

```bash
POST /mcp/bridge/register   { id: "my-api", spec: { openapi: "3.0", ... } }
GET  /mcp/bridge/tools      # all registered tools
POST /mcp/bridge/execute    { toolId, input }
GET  /mcp/bridge/specs      # all registered specs
DELETE /mcp/bridge/spec/:id
```

### 🏢 Agent 365 (vA365-3)

KIMBA as a Microsoft Teams/Outlook/Word team member — reachable via @mention.

```bash
POST /api/agent365/message    # Teams/Outlook webhook inbound
GET  /api/agent365/manifest   # Agent manifest for Microsoft Azure Bot
GET  /api/agent365/status
```Prerequisite: `AGENT365_WEBHOOK_SECRET` in `.env` + Azure bot registration.

### 🎵 Audio Cache & Voice Library (vA1/vA2)

- **vA1**: Semantic TTS cache — generated audio fragments are reused instead of being re-synthesized
- **vA2**: 216 MP3s across 8 KIMBA characters (synthesizer, supervisor, planner, execution, research, reviewer, memory, policy) for instant offline playback

```bash
GET  /api/audio-cache/lookup?text=...    # check cache hit
POST /api/audio-cache/store              # cache new phrase
GET  /api/audio-cache/stats              # cache statistics
```

### 🌙 KIMBA Dreaming

Every day at 03:00, KIMBA autonomously analyzes the session handoffs and swarm memory of the last 24 hours and produces a strategic night report.

```bash
POST /api/kimba/dreaming/run       # Start manually
GET  /api/kimba/dreaming/report    # retrieve last report
```

The report is stored in `.tmp/dreaming-report.json` and can be retrieved via Telegram.

### 🧠 KIMBA Intelligence (vK1)

KIMBA continuously learns Ingo's way of working and automatically injects user context into every mission.

- **UserProfile**: Role, preferences, language, working hours
- **PatternAnalyst**: Detects recurring tasks and suggests automations
- **UserContext injection**: Every model on the team knows the user context without explicit handover

```bash
kios analyze              # manually trigger FRIDAY analysis
GET /api/intelligence/profile
GET /api/intelligence/patterns
```

### 🎭 Mood-aware TTS (Earpiece)

KIMBA whispers answers in the tone of the conversational moment — not always at the same volume and matter-of-fact.

| Mood | Emotion | Example |
|------|---------|---------|
| `ALERT` | urgent | "Heads up — the client is asking about the budget" |
| `CALM` | calm | "Everything is running as planned" |
| `CURIOUS` | curious | "Interesting — that's new to me" |
| `EXCITED` | enthusiastic | "This is a breakthrough!" |

Configuration: `MOOD_INTENSITY=0.8` in `.env`.

### 🧩 Ambient Sales Intelligence (vC0)

Autonomous background sales — KIMBA continuously analyzes the CRM pipeline and initiates outreach.

```bash
kios sales pipeline           # pipeline overview
kios sales contacts           # contact list
kios sales dispatch           # send outreach

GET  /api/sales/pipeline
GET  /api/sales/contacts
POST /api/sales/contacts
POST /api/sales/dna/profile   # import KIMBA DNA
POST /api/sales/dispatch      # send outreach via channel
```

### 🖥️ VSCode Extension (IDE 1-5)

KI-OS right inside VS Code — mission tree, budget status bar, real-time streaming.

- **AgentTreeProvider**: Live view of all running agents in the sidebar
- **BudgetStatusBar**: Real-time cost display in the status bar
- **MissionWebview**: Streaming panel next to the editor
- **Efficiency report**: Multi-model vs. solo after mission completion

```bash
# Install locally (VSIX)
code --install-extension ki-os-2.0.0.vsix
```

### 🖥️ CLI — Complete Command Overview

```bash
kios meeting start            # start Earpiece meeting mode
kios meeting end              # end meeting
kios meeting status           # meeting status + emotions
kios voice-clone enroll       # enroll voice
kios voice-clone say <text>   # speak in your own voice
kios analyze                  # FRIDAY pattern analysis
kios search <query>           # Web-Suche via Tavily
kios plan <goal>              # create Ghost plan
kios sales pipeline           # CRM-Pipeline
kios skill list               # show skill registry
kios ghost <plan>             # start Ghost Control
kios efficiency               # efficiency report
```---

## ClawHub, Channel Parity, SkillForge & Timeline *(v1.23.0)*

### 🔥 ClawHub Compatibility Layer

Imports skills in the OpenClaw format (SKILL.md with frontmatter or openclaw.plugin.json). Before installation and execution, a security scan and permission risk assessment (green/yellow/red) are performed. Red-rated skills are not installed. Execution takes place in a Docker sandbox with no network access, a read-only filesystem and resource limits.

```bash
kios claw scan ./mein-claw/
kios claw install ./mein-claw/
kios claw list
kios claw uninstall mein-claw
kios claw run mein-claw
```

```bash
POST /api/claws/scan
POST /api/claws/install
GET  /api/claws/list
GET  /api/claws/docker-status
POST /api/claws/run/:name
```

Security: a fresh scan before every execution, sandbox with `--network=none`, `--cap-drop=ALL`, memory/CPU/PID limits.

### 💬 Channel Parity — Signal & iMessage

Extends the existing bridges with Signal (via signal-cli) and iMessage (AppleScript + macOS Messages). Both are single-user gated. Messages from unauthorized contacts are ignored.

```bash
kios channel add signal
kios channel start signal
kios channel status
kios channel send signal +49123456789 "message"
```

```bash
GET  /api/channels/status
POST /api/channels/:name/start
POST /api/channels/:name/stop
POST /api/channels/:name/send
```

### 🧠 SkillForge — Self-Learning Skills

Logs team tasks and detects recurring tool sequences. After 3 repetitions, a reusable skill is proposed. Proposals require manual approval. Optional LLM enhancement, always with a deterministic fallback.

```bash
kios skillforge scan
kios skillforge proposals
kios skillforge approve skill-proposal-123
kios skillforge reject skill-proposal-123
```

```bash
POST /api/skillforge/propose
GET  /api/skillforge/proposals
POST /api/skillforge/proposals/:id/approve
```

### 📜 Timeline — Searchable Screen History

Extends Screen Watch with a searchable history (NDJSON, optionally LanceDB). Privacy-first: the app blacklist is enabled by default. Entries can be deleted by time range.

```bash
kios timeline recent
kios timeline search "error message yesterday"
kios timeline blacklist
kios timeline delete --from 2025-04-01 --to 2025-04-02
```

```bash
GET  /api/timeline/recent
GET  /api/timeline/search
POST /api/timeline/blacklist/add
POST /api/timeline/delete-range
```---

## Agent Runtime — Hierarchical Teams, Browser Automation & Auto-Learning

**Hierarchical teams, browser automation & auto-learning**

### 🌐 Browser-Use Tool (Playwright + Firecrawl)

**Autonomous browser interaction for AI agents.**

KI-OS can now open web pages, navigate, click, enter text, take screenshots, and scrape content. Fully integrated with Firecrawl for web search and scraping.

**Features:**
- ✅ **8 browser tools:** `navigate`, `click`, `fill`, `screenshot`, `scroll`, `wait`, `scrape`, `search`
- ✅ **Security:** domain allowlist, rate limiting (10/min), timeout (30s)
- ✅ **Privacy:** audit redaction for sensitive data
- ✅ **Firecrawl integration:** web scraping and web search
- ✅ **Graceful shutdown:** cleanup hooks on server stop

**Use cases:**
- Competitive analysis (scraping prices)
- Form filling (automated sign-ups)
- Screenshot documentation (compliance)
- Web research (beyond simple search)

```bash
# Installation
npm install playwright
npx playwright install chromium

# .env (optional, for scraping)
FIRECRAWL_API_KEY=fc_xxx
```

---

### 🧠 Reflection Engine (Auto-Optimization)

**Automatic self-optimization after every agent run.**

KI-OS now automatically evaluates every run and generates learnings for future tasks. The system continuously learns and gets better with every execution.

**Features:**
- ✅ **Scorecard:** quality (0.4), cost (0.2), latency (0.2), tool choice (0.2)
- ✅ **LLM-based reflection:** "What went well? What went badly? Do better next time!"
- ✅ **Swarm Memory integration:** learnings stored automatically
- ✅ **API endpoints:** `/api/reflection/evaluate`, `/api/reflection/learnings`, `/api/reflection/stats`
- ✅ **AgentMesh integration:** automatically after every run

**Learning format:**
```json
{
  "whatWorked": ["Web search was precise", "Memory recall was relevant"],
  "whatFailed": ["Provider choice too expensive"],
  "nextTime": ["Use Qwen for similar tasks"],
  "savedCosts": 0.50,
  "improvedLatency": 2000
}
```

---

### 👥 Hierarchical Agents (Manager/Worker/Specialist)

**Team-based agent architecture for complex tasks.**

Instead of individual agents, an entire team now works together: the manager plans and delegates, workers execute, and specialists contribute domain expertise.

**Roles:**
- ✅ **MANAGER:** receives the task, plans subtasks, delegates, synthesizes the result
- ✅ **WORKER:** executes generic tasks (cheap, fast)
- ✅ **SPECIALIST:** domain expert (research, coding, writing, review)

**Bidding system:**
- Workers bid on tasks (cost vs. quality)
- The Economic Router decides based on score
- The winner takes the task

**API:**
```bash
POST /api/hierarchical/run      # start run
GET  /api/hierarchical/teams    # available teams
GET  /api/hierarchical/stats    # team statistics
```

**Use cases:**
- Creating a marketing plan (researcher + writer + reviewer)
- Code review (coder + reviewer + tester)
- Data analysis (analyst + visualizer + presenter)

---

## Edition Overview

KI-OS comes in three editions — each built on the same codebase, differentiated by scale, deployment, and compliance requirements.

### Community — Free & Open Source
**For developers, researchers, and individual builders.**

Local deployment only. Full AI operating system capabilities on your own hardware. **No data ever leaves your machine.** Licensed under AGPL-3.0.

> *"Build on the same runtime that powers enterprise deployments — without cost, without limits on what you create."*

### Business — Team Scale *(coming v2.0)*
**For teams and growing organizations.**

You run **your own** central KI-OS server — on-premise or in your own cloud. Team members connect to it. **All data stays in your infrastructure.** We provide the software and a license key. Nothing else.

The license key is validated periodically against `license.ki-os.org` — only the key is checked, never your data, never your agents, never your memory.

> *"Same data sovereignty promise. Now for your whole team. Your server. Your data. Our software."*

### Enterprise — Compliance-Ready *(coming v2.0)*
**For regulated industries and large organizations.**

Like Business — self-hosted by default. Optionally: managed hosting by KI-OS (explicitly contracted, EU data residency). OAuth 2.0 / OIDC / SAML 2.0, Multi-Tenant isolation, EU AI Act High-Risk compliance (Art. 9–15), dedicated SLA and support.

> *"Governance by design. Compliance out of the box. Your data — wherever you need it."*

---

## Edition Matrix

**Alle Editionen basieren auf dem gleichen Codebase — unterscheiden sich durch Skalierung, Deployment und Compliance.**

| Capability | Community | Business | Enterprise |
| :--- | :---: | :---: | :---: |
| **Core Runtime** | | | |
| Multi-Model Dynamic Routing | ✅ | ✅ | ✅ |
| Create Agents | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| Concurrent Agent Runs | 3 (local HW) | Unlimited | Unlimited Swarms |
| One Voice Agent (Multi-Model Routing) | ✅ | ✅ | ✅ |
| AgentMesh Multi-Agent Orchestration | ✅ | ✅ | ✅ |
| Ghost Control (Browser Automation) | ✅ | ✅ | ✅ Full |
| A2A Protocol (Agent-to-Agent) | ✅ | ✅ | ✅ + Enterprise Hub |
| **Browser-Use Tool** | | | |
| Browser Automation (Playwright) | ✅ 8 Tools | ✅ 8 Tools | ✅ 8 Tools + Advanced |
| Web Scraping (Firecrawl) | ✅ Basic | ✅ Standard | ✅ Premium |
| Domain Allowlist + Rate-Limit | ✅ | ✅ | ✅ + Custom Rules |
| **Hierarchical Agents** | | | |
| Manager/Worker/Specialist Roles | ✅ | ✅ | ✅ + Custom Roles |
| Bidding-System | ✅ Basic | ✅ Standard | ✅ + Priority Bidding |
| Economic Router | ✅ | ✅ | ✅ + Custom Policies |
| **Reflection-Engine** | | | |
| Auto-Optimization per Run | ✅ | ✅ | ✅ + Fleet Learning |
| Scorecard (Quality/Cost/Latency) | ✅ | ✅ | ✅ + Custom Metrics |
| Swarm Memory Integration | ✅ local | ✅ shared | ✅ fleet-wide |
| **Memory & Learning** | | | |
| Swarm Memory (LanceDB, ACO Decay) | ✅ local | ✅ shared | ✅ fleet-wide |
| Memory Sharing API | ✅ | ✅ | ✅ |
| Learned Routing (Outcome Scorecard) | ✅ local | ✅ team | ✅ fleet |
| **Agent Operations** | | | |
| Dynamic Roles + Capability Discovery | ✅ | ✅ | ✅ |
| Structured Handoff Protocol | ✅ JSON | ✅ +UI Viewer | ✅ +Approval Workflow |
| **Galaxy Connectors** | | | |
| Galaxy Connectors (Basic) | ✅ 10+ | ✅ 20+ | ✅ 30+ |
| Native Enterprise AI Connectors | ❌ | ❌ | ✅ (SAP Joule, Salesforce Agentforce) |
| ERP Connectors (SAP S/4HANA, Oracle) | ❌ | ❌ | ✅ |
| CRM Connectors (Salesforce, HubSpot) | ❌ | ✅ Selectable | ✅ Full |
| Collaboration (Jira, Slack, Teams) | ✅ Basic | ✅ Standard | ✅ Premium |
| Automation Platforms | ✅ n8n (self-hosted) | ✅ n8n (self-hosted), Zapier, Make, Adobe Workfront, Microsoft Power Automate | ✅ n8n (self-hosted), Zapier, Make, Adobe Workfront, Microsoft Power Automate |
| Social Media (Instagram, Facebook, TikTok, LinkedIn) | ❌ | ✅ Instagram, Facebook, TikTok, LinkedIn (all features) | ✅ Instagram, Facebook, TikTok, LinkedIn (all features + Ads Manager) |
| E-Commerce Platforms | ❌ | ✅ WooCommerce, Magento, PrestaShop, Shopware | ✅ Shopify, WooCommerce, Magento, PrestaShop, Shopware |
| Payment Providers | ❌ | ✅ Stripe, PayPal, Square, Mollie, Adyen | ✅ Stripe, PayPal, Square, Mollie, Adyen |
| Marketing Platforms | ❌ | ✅ Mailchimp, ActiveCampaign, HubSpot, Marketo, Pardot | ✅ Mailchimp, ActiveCampaign, HubSpot, Marketo, Pardot |
| ERP Systems | ❌ | ✅ SAP, Oracle NetSuite | ✅ SAP, Oracle NetSuite |
| CRM Systems | ❌ | ✅ HubSpot CRM, Pipedrive, Salesforce, Zoho, Microsoft Dynamics | ✅ HubSpot CRM, Pipedrive, Salesforce, Zoho, Microsoft Dynamics |
| PIM/DAM Systems | ❌ | ✅ Akeneo, Pimcore, Bynder | ✅ Akeneo, Pimcore, Bynder |
| Analytics Platforms | ❌ | ✅ Google Analytics, BigQuery, Snowflake, Adobe Analytics | ✅ Google Analytics, BigQuery, Snowflake, Adobe Analytics |

> **✓ Integration Methods:** All platforms support API integration OR webhook triggers. Social Media platforms require respective API access tokens (Meta Developer, TikTok API, LinkedIn API). n8n is self-hosted in Community Edition.

---

## **Governance & Compliance**

| Capability | Community | Business | Enterprise |
|------------|-----------|----------|------------|
| Governance Module (Policy Packs) | Community pack | Custom YAML | Custom YAML + Audit |
| Risk Tiers (LOW/MEDIUM/HIGH/CRITICAL) | ✅ | ✅ | ✅ |
| Audit Events (NDJSON) | ✅ local | ✅ persistent | ✅ exportable |
| EU AI Act Compliance | Basic | Adaptable | High-Risk (Art. 9–15) |
| PII Masking | Basic | ✅ Pro | ✅ Military-Grade |
| **Data & Sovereignty** | | | |
| Data stays on your hardware | ✅ always | ✅ always | ✅ always |
| Optional managed hosting | ❌ | ❌ | ✅ explicitly contracted |
| License key validation | ❌ No key needed | ✅ key only | ✅ key only |
| **Auth & Deployment** | | | |
| Auth (SQLite + JWT) | ✅ | ✅ | ✅ |
| OAuth 2.0 / OIDC / SAML 2.0 | ❌ | ❌ | ✅ |
| Multi-Tenant Isolation | ❌ | ❌ | ✅ |
| Deployment | Local | Self-hosted | Self-hosted/managed |
| **SDK & Tooling** | | | |
| Python SDK (`pip install kios`) | ⚠️ Eingefroren, kein aktiver Support | ⚠️ Eingefroren | ⚠️ Eingefroren |
| Mobile App (React Native) | ❌ | ✅ Commercial | ✅ Commercial |
| C-Deck Command Cockpit | ✅ | ✅ | ✅ |

---

## 📸 Feature Screenshots & Demos

### 🌐 Browser-Use Tool

**Screenshots:**
- [Browser Navigation Demo](Web/browser-navigate.png) *(coming)*
- [Web Scraping Example](Web/browser-scrape.png) *(coming)*

**Live Demo:** [https://ki-os.org/browser-demo.html](https://ki-os.org) *(coming)*

---

### 🧠 Reflection-Engine

**Screenshots:**
- [Scorecard Dashboard](Web/reflection-scorecard.png) *(coming)*
- [Learning Timeline](Web/reflection-learnings.png) *(coming)*

**API Example:**
```bash
curl -X POST http://localhost:3000/api/reflection/evaluate \
  -H "Content-Type: application/json" \
  -d '{"runId": "xxx", "task": "...", "output": "..."}'
```

---

### 👥 Hierarchical Agents

**Screenshots:**
- [Team Structure](Web/hierarchical-team.png) *(coming)*
- [Bidding System](Web/hierarchical-bidding.png) *(coming)*

**Live Demo:** [https://ki-os.org/hierarchical-demo.html](https://ki-os.org) *(coming)*

---

## Installation

**Requirements:** Node.js 22 LTS · **NO API KEY REQUIRED** for Community Edition

> **Node.js is installed automatically** by the setup scripts if not present.
> **Community Edition runs completely locally without any API keys.** Add keys for cloud models when ready.

### Windows (Recommended)

```
1. Download ZIP from https://github.com/KI-OS-org/ki-os/releases/latest
2. Extract → double-click setup.bat    (installs Node.js + dependencies)
3. Double-click START-community.bat    (starts KI-OS → http://localhost:3000)
```

### Linux / macOS

```bash
# 1. Download & extract or clone
git clone https://github.com/KI-OS-org/ki-os.git
cd ki-os/dist/community

# 2. Run setup (installs Node.js 22 if missing, installs dependencies)
bash setup.sh

# 3. Start
bash KI-OS-Community.sh
# → http://localhost:3000
```

### Configure API Keys (Optional)

Add at least one provider key to `.env` (copy from `.env.example`):

```env
ANTHROPIC_API_KEY=sk-ant-...      # Anthropic Claude
OPENAI_API_KEY=sk-...             # OpenAI GPT / o1
OPENROUTER_API_KEY=sk-or-...      # 600+ models, single key
GEMINI_API_KEY=AIza...            # Google Gemini
```

> **Tip:** [OpenRouter](https://openrouter.ai) gives you Claude, GPT, Gemini, DeepSeek, Qwen and 600+ models with a single API key — ideal for getting started.

---

### Docker

```bash
cp .env.example .env   # add your API keys
docker compose up -d
# → http://localhost:3000
```

Full `docker-compose.yml` included — production-grade with health checks, persistent volume, and auto-restart:

```yaml
services:
  ki-os:
    image: ghcr.io/ki-os-org/ki-os:latest
    ports: ["3000:3000"]
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - KI_OS_EDITION=community
    volumes:
      - ki-os-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      retries: 3
```

---

### Troubleshooting

| Problem | Solution |
|---|---|
| Port already in use | `START-community.bat` kills existing processes automatically |
| No API key set | **Community runs without keys!** Add keys for cloud models only |
| Node version error | Run `setup.bat` / `setup.sh` — auto-installs Node.js 22 LTS |
| `npm install` fails | Delete `node_modules/` and retry |
| UI doesn't load | Check that port 3000 is not blocked by firewall |

---

## API Reference

Base URL: `http://localhost:3000` · All responses: `application/json` · Every response includes `x-trace-id`

### System

```bash
GET  /health     # System health — runtime, memory, connectors, supervisor
GET  /ready      # Readiness probe (200 = ready)
GET  /status     # Full observability snapshot
GET  /metrics    # Runtime metrics — requests, tokens, latency
```

```bash
curl http://localhost:3000/health
# → { "status": "ok", "edition": "community", "checks": { "runtime": {...}, "connectors": { "total": 23 } } }
```

### Chat

```bash
POST /chat
```
```json
{ "message": "Summarize the Q1 sales report", "conversationId": "session-42" }
```
```json
{ "success": true, "reply": "...", "model": "claude-sonnet-4-5", "provider": "anthropic", "tokens": { "input": 18, "output": 94 } }
```

### AgentMesh — Multi-Agent Runs

```bash
POST   /api/agentmesh/runs          # Start a multi-agent run (Community: 3 concurrent / local HW)
GET    /api/agentmesh/runs          # List all runs
GET    /api/agentmesh/runs/:runId   # Get run status + step log
DELETE /api/agentmesh/runs/:runId   # Cancel run
```

### Handoff

```bash
GET    /api/handoff/:runId          # Structured handoff object for a run
```

### Dynamic Roles

```bash
GET    /api/roles                   # List all agent roles + capabilities
GET    /api/roles/:name             # Get specific role
POST   /api/roles/recommend         # Get recommended roles for a task description
```

### Governance

```bash
GET    /api/governance/status       # Current governance status (edition, policy pack)
GET    /api/governance/policy       # Active policy pack (allowed tools, cost limits)
POST   /api/governance/audit        # Write audit event
```

### Learned Routing

```bash
GET    /api/scorecard               # Outcome scorecard per provider/task type
POST   /api/scorecard/record        # Record a run outcome
GET    /api/scorecard/recommend     # Get routing recommendation for task + budget
```

### Autonomous Feature Intelligence

```bash
POST   /api/intelligence/scan                  # Scan AI sources for new features
GET    /api/intelligence/proposals             # List sprint proposals
PATCH  /api/intelligence/proposals/:id         # Update proposal status (pending → approved)
```

### License

```bash
GET    /api/license/status    # Current tier (community / business), limits, validUntil
POST   /api/license/refresh   # Trigger online validation against license.ki-os.org
```

```bash
curl -X POST http://localhost:3000/agentmesh/runs \
  -H "Content-Type: application/json" \
  -d '{ "task": "Research competitors and write a report", "agentIds": ["researcher","writer"], "maxParallel": 3 }'
```

### Memory (Vector Search)

```bash
POST /memory          # Store a fact
POST /memory/search   # Semantic search across all stored memory
GET  /memory/:key     # Retrieve specific entry
DELETE /memory/:key   # Delete entry
```

### Routing

```bash
POST /routing/resolve      # Preview which model KI-OS would select
GET  /routing/scorecards   # Live performance scores per provider
GET  /routing/decisions    # Full routing decision history
```

### Governance & Privacy

```bash
POST /governance/simulate   # Test a message against your policy engine
POST /privacy/analyze       # Detect PII in text
POST /privacy/mask          # Replace PII with tokens
POST /privacy/demask        # Restore original values
```

### Error Format

```json
{ "success": false, "error": "enterprise_only", "message": "This feature requires Enterprise Edition" }
```

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request |
| 403 | Enterprise only |
| 429 | Rate limited |
| 503 | Service down — check `/health` |

Full API reference: [docs/COMMUNITY_API.md](docs/COMMUNITY_API.md)

---

## Operator Guide

### Health & Monitoring

```bash
# Health check
curl http://localhost:3000/health

# Full status snapshot
curl http://localhost:3000/status

# Runtime metrics
curl http://localhost:3000/metrics
```

### Authentication

All API endpoints require identity headers:

```bash
# User role
curl -H "x-user-id: alice" -H "x-role: user" http://localhost:3000/chat

# Admin role
curl -H "x-user-id: admin" -H "x-role: admin" http://localhost:3000/admin/stats
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `KI_OS_EDITION` | `community` | Edition flag |
| `NODE_ENV` | `production` | Runtime mode |
| `MEMORY_DRIVER` | `file` | `file` or `lancedb` |
| `EMBEDDING_PROVIDER` | — | `openai` for semantic search |
| `ALLOWED_ORIGINS` | `''` | CORS allow-list (comma-separated) |

### Optional: LanceDB Vector Memory

Upgrades memory from key-value to full semantic (embedding-based) vector search:

```bash
npm install @lancedb/lancedb
```

```env
MEMORY_DRIVER=lancedb
EMBEDDING_PROVIDER=openai
```

### npm Scripts

| Command | Description |
|---|---|
| `npm start` | Start KI-OS |
| `npm test` | Run full test suite (95 tests) |
| `npm run doctor` | System check — Node, dependencies, config |

---

## Architecture

KI-OS delivers absolute trust and stability through two rigorously decoupled systems:

<div align="center">
  <img src="Web/architecture.png" alt="KI-OS Architecture — Orbit Control + Core Engine" width="820" />
</div>

---

## The Book

**KI-OS: The Operating System for the AI Era** *(2nd Edition)*

The definitive architectural blueprint behind this codebase — the philosophy, the organizational transformation, and the proven framework for deploying AI at enterprise scale.

**Available worldwide: April 15, 2026** — [More Information →](https://ki-os.org/book.html)

---

## Built by Human × AI Co-Creation

KI-OS proves its own architectural claims. This entire system was engineered in a continuous, high-speed loop by **Ingo Schaffer** and **KIMBA** — the multi-model orchestrator running natively on KI-OS itself. KIMBA utilized its own Swarm Memory to build the very system it runs on.

> *Autonomous AI execution is not the future. It is the present.*

---

## Latest Community Release — v1.23.0 (July 2026)

**ClawHub-compatible skill execution, native channel parity, and the AI Service Platform** land in this release. Import third-party skills safely — every skill is security-scanned and runs sandboxed with no network access by default. Signal and iMessage join Discord, Telegram, and WhatsApp as native channels. SkillForge detects your team's recurring task patterns and proposes reusable skills. Timeline gives you a searchable, privacy-first history of what was on your screen. And the AI Service Platform ties it all together: one Service Catalog, one Control Plane, cost- and privacy-aware routing across every local and cloud backend you connect. Security: all previously open critical and high-severity dependency vulnerabilities have been resolved.

---

## 💬 Community

Questions, ideas, show-and-tell? Join us on Discord — that's where the conversation happens.

[![Discord](https://img.shields.io/badge/Discord-Join_Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/BfzqqdUy8)

For bugs and feature requests use [GitHub Issues](https://github.com/KI-OS-org/ki-os/issues).

---

<div align="center">

[Website](https://ki-os.org) · [Discord](https://discord.gg/BfzqqdUy8) · [Top 50 Use Cases](https://ki-os.org/TOP50-KI-OS.html) · [Contact Sales](mailto:enterprise@ki-os.org)

<br/>

Community Edition released under the **AGPL-3.0 License**.<br/>
Business and Enterprise components, including the React Native Mobile App, are released under a **commercial KI-OS license** only.<br/>
Copyright © 2026 Ingo Schaffer and the KI-OS Community.

</div>
