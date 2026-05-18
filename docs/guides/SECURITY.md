# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.1.x (current) | ✅ Active |
| < 1.0 | ❌ No longer supported |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

Send a private report to: **[security@ki-os.org](mailto:security@ki-os.org)**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Affected version(s)

You will receive a response within **72 hours**. We aim to release a fix within 14 days for critical issues.

We follow responsible disclosure — please give us reasonable time to address the issue before public disclosure.

---

## Scope

### In Scope

- Authentication and authorization bypass
- Remote code execution
- Path traversal / directory traversal
- Injection vulnerabilities (prompt injection, command injection)
- Sensitive data exposure (API keys, memory contents)
- CORS misconfiguration leading to data leakage
- Dependency vulnerabilities with known exploits (CVE)

### Out of Scope

- Vulnerabilities requiring physical access
- Social engineering
- Rate limiting in local/community deployments (community edition is single-user local)
- Issues in third-party AI provider APIs

---

## Security Architecture

### Community Edition

- Runs exclusively on `localhost` (127.0.0.1) — not exposed to network by default
- No external authentication system — single-user local deployment
- API keys stored in local `.env` file — never transmitted or logged
- No telemetry / phone-home — completely offline capable
- CORS restricted to localhost origins by default

### API Key Handling

- API keys are read from environment variables (`.env`)
- Never logged, never included in error responses
- Never committed to Git (`.gitignore` enforced)

### Memory & Data

- All user data stored locally (`.ki-os-memory.json` by default)
- No cloud sync, no external storage unless explicitly configured
- Memory contents never sent to external services beyond the configured AI providers

---

## Known Limitations

- Community Edition has no built-in user authentication (single-user local use)
- Running on a shared server without network restrictions is not a supported configuration
- AI provider responses are not sandboxed — prompt injection via external data sources is a known class of risk in all AI systems

---

*KI-OS Community Edition — [ki-os.org](https://ki-os.org)*
