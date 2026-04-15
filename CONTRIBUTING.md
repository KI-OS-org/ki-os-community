# Contributing to KI-OS

Thank you for your interest in contributing to KI-OS Community Edition!

---

## Ways to Contribute

| Type | Examples |
|------|---------|
| **Bug Reports** | Unexpected errors, incorrect behavior, broken UI |
| **Feature Requests** | New connector adapters, memory drivers, providers |
| **Code** | Bug fixes, new adapters, improvements |
| **Documentation** | Corrections, examples, translations |
| **Testing** | Test coverage for edge cases, new environments |

---

## Before You Start

- Read the [START.md](START.md) to understand the project structure
- Check [existing issues](https://github.com/KI-OS-org/ki-os/issues) — avoid duplicates
- For large changes, open an issue first to discuss direction

---

## Development Setup

```bash
git clone https://github.com/KI-OS-org/ki-os.git
cd ki-os
npm install

# Copy environment example
cp .env.example .env
# Add at least one AI provider key

# Run backend
node runtime/local/server.js

# Run tests
npm test
```

**Requirements:** Node.js 20+ · npm 9+

---

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b fix/your-description`
3. Make your changes — keep PRs focused (one concern per PR)
4. Run tests: `npm test`
5. Check that your code doesn't introduce linting errors
6. Submit PR against `main`

### PR Checklist

```
[ ] Tests pass (npm test)
[ ] No new console.log left in production code
[ ] No hardcoded API keys or secrets
[ ] New features have at least one test
[ ] Documentation updated if behavior changed
```

---

## Code Style

- **Language:** JavaScript (Node.js) — no TypeScript in backend
- **Modules:** CommonJS (`require` / `module.exports`)
- **Indentation:** 2 spaces
- **Strings:** single quotes
- **Async:** async/await preferred over callbacks
- **Error handling:** fail fast, throw specific errors

---

## What We Don't Accept

- Enterprise features reimplemented in Community (violates project architecture)
- Dependencies with GPL/LGPL licenses (AGPL-3.0 project — check compatibility)
- Breaking changes to existing API without discussion
- Code that calls external services without explicit user configuration

---

## Reporting Bugs

Please include:
- KI-OS version (`npm run version` or from `package.json`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs. actual behavior
- Relevant log output (remove any API keys before posting)

Open a report: [GitHub Issues](https://github.com/KI-OS-org/ki-os/issues)

---

## Questions?

- GitHub Issues for bugs and features
- [ki-os.org](https://ki-os.org) for general information
- [enterprise@ki-os.org](mailto:enterprise@ki-os.org) for commercial inquiries

---

*KI-OS Community Edition — AGPL-3.0 — [ki-os.org](https://ki-os.org)*
