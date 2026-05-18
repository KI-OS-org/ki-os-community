# 🤖 Using KI-OS with AI Assistants

This repository is optimized for **AI-assisted development**. Here's how to get the most out of KI-OS with your AI coding assistant.

---

## 🧠 Supported AI Assistants

| Assistant | Integration Level | Setup |
|-----------|------------------|-------|
| **Claude Code** | ✅ Full support | See below |
| **GitHub Copilot** | ✅ Code completion | Built-in |
| **Cursor** | ✅ Full IDE | Built-in |
| **Continue.dev** | ✅ VS Code extension | Built-in |

---

## 🎯 Claude Code Setup

### Prerequisites

- [Claude Code CLI](https://claude.ai/code) installed
- Anthropic API key or Claude Pro subscription
- Node.js 20+

### Installation

```bash
# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Login with your API key
claude --login
```

### Using Claude Code with KI-OS

#### 1. Clone the Repository

```bash
git clone https://github.com/KI-OS-org/ki-os.git
cd ki-os/dist/community
```

#### 2. Start Claude Code

```bash
# Open Claude Code in the project directory
claude
```

#### 3. Common Commands

```bash
# Get project overview
claude "Explain the KI-OS architecture"

# Analyze an issue
claude "/issue 42"

# Implement a feature
claude "Add a new endpoint for /api/stats"

# Debug a problem
claude "/debug backend/services/agentmesh/agentmesh.service.js"

# Run tests
claude "Run the test suite and fix any failures"

# Generate documentation
claude "Document the routing engine"
```

### Custom Slash Commands

Add these to your `~/.claude/settings.json`:

```json
{
  "customCommands": {
    "ki-os:start": "npm start",
    "ki-os:test": "npm test",
    "ki-os:doctor": "npm run doctor",
    "ki-os:deploy": "npm run deploy"
  }
}
```

Then use:
```bash
claude "/ki-os:start"
```

---

## 📋 Best Practices

### 1. **Give Context**

❌ Bad:
```
Fix the bug
```

✅ Good:
```
The /v1/chat endpoint returns 500 when using Gemini provider with large payloads. 
Check backend/services/providers/gemini.provider.js and fix the issue.
```

### 2. **Use File Paths**

❌ Bad:
```
Update the chat controller
```

✅ Good:
```
Update backend/services/chat.controller.js to add rate limiting
```

### 3. **Specify Tests**

❌ Bad:
```
Add tests for this
```

✅ Good:
```
Add unit tests in tests/unit/chat.controller.test.js covering:
- Success case with valid message
- Error case with missing message
- Error case with invalid provider
```

### 4. **Review Before Committing**

Always review AI-generated code before committing:
```bash
# See what changed
git diff

# Run tests
npm test

# If all good, commit
git add .
git commit -m "feat: add rate limiting to chat endpoint"
```

---

## 🔧 GitHub Copilot

### Setup

GitHub Copilot works out-of-the-box with this repository:

1. Install [GitHub Copilot](https://github.com/features/copilot) extension
2. Sign in with GitHub
3. Start coding

### Best Use Cases

- **Code completion** — Write functions, classes, methods
- **Documentation** — Generate JSDoc comments
- **Tests** — Auto-generate test cases
- **Refactoring** — Suggest improvements

### Example Prompts (in comments)

```javascript
// TODO: Add rate limiting to prevent abuse
// Rate limit: 100 requests per minute per user
function rateLimiter(req, res, next) {
  // Copilot will suggest implementation
}
```

---

## 🖥 Cursor IDE

### Setup

1. Download [Cursor](https://cursor.sh/)
2. Open the KI-OS repository
3. Enable AI features in settings

### Best Features

- **Chat with codebase** — Ask questions about any file
- **Edit with AI** — Select code → Cmd+K → Describe change
- **Generate from scratch** — Cmd+L → Describe what you want

### Example Workflow

```
1. Open core/app.js
2. Cmd+L: "Add a new route for /api/v2/chat with enhanced logging"
3. Review the generated code
4. Accept and test
```

---

## 📖 Learning from KI-OS

KI-OS is a great codebase to learn AI orchestration patterns:

### Study These Files

| File | What You'll Learn |
|------|-------------------|
| `core/app.js` | Express app structure, routing |
| `backend/services/routing/` | Multi-provider routing logic |
| `backend/services/supervisor/` | Self-healing patterns |
| `backend/services/governance/` | Policy enforcement |
| `backend/services/agentmesh/` | Multi-agent coordination |

### Ask Your AI

```
"Explain how the KIMBA routing engine works"
"Show me the flow from /v1/chat to AI provider"
"What design patterns are used in AgentMesh?"
"How does the self-healing supervisor recover from failures?"
```

---

## 🐛 Troubleshooting

### Issue: AI doesn't understand the codebase

**Solution:** Give more context
```
This is KI-OS, an AI orchestration framework. The file you're looking at 
is the main Express app that routes requests to different AI providers 
(Claude, GPT, Gemini, etc.) based on performance and availability.
```

### Issue: Generated code doesn't follow project style

**Solution:** Specify style guidelines
```
Follow the existing code style in this project:
- Use CommonJS (require/module.exports)
- Async/await for async operations
- JSDoc comments for functions
- Error-first callbacks for callbacks
```

### Issue: Tests fail after AI changes

**Solution:** Run tests and ask AI to fix
```
The tests in tests/unit/routing.service.test.js are failing:
[Paste error output]

Fix the issues while maintaining the existing test structure.
```

---

## 🎓 Advanced: Train Your Own AI

If you use a local AI model or fine-tune:

### Good Training Data

1. **Code samples** — All `.js` files in `backend/services/`
2. **Documentation** — All `.md` files in `docs/`
3. **Tests** — All `.test.js` files in `tests/`
4. **Issues & PRs** — GitHub issue discussions

### Example Prompt for Custom AI

```
You are an AI assistant specialized in KI-OS, an AI orchestration framework.
You understand:
- Multi-provider routing (Claude, GPT, Gemini, DeepSeek, Qwen)
- AgentMesh multi-agent coordination
- Governance and compliance (DSGVO, EU AI Act)
- KIMBA decision engine architecture

When users ask questions, provide code examples from the KI-OS codebase
and reference specific files and functions.
```

---

## 📞 Support

**Questions about using AI with KI-OS?**

- **GitHub Issues:** [Create an issue](https://github.com/KI-OS-org/ki-os/issues)
- **Documentation:** [ki-os.org](https://ki-os.org)
- **Email:** [info@ki-os.org](mailto:info@ki-os.org)

---

**Happy AI-assisted coding! 🦁**
