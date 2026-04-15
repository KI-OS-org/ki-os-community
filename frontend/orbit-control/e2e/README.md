# KI-OS E2E Tests (Playwright)

## Setup
```bash
cd frontend/orbit-control
npm install
npx playwright install chromium
```

## Run
```bash
# Start frontend first:
npm run dev   # Starts on port 3001

# In another terminal:
npm run e2e
```

## Config
- Base URL: http://localhost:3001 (override with E2E_BASE_URL env var)
- Auth: uses mock credentials (admin@ki-os.local / orbit-demo)
- To use real auth: set AUTH_ENABLE_MOCK=true in .env.local
