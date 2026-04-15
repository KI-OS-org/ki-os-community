# KI-OS Community Edition — Startup Guide

**Version:** 1.5.0  
**Updated:** April 2026

---

## Quick Start

### Windows

```bat
start-community.bat
```

### Linux / Mac

```bash
chmod +x start-community.sh
./start-community.sh
```

### Cross-platform (Node.js)

```bash
node start-community.js
```

---

## What the Startup Script Does

### 1. Check Node.js Version
- Verifies Node.js ≥ v20 is installed
- Exits with error message if version is too old

### 2. Stop Running Processes
- Checks for processes on ports 8080 and 3000
- Gracefully terminates old KI-OS instances (SIGTERM, then SIGKILL)

### 3. Install Dependencies
- Checks if `node_modules` are complete
- Runs `npm install` only when needed

### 4. Validate Environment
- Creates `.env` from `.env.example` if not present
- Warns if no API keys are configured

### 5. Start Server
- Starts `runtime/local/server.js`
- Sets environment variables (`KI_OS_EDITION=community`, `PORT=8080`)
- Displays startup banner with license info

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Port for Community Edition |
| `KI_OS_EDITION` | `community` | Edition (community/enterprise) |
| `NODE_ENV` | `production` | Environment (development/production) |
| `ALLOWED_ORIGINS` | `''` | CORS allowed origins (comma-separated) |

### Minimal .env

```env
KI_OS_EDITION=community
NODE_ENV=production
PORT=8080

# At least one AI provider:
ANTHROPIC_API_KEY=sk-ant-...
# OR:
OPENAI_API_KEY=sk-...
```

---

## Security Features

### CORS Protection
- Only `localhost` and `127.0.0.1` allowed by default
- Explicit allow-list via `ALLOWED_ORIGINS`

### Authentication
- All API endpoints require auth headers
- Role-based Access Control (RBAC)

```bash
# User role
curl -H "x-user-id: my-user" -H "x-role: user" http://localhost:8080/v1/chat

# Admin role
curl -H "x-user-id: admin" -H "x-role: admin" http://localhost:8080/tenants
```

---

## Troubleshooting

### Node.js not found
```bash
node --version   # must be v20+
# Download: https://nodejs.org/
```

### Port 8080 in use
```bash
# Windows
netstat -ano | findstr :8080
taskkill /F /PID <PID>

# Linux/Mac
lsof -i :8080
kill -9 <PID>
```

### Missing dependencies
```bash
npm install --no-audit --no-fund
```

### No API key configured
```bash
# Edit .env and add your key:
ANTHROPIC_API_KEY=sk-ant-...
```

### Server won't start
```bash
NODE_ENV=development node runtime/local/server.js
```

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start KI-OS |
| `npm run start:community` | Start Community Edition explicitly |
| `npm test` | Run test suite |
| `npm run doctor` | System check (Node, dependencies, config) |

---

## After Startup

```bash
# Health check
curl http://localhost:8080/health

# First API call
curl -X POST http://localhost:8080/v1/chat \
  -H "x-user-id: test" -H "x-role: user" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello KI-OS!"}'

# Open frontend
open http://localhost:8080
```

---

**Support:** enterprise@ki-os.org  
**Website:** https://ki-os.org
