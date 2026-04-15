# KI-OS Community Rules

> Posted in Discord #rules channel (ID: 1493208582345195601)
> Visibility: all members (read-only) · Last updated: 2026-04-13

---

## 1 — Respect & Conduct

Be professional. This is an engineering community, not a forum for debates, politics, or personal attacks.

- Critique ideas, never people
- No harassment, hate speech, or discrimination of any kind
- No unsolicited DMs to other members
- English or German — both are fine

---

## 2 — Security (applies to all members)

**Default DENY. Share only what is explicitly allowed.**

The same security principles that protect the KI-OS codebase apply here.

**Never post:**
- API keys, tokens, passwords, or secrets of any kind
- `.env` file contents
- Production credentials or internal system access
- Private customer or company data

**Why:** Our GitHub push guard (`github-safe-push.js`) blocks secrets from reaching the repo.
Discord is an extension of that perimeter. One exposed key can compromise an entire system.

If you accidentally post a secret: delete it immediately and regenerate the credential.

---

## 3 — Content & Channels

Use the right channel for the right content.

- `#help` — installation and usage questions only
- `#bugs` — include KI-OS version, OS, and exact error message
- `#showcase` — your own KI-OS builds, not general AI news
- `#agent-recipes` — working configs, not untested ideas
- `#general` — everything else

**Not allowed anywhere:**
- Spam, self-promotion of unrelated products
- Foreign Discord invite links
- AI-generated content posted as your own (label it)
- Piracy, illegal content, or NSFW material

---

## 4 — Intellectual Property

- KI-OS Community Edition is AGPL-3.0 — contributions fall under this license
- Do not share proprietary code from your employer without permission
- If you share code from other projects, include the source and license
- Enterprise Edition features are not for redistribution

---

## 5 — Enforcement

Violations are handled proportionally:

1. Warning (minor or first-time violations)
2. Temporary mute
3. Permanent ban

**Security violations** (posting secrets, credentials, or internal data) result in
**immediate removal** — no warnings.

To report a violation: DM a member with the KI-OS Team role.
To report a security issue in the codebase: see `SECURITY.md` on GitHub.
