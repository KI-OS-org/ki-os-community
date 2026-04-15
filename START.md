# KI-OS Community Edition — Quick Start

**Requirements:** Node.js 20+ · at least one AI provider API key

---

## 1. Clone & Enter

```bash
git clone https://github.com/KI-OS-org/ki-os.git
cd ki-os/dist/community
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure API Keys

```bash
cp .env.example .env
```

Open `.env` and add at least one provider key:

```env
# Option A — Anthropic Claude (recommended)
ANTHROPIC_API_KEY=sk-ant-...

# Option B — OpenAI
OPENAI_API_KEY=sk-...

# Option C — OpenRouter (600+ models, single key)
OPENROUTER_API_KEY=sk-or-...

# Option D — Google Gemini
GEMINI_API_KEY=AIza...
```

> **Tip:** [OpenRouter](https://openrouter.ai) gives you access to Claude, GPT, Gemini, DeepSeek, Qwen and 600+ models with a single API key — great for getting started.

## 4. Start

**Windows:**
```
START-community.bat
```

**Linux / macOS:**
```bash
node runtime/local/server.js
```

**Or via npm:**
```bash
npm start
```

KI-OS starts at **http://localhost:3000**

> **Note:** The `start-community.*` scripts default to port **8080**. Running `node` or `npm start` directly uses port **3000** (or whatever `PORT` is set to in `.env`).

---

## Docker (Alternative)

```bash
cp .env.example .env      # add your API keys
docker compose up -d
# → http://localhost:3000
```

---

## Optional: LanceDB Vector Memory

Adds semantic (embedding-based) memory search:

```bash
npm install @lancedb/lancedb
```

Then in `.env`:
```env
MEMORY_DRIVER=lancedb
EMBEDDING_PROVIDER=openai   # optional — enables semantic search
```

Full guide: [docs/LANCEDB.md](docs/LANCEDB.md)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | `START-community.bat` kills existing processes automatically |
| No API key set | KI-OS starts in demo mode — add key to `.env` |
| Node version error | Install Node.js 20+ from [nodejs.org](https://nodejs.org) |
| `npm install` fails | Delete `node_modules/` and retry |
| UI doesn't load | Check that port 3000 (or 8080 with start scripts) is not blocked by firewall |

---

## Community Edition Limits

| Feature | Community |
|---------|-----------|
| Agents | Unlimited |
| Concurrent agent runs | 3 |
| Deployment | localhost only |
| Multi-Tenancy | Enterprise only |
| Cloud deployment (AWS/Azure/GCP) | Enterprise only |

**Enterprise inquiry:** [enterprise@ki-os.org](mailto:enterprise@ki-os.org)

---

*KI-OS Community Edition — AGPL-3.0 — [ki-os.org](https://ki-os.org)*
