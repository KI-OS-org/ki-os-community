# KI-OS Community Edition — API Reference

> Achtung: Diese Datei enthält weiterhin ältere Beispiele und ist keine alleinige Source of Truth.
> Aktueller Überblick: `docs/CURRENT_STATE.md`
> Verifizierte Runtime-Pfade: `runtime/local/server.js`, `core/app.js`, `backend/routes/*`, `frontend/orbit-control/app/api/*`

Base URL: `http://localhost:3000`  
All requests/responses: `application/json`  
Trace ID: every response includes `x-trace-id` header

---

## System

### Health Check
```
GET /health
```
Returns system health including memory, connectors, and supervisor status.

```json
{
  "status": "ok",
  "edition": "community",
  "os_level": "1.8.1",
  "checks": {
    "runtime": { "ok": true },
    "memory":  { "ok": true },
    "connectors": { "ok": true, "total": 23 },
    "supervisor": { "ok": true, "escalationCount": 0 }
  }
}
```
`status` values: `ok` · `degraded` · `down`

### Readiness
```
GET /ready
```
Returns `200` when server is ready to accept requests.

### Status Snapshot
```
GET /status
```
Full observability snapshot including request counts, latency, error rates.

### Metrics
```
GET /metrics
```
Runtime metrics for monitoring (requests, tokens, latency).

---

## Chat

### Send Message
```
POST /chat
```

```json
{
  "message": "What is the capital of France?",
  "conversationId": "optional-session-id",
  "context": {}
}
```

Response:
```json
{
  "success": true,
  "reply": "The capital of France is Paris.",
  "model": "claude-sonnet-4-5",
  "provider": "anthropic",
  "tokens": { "input": 12, "output": 8 }
}
```

### SSE Stream
```
GET /ui/stream
```
Server-Sent Events stream for real-time UI updates (agent runs, notifications, system events).

```
data: {"connected": true}
data: {"type": "agent.run.updated", "runId": "...", "status": "running"}
: heartbeat 1712345678901
```

---

## Agents

### List Agents
```
GET /agents
```

### Agent Stats
```
GET /agents/stats
```

### Get Agent
```
GET /agents/:id
```

---

## AgentMesh — Multi-Agent Runs

### Start a Run
```
POST /agentmesh/runs
```

```json
{
  "task": "Research competitors and write a summary",
  "agentIds": ["researcher", "writer"],
  "maxParallel": 3
}
```

> Community Edition: max 3 concurrent runs

### List Runs
```
GET /agentmesh/runs
```

### Get Run
```
GET /agentmesh/runs/:runId
```

### Cancel Run
```
DELETE /agentmesh/runs/:runId
```

---

## Memory

### Get Memory
```
GET /memory
GET /memory/:key
```

### Store Memory
```
POST /memory
```
```json
{ "key": "user_preference", "value": "prefers concise answers" }
```

### Delete Memory
```
DELETE /memory/:key
```

### Search Memory
```
POST /memory/search
```
```json
{ "query": "user preferences", "limit": 10 }
```

---

## Routing

### Resolve Route
```
POST /routing/resolve
```
Returns which provider/model KIMBA would select for a given message.

### Routing Profiles
```
GET /routing/profiles
```

### Routing Decisions (History)
```
GET /routing/decisions
```

### Provider Scorecards
```
GET /routing/scorecards
```

---

## Governance

### List Policies
```
GET /governance/policies
```

### Policy Registry
```
GET /governance/registry
```

### Simulate Policy
```
POST /governance/simulate
```
Tests a message against the policy engine without executing it.

---

## Privacy

### Analyze Text
```
POST /privacy/analyze
```
Detects PII (names, emails, phone numbers, etc.).

```json
{ "text": "My name is John Doe, email: john@example.com" }
```

### Mask PII
```
POST /privacy/mask
```
Returns text with PII replaced by tokens.

### Demask
```
POST /privacy/demask
```
Restores original values from masked tokens (session-scoped).

---

## Files

### Upload File
```
POST /files/upload
```
Multipart form-data. Supported: PDF, Excel, images, text.

### File Fabric (Search)
```
POST /files/fabric
```
Semantic search across uploaded files.

### List Files
```
GET /files
```

### Get File
```
GET /files/:id
```

---

## Connectors (MCP)

### MCP Capabilities
```
GET /mcp/capabilities
```

### MCP Health
```
GET /mcp/health
```

### Invoke MCP Tool
```
POST /mcp/invoke
```
```json
{
  "tool": "slack.send_message",
  "params": { "channel": "#general", "text": "Hello" }
}
```

### MCP Manifest
```
GET /mcp/manifest
```

---

## Automation

### Webhook
```
POST /automation/webhook
```
Triggers an automation workflow via incoming webhook.

---

## Media

### Process Image
```
POST /media/image
```
Vision analysis on uploaded or URL-referenced image.

### Process Video
```
POST /media/video
```

### Media Status
```
GET /media/status?jobId=...
```

---

## Self-Repair

### Status
```
GET /selfrepair
GET /selfrepair/stats
```

### Trigger Manual Repair
```
POST /selfrepair/trigger
```

---

## Notifications

```
GET  /notifications/feed
GET  /notifications/count
POST /notifications/mark-all-read
```

---

## Admin (requires admin role)

```
GET  /admin/config
POST /admin/config
GET  /admin/stats
POST /admin/reset
```

---

## Error Format

All errors follow:

```json
{
  "success": false,
  "error": "short_error_code",
  "message": "Human-readable description"
}
```

Common status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request / invalid input |
| 401 | Unauthorized |
| 403 | Enterprise only (not available in Community) |
| 429 | Rate limited |
| 500 | Internal error |
| 503 | Service down (check `/health`) |

---

## Enterprise-Only Endpoints

The following return `403 enterprise_only` in Community Edition:

- `/tenant/*` — Multi-tenancy
- `/dag/*` — DAG Execution Engine
- `/federation/*` — Cross-org data sharing
- `/state/fabric/*` — Enterprise state fabric
- `/desktop/*` — Desktop observation
- `/workspace/*` — Advanced workspace features
- `/voice/*` — Voice synthesis
- `/heygen/*` — Video avatar

**Enterprise inquiry:** [enterprise@ki-os.org](mailto:enterprise@ki-os.org)

---

*KI-OS Community Edition v1.1.0 — AGPL-3.0 — [ki-os.org](https://ki-os.org)*
