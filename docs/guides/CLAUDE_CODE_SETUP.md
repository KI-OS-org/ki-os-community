# Using Claude Code with KI-OS

This repository is optimized for AI-assisted development with [Claude Code](https://claude.ai/code).

---

## Setup

```bash
# Install Claude Code (if not already installed)
npm install -g @anthropic-ai/claude-code

# Navigate to the KI-OS directory
cd ki-os

# Start Claude Code
claude
```

---

## Project Structure for AI Navigation

```
ki-os/
  core/             ← Central HTTP router (app.js / app.community.js)
  runtime/local/    ← Express server entry point
  backend/
    services/       ← All feature services
      agent/        ← Agent definitions and registry
      agentmesh/    ← Multi-agent run orchestration
      governance/   ← Policy engine, approvals
      memory/       ← Memory adapters (file/sqlite)
      providers/    ← AI provider integrations
      routing/      ← Intelligent model routing
      connectors/   ← External system connectors
      privacy/      ← PII detection and masking
  backend/memory/   ← Memory adapter layer
  tests/            ← Test suite (88 tests)
  docs/             ← Internal documentation
  scripts/          ← Build and tooling scripts
  dist/community/   ← Built Community Edition
```

---

## Common Tasks

### Debug a failing test

```bash
# Run a specific test file
npx jest tests/your-test.test.js --verbose

# Or describe to Claude Code:
# "Test r27 is failing — help me debug it"
```

### Add a new AI provider

Providers live in `backend/services/providers/`. Each implements a standard interface.
Ask Claude Code: *"Add a new provider for [name] following the pattern in providers/"*

### Understand a service

Ask Claude Code: *"Explain how backend/services/governance/policy.engine.js works"*

### Find where a route is handled

Ask Claude Code: *"Where is POST /chat handled?"*

### Add a new API endpoint

Ask Claude Code: *"Add a GET /version endpoint to app.community.js that returns the current version"*

---

## Architecture Notes for AI Context

- **No TypeScript in backend** — all backend code is CommonJS JavaScript
- **No Express router** — routing is handled via `if (path === ...)` chains in `app.community.js`
- **Edition guard** — use `require('../edition-guard/edition.guard').isEnterprise()` for edition checks, never `process.env.KI_OS_EDITION`
- **Memory** — access via `require('../memory').createMemoryAdapter()`, not direct file I/O
- **Logging** — use `require('../services/core/logger.service')`, not `console.log`
- **Tests** — Jest, files in `tests/`, follow naming `*.test.js`

---

## CLAUDE.md

If you create a `CLAUDE.md` file in the project root, Claude Code will automatically load it as context at the start of every session. Useful for project-specific guidelines.

Example `CLAUDE.md`:
```markdown
# KI-OS Development Guidelines

- All edition checks: use isEnterprise() from edition-guard/edition.guard
- Never use the word "license" in filenames or comments
- Backend: CommonJS only, no TypeScript
- Logging: logger.service, not console.log
- Community build: node build-community.js → dist/community/
```

---

## Useful Claude Code Prompts

| Goal | Prompt |
|------|--------|
| Understand a service | "Explain how [file] works" |
| Find a bug | "This test is failing: [paste error]. Find the cause." |
| Add a feature | "Add [feature] following the pattern in [existing file]" |
| Review security | "Review [file] for security issues" |
| Write a test | "Write a Jest test for [function] in [file]" |
| Build docs | "Document the public API of [service]" |

---

*KI-OS Community Edition — [ki-os.org](https://ki-os.org)*
