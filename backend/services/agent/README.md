<!--
(c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
Datei: README.md
This file documents the architecture, flow, or implementation steps and serves as a reference for traceability within the KI-OS project.
-->

# 🤖 Genie Agent Layer - Documentation

## Overview

The **Genie Agent Layer** is the central agentic system for Kimba/Genie. It extends the existing multi-AI system with multi-step reasoning, tool calling, and intelligent task orchestration.

```
┌────────────────────────────────────────────────────┐
│           GENIE AGENT LAYER (Orchestrator)         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Planning   │→ │   Execution  │→ │  Tools   │ │
│  │   Engine     │  │   Engine     │  │ Registry │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
└────────────────────────────────────────────────────┘
         ↑                                    ↓
    User Query                          Final Answer
```

## Architecture

### 1. **Agent Layer** (`agent.layer.js`)

Central orchestrator with the following phases:

#### **Phase 1: Intent Recognition**
- Analyzes whether a query should be handled agentically
- Score-based system (threshold: 0.6)
- Criteria:
  - Agentic keywords (`suche`, `analysiere`, `finde`, etc.)
  - Complexity (length, sentence structure)
  - Memory requirement (references to past interactions)
  - Search requirement (current information)

#### **Phase 2: Planning**
- Breaks the query down into executable steps
- Uses GPT-4.1-mini or Claude 3.5 as planner
- Creates a structured plan with dependencies
- Validates tool availability

#### **Phase 3: Execution**
- Executes plan steps sequentially
- Tool calls with retries (max 2)
- Checkpointing after each step
- Error handling & fallback logic

#### **Phase 4: Synthesis**
- Aggregates tool results
- Generates a natural-language response
- Integrates sources & metadata

### 2. **Planning Engine** (`planning.engine.js`)

**Chain-of-Thought Planning:**

```javascript
{
  "reasoning": "User will mehrere aktuelle KI-News und diese speichern",
  "complexity": "medium",
  "steps": [
    {
      "id": "step_1",
      "description": "Suche aktuelle KI-News",
      "tool": "web_search",
      "parameters": { "query": "KI News 2025", "count": 5 },
      "depends_on": []
    },
    {
      "id": "step_2",
      "description": "Speichere wichtigste News",
      "tool": "memory_save",
      "parameters": {
        "userId": "{USER_ID}",
        "text": "{RESULT_FROM_STEP_1}"
      },
      "depends_on": ["step_1"]
    }
  ]
}
```

**Features:**
- Dependency resolution (topological sort)
- Plan validation (cyclic dependencies, tool existence)
- Plan optimization (merge redundant steps)
- Caching (5 minutes)

### 3. **Execution Engine** (`execution.engine.js`)

**Execution Flow:**

1. **Sort steps** by dependencies
2. **For each step:**
   - Prepare parameters (replace placeholders)
   - Execute tool (with timeout & retries)
   - Save checkpoint
   - Aggregate result
3. **Final aggregation** via LLM

**Features:**
- **Checkpoints**: Every step is persisted
- **Retries**: Exponential backoff (max 2 retries)
- **Timeout**: 60s per step, 2min total
- **Continue-on-Error**: Optionally continue on failure
- **Result Aggregation**: Intelligent summarization

### 4. **Tools Registry** (`tools.registry.js`)

**Available Tools:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `web_search` | Web search via Brave | `query`, `count` |
| `memory_search` | Search memory | `userId`, `query`, `limit` |
| `memory_save` | Save to memory | `userId`, `category`, `text` |
| `pki_analyze_profile` | Analyze PKI profile | `userId`, `tenantId` |
| `pki_consolidate_memory` | Consolidate memory | `userId`, `tenantId` |
| `get_system_status` | Retrieve system status | - |
| `analyze_query_intent` | Analyze query intent | `query` |

**Tool Interface:**

```javascript
{
  name: 'web_search',
  description: 'Durchsucht das Web via Brave Search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Die Suchanfrage' },
      count: { type: 'number', default: 5 }
    },
    required: ['query']
  },
  async execute({ query, count }) {
    // Tool-Logik
    return { success: true, sources: [...] };
  }
}
```

## Integration

### Chat Controller Integration

```javascript
// In backend/services/chat.controller.js

const { getAgentLayer } = require('./agent/agent.layer');

// Before the normal runner:
const agentLayer = getAgentLayer();
const agentResult = await agentLayer.processQuery(query, { userId, language });

if (agentResult.agentic && agentResult.success) {
  return {
    reply: agentResult.answer.reply,
    agentic: true,
    plan: agentResult.plan,
    stats: agentResult.stats
  };
}
// Fallback to normal runner...
```

### ENV Variables

```bash
# Enable/disable the Agent Layer
AGENT_LAYER_ENABLED=true

# Planner configuration
AGENT_PLANNER_PROVIDER=openai      # openai | anthropic
AGENT_PLANNER_MODEL=gpt-4.1-mini   # Planner model

# Synthesizer configuration
AGENT_SYNTHESIZER_PROVIDER=openai  # openai | anthropic
AGENT_SYNTHESIZER_MODEL=gpt-4.1    # Final Answer Generation
```

## Examples

### Example 1: Simple Search

**Query:** "Suche aktuelle KI-News"

**Plan:**
```json
{
  "complexity": "low",
  "steps": [
    {
      "id": "step_1",
      "tool": "web_search",
      "parameters": { "query": "aktuelle KI News 2025", "count": 5 }
    }
  ]
}
```

**Execution:**
- Tool: `web_search` → 5 sources
- Synthesis: Summary of the news

**Response:** "Hier sind die aktuellsten KI-News: [...]"

### Example 2: Multi-Step with Memory

**Query:** "Finde KI-Frameworks und speichere die besten 3 in meinem Memory"

**Plan:**
```json
{
  "complexity": "medium",
  "steps": [
    {
      "id": "step_1",
      "tool": "web_search",
      "parameters": { "query": "beste KI Frameworks 2025", "count": 10 }
    },
    {
      "id": "step_2",
      "tool": "memory_save",
      "parameters": {
        "userId": "user_123",
        "text": "{RESULT_FROM_STEP_1}"
      },
      "depends_on": ["step_1"]
    }
  ]
}
```

**Execution:**
1. `web_search` → 10 frameworks found
2. `memory_save` → Top 3 saved (parameter: result from step 1)

**Response:** "Ich habe 10 KI-Frameworks gefunden. Die besten 3 (PyTorch, TensorFlow, Hugging Face) habe ich in deinem Memory gespeichert."

### Example 3: Profile Analysis

**Query:** "Analysiere mein Profil"

**Plan:**
```json
{
  "complexity": "low",
  "steps": [
    {
      "id": "step_1",
      "tool": "pki_analyze_profile",
      "parameters": { "userId": "user_123" }
    }
  ]
}
```

**Execution:**
- Tool: `pki_analyze_profile` → interests, expertise, stats

**Response:** "Du hast 47 Interaktionen. Deine Hauptinteressen sind: KI, AWS, TypeScript. Deine Expertise-Bereiche: Programming (0.82), AI (0.75)."

## Agentic Commands

**Direct sync commands** (without job):
- "Wer bist du?" → Persona info
- "Was kannst du?" → Capabilities info

**Async commands** (with job dispatch):
- "Räume mein Gedächtnis auf" → `pki_consolidate_memory`
- "Analysiere mein Profil" → `pki_analyze_profile`
- "Durchsuche mein Memory" → `memory_search`
- "Zeige System Status" → `get_system_status`

## Performance

**Benchmarks:**

| Operation | Latency | Notes |
|-----------|---------|-------|
| Intent Recognition | ~50ms | Heuristics-based |
| Planning (GPT-4.1-mini) | ~1-3s | Cached for 5min |
| Tool Execution (web_search) | ~2-5s | Brave API |
| Tool Execution (memory_search) | ~100-500ms | DynamoDB |
| Synthesis (GPT-4.1) | ~2-4s | Final answer |
| **Total (Agentic Request)** | **~5-15s** | Depending on complexity |

**Optimizations:**
- Plan caching (same query within 5 min)
- Parallel tool execution (when no dependencies)
- Timeout management (60s per step)

## Error Handling

### Fallback Strategy

1. **Planning fails** → Regular chat flow
2. **Tool execution fails** → Retry (max 2x) → Continue or abort
3. **Synthesis fails** → Direct tool results
4. **Timeout** → Partial results + error message

### Logging

```javascript
console.error('[AgentLayer] Planning error:', error);
console.error('[ExecutionEngine] Step failed:', stepId, error);
console.error('[ToolsRegistry] Tool not found:', toolName);
```

## Monitoring

**Stats API:**

```javascript
const agentLayer = getAgentLayer();
const stats = agentLayer.getStats();

// {
//   totalRequests: 142,
//   agenticRequests: 38,
//   successfulPlans: 35,
//   failedPlans: 3,
//   agenticRate: '26.8%'
// }
```

## Extension

### Adding a New Tool

1. **Define the tool** in `tools.registry.js`:

```javascript
my_new_tool: {
  name: 'my_new_tool',
  description: 'Was das Tool macht',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string' }
    },
    required: ['param1']
  },
  async execute({ param1 }) {
    // Tool-Logik
    return { success: true, data: '...' };
  }
}
```

2. **Done!** The tool is immediately available to the planner & executor.

### Adding a New Command

In `chat.controller.js`:

```javascript
const AGENT_COMMANDS = [
  // ...existing...
  {
    trigger: 'mein neuer befehl',
    action: 'my_tool_action',
    response: 'Befehl wird ausgeführt.'
  }
];
```

## Troubleshooting

### Agent Layer is not activated

**Problem:** Query is not handled agentically

**Solution:**
- Check `AGENT_LAYER_ENABLED=true`
- Query score too low → add keywords
- Adjust intent threshold (ENV: `AGENT_AGENTIC_THRESHOLD`)

### Planning fails

**Problem:** Plan is empty or invalid

**Solution:**
- Check planner model availability (OpenAI API key)
- Check logs: `[PlanningEngine] Planning failed`
- Fallback: system uses regular chat flow

### Tool Execution Timeout

**Problem:** Tool execution takes too long

**Solution:**
- Increase timeout: `ExecutionEngine({ timeout: 120000 })`
- Check tool performance (e.g., Brave API latency)
- Use `continueOnError: true` for robust execution

## Status

✅ **v1.0 - Production Ready**

- Agent Layer Orchestrator
- Planning Engine (Multi-Step Reasoning)
- Execution Engine (Checkpoints & Retries)
- Tools Registry (7 Tools)
- Chat Controller Integration
- ENV-based configuration

## Roadmap

**v1.1 - Planned:**
- [ ] Parallel tool execution (when no dependencies)
- [ ] Advanced Tool: `api_call` (Generic REST API Caller)
- [ ] Advanced Tool: `file_read` (DynamoDB/S3 File Access)
- [ ] Plan visualization for dashboard
- [ ] Agent-to-Agent Communication (Sub-Agents)

**v2.0 - Future:**
- [ ] Proactive Agents (triggered by events)
- [ ] Long-running Jobs (>2min)
- [ ] Custom Agent Plugins (user-defined tools)
- [ ] Agent Marketplace (Tool-Sharing)

---

**Created:** 2025-01-24
**Version:** 1.0.0
**Author:** Genie Core Team
