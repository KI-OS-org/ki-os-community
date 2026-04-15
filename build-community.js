#!/usr/bin/env node
/**
 * KI-OS Community Edition — Build Script
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * =========================================================
 * Erstellt eine saubere Community-Distribution in dist/community/.
 *
 * Strategie: Enterprise-Module werden physisch NICHT kopiert — sie sind in
 * der Community-Distribution schlicht nicht vorhanden. Feature-Flags reichen
 * nicht aus, weil Code der vorhanden ist, gehackt werden kann.
 *
 * Aufruf:
 *   node build-community.js
 *   node build-community.js --dry-run    # zeigt nur, was passieren würde
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT    = __dirname;
const DEST    = path.join(ROOT, 'dist', 'community');

// ---------------------------------------------------------------------------
// Enterprise-only service folders that must NOT be in Community distribution
// ---------------------------------------------------------------------------
const ENTERPRISE_SERVICE_PATHS = [
  // Internes Tool — NIEMALS in Community-Distribution
  'scripts/generate-blauer-elefant.js',
  // Multi-Tenancy
  'backend/services/tenant',
  // Federation (cross-org data sharing)
  'backend/services/federation',
  // Economic intelligence module
  'backend/services/economic',
  // Retail & Retail Brain (enterprise vertical)
  'backend/services/retail',
  'backend/services/retail-brain',
  // Workspace advanced features
  'backend/services/workspace',
  // Pack/marketplace system
  'backend/services/packs',
  // DAG execution engine
  'backend/services/dag',
  // HeyGen video avatar integration
  'backend/services/heygen.controller.js',
  // Voice synthesis service
  'backend/services/tts.service.js',
  'backend/services/voice.service.js',
  // PKI / production certificate signing
  'backend/services/pki',
  'backend/services/pki.integration.js',
  // Verifier services
  'backend/services/verifier.service.js',
  'backend/services/verifier.v2.service.js',
  // State fabric enterprise backends
  'backend/services/state',
  // Resilience / chaos engineering
  'backend/services/resilience',
  // Desktop observation (enterprise feature)
  'backend/services/desktop',
  // Marketing campaign management
  'backend/services/campaigns',
  // Strategic capability map
  'backend/services/strategy',
  // Speech-to-Text + Voice Input (TTS/Voice already excluded)
  'backend/services/stt',
  // Edition Guard + internal tooling (script already excluded, directory too)
  'backend/services/blauer-elefant',
];

// Enterprise paths where community stubs are intentionally placed — skip leak check for these
const COMMUNITY_STUB_PATHS = new Set([
  'backend/services/pki',
  'backend/services/pki.integration.js',
  'backend/services/desktop',
  'backend/services/tenant',
  'backend/services/dag',
  'backend/services/workspace',
  'backend/services/resilience',
  'backend/services/heygen.controller.js',
  'backend/services/state',
]);

// Files/dirs to copy from source root
const COMMUNITY_PATHS = [
  'backend/services/agent',
  'backend/services/agentmesh',
  'backend/services/auth',
  'backend/services/automation.config.service.js',
  'backend/services/automation.webhook.service.js',
  'backend/services/chat.controller.js',
  'backend/services/connectors',
  'backend/services/core',
  'backend/services/demo',
  'backend/services/domain',
  'backend/services/efficiency',
  'backend/services/feedback.controller.js',
  'backend/services/files',
  'backend/services/ghost',
  'backend/services/governance',
  'backend/services/jobs.controller.js',
  'backend/services/media.controller.js',
  'backend/services/memory',
  'backend/services/memory.controller.js',
  'backend/services/mesh',
  'backend/services/notifications',
  'backend/services/privacy',
  'backend/services/providers',
  'backend/services/routing',
  'backend/services/security',
  'backend/services/selfrepair',
  'backend/services/simulations',
  'backend/services/supervisor',
  'backend/services/telemetry',
  'backend/services/trust',
  'backend/services/ui',
  'backend/services/websearch.service.js',
  'backend/services/worker.js',
  'backend/services/doc.controller.js',
  'backend/services/admin.controller.js',
  'backend/services/router.policy.js',
  'backend/memory',
  // store.backend.js is written as a stripped community stub — not copied from source

  'core',
  'runtime/local',
  'package.json',
  '.env.example',
  // Community landing page
  'Web/community.html',
  // Logo (referenced in README.md)
  'Web/logo.png',
  'Web/icon.png',
  // Licenses
  'LICENSE',
  'LICENSE-APACHE',
  'LICENSE-AGPL',
  // Public documentation
  'README.md',
  'START.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CLAUDE_CODE_SETUP.md',
  'CHANGELOG.md',
  'docs/COMMUNITY_API.md',
  'docs/ADMIN_GUIDE.md',
  'docs/LANCEDB.md',
  // Community start scripts
  'start-community.js',
  'start-community.sh',
  'ki-os.sh',
  'START-community.bat',
  'setup.bat',
  'setup.sh',
  // Additional public docs
  'STARTUP_GUIDE.md',
  'LAUNCH_GUIDE.md',
  'LINUX-MAC-START.md',
  'LAUNCH_DAY_CHECKLIST.md',
  'CODE_OF_CONDUCT.md',
  // Launcher & startup helpers
  'launcher.js',
  'start.js',
  // Container deployment
  'docker-compose.yml',
  'Dockerfile',
  // EXE packaging (Windows installer)
  'BUILD-EXE.md',
  'EXE-ANLEITUNG.md',
  'KI_CODE_SETUP.md',
  'create-exe.vbs',
  'create-icon.ps1',
  'create-macos-app.sh',
  'ki-os-setup.iss',
  'package.exe.json',
  // Docker quickstart scripts
  'start-docker.sh',
  'start-docker.bat',
  '.dockerignore',
  // Community scripts
  'scripts/budget-check.js',
  'scripts/check-community-leaks.js',
  'scripts/security-guard.js',
  'scripts/create-shortcuts.ps1',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg) { console.log(msg); }

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!DRY_RUN) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    if (!DRY_RUN) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    log(`  COPY ${src.replace(ROOT, '.')}`);
  }
}

function writeCommunityEnv(destDir) {
  const envPath = path.join(destDir, '.env');
  const content = [
    '# KI-OS Community Edition — automatisch generiert',
    '# Diese Datei NICHT in Git einchecken',
    '',
    'KI_OS_EDITION=community',
    'NODE_ENV=production',
    'PORT=3000',
    '',
    '# LLM Provider — mindestens einen setzen',
    '# ANTHROPIC_API_KEY=',
    '# OPENAI_API_KEY=',
    '',
    '# Memory',
    'MEMORY_BACKEND=file',
    '',
    '# Community Limits',
    '# Max 3 Agents (wird im Backend erzwungen, nicht hier)',
  ].join('\n');
  if (!DRY_RUN) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(envPath, content, 'utf8');
  }
  log(`  WRITE ${envPath.replace(ROOT, '.')}`);
}

// Connector profiles excluded from Community (enterprise integrations)
const ENTERPRISE_CONNECTOR_PROFILES = [
  'sap.json',
  'salesforce.json',
  'teams.json',   // M365 / Microsoft Teams
];

function removeEnterpriseConnectorProfiles(destDir) {
  const profilesDir = path.join(destDir, 'backend/services/connectors/profiles');
  if (!fs.existsSync(profilesDir)) return;
  for (const file of ENTERPRISE_CONNECTOR_PROFILES) {
    const target = path.join(profilesDir, file);
    if (!DRY_RUN && fs.existsSync(target)) fs.rmSync(target, { force: true });
    log(`  REMOVE connector profile: ${file}`);
  }
}

// Enterprise-only npm scripts to strip from community package.json
const ENTERPRISE_SCRIPTS = [
  'start:aws', 'doctor:aws', 'doctor:aws',
  'release', 'release:win', 'release:dry', 'release:skip-build',
  'rc:gate',
  'release:gate:1.0.0', 'release:gate:1.0.1', 'release:gate:1.0.2',
  'smoke:fullstack:1.0.0', 'smoke:fullstack:1.0.1', 'smoke:fullstack:1.0.2',
  'test:desktop',
  'test:frontend:1.0.0', 'test:frontend:1.0.1', 'test:frontend:1.0.2',
  'qa:preflight', 'qa:claude', 'qa:r28', 'qa:r30',
  'build:enterprise', 'deploy:aws', 'deploy:lambda',
  'build:community', 'build:community:dry',  // meta-scripts not needed in dist
  'start:stack',                              // Next.js Enterprise frontend
];

function patchPackageJson(destDir) {
  const pkgSrc = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgSrc)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgSrc, 'utf8'));
  pkg.name     = pkg.name ? `${pkg.name}-community` : 'ki-os-community';
  pkg.edition  = 'community';
  pkg.private  = true;
  // Replace start script to point to correct entry point
  if (pkg.scripts) {
    pkg.scripts['start']       = 'node runtime/local/server.js';
    pkg.scripts['start:local'] = 'node runtime/local/server.js';
    for (const s of ENTERPRISE_SCRIPTS) delete pkg.scripts[s];
  }
  // Workspaces entfernen — dist/community ist eigenständig, kein npm-workspace-Kontext.
  // Ohne diesen Delete erbt die Community-dist die workspace-Deklaration "frontend/orbit-control"
  // aus dem Enterprise-Root, was Turbopack verwirrt: es sucht das Paket bei frontend/orbit-control
  // und produziert einen Filesystem-Root-Panic beim nächsten `next dev --turbo`.
  delete pkg.workspaces;

  const dest = path.join(destDir, 'package.json');
  if (!DRY_RUN) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(pkg, null, 2), 'utf8');
  }
  log(`  PATCH package.json → edition: community, workspaces: entfernt`);
}

function writeEnterpriseStub(destDir) {
  // Create a stub module that returns 403 for any enterprise-only route hit
  const stubPath = path.join(destDir, 'backend', 'enterprise-stub.js');
  const stub = `/**
 * KI-OS Community Edition — Enterprise Feature Stub
 * Gibt 403 zurück wenn ein Enterprise-Endpunkt aufgerufen wird.
 */
'use strict';
function enterpriseOnly(featureName) {
  return {
    handleRequest: () => ({
      statusCode: 403,
      body: {
        error: 'enterprise_only',
        feature: featureName,
        message: \`"\${featureName}" ist nur in der KI-OS Enterprise Edition verfügbar. Kontakt: enterprise@ki-os.org\`,
      },
    }),
  };
}
module.exports = { enterpriseOnly };
`;
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(stubPath), { recursive: true });
    fs.writeFileSync(stubPath, stub, 'utf8');
  }
  log(`  WRITE backend/enterprise-stub.js`);
}

// ---------------------------------------------------------------------------
// Community Stubs — replace enterprise modules with safe no-op / 403 stubs
// ---------------------------------------------------------------------------
function writeStub(destDir, relPath, content) {
  const full = path.join(destDir, relPath);
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  log(`  STUB  ${relPath}`);
}

function writeStubs(destDir) {
  // PKI guard — assertProductionPki is a no-op in community
  writeStub(destDir, 'backend/services/pki/pki.runtime.guard.js', `'use strict';
/* COMMUNITY_STUB: PKI guards disabled in local community mode */
function assertProductionPki() {}
module.exports = { assertProductionPki };
`);

  // PKI integration — return local admin auth so UI works out-of-the-box
  writeStub(destDir, 'backend/services/pki.integration.js', `'use strict';
/* COMMUNITY_STUB */
class PKIIntegration {
  async extractAuth() { return { authenticated: true, userId: 'local', role: 'admin' }; }
}
module.exports = { PKIIntegration };
`);

  // Desktop service — stub returns unavailable state
  writeStub(destDir, 'backend/services/desktop/desktop.service.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function getDesktopStatus()  { return { available: false }; }
function getCompanionState() { return { available: false }; }
module.exports = { getDesktopStatus, getCompanionState };
`);

  // Desktop controller — 403 for enterprise routes
  writeStub(destDir, 'backend/services/desktop/desktop.controller.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function handleDesktopRequest() {
  return { statusCode: 403, body: { error: 'enterprise_only', feature: 'desktop' } };
}
module.exports = { handleDesktopRequest };
`);

  // Tenant service — opaque stub, no schema details
  writeStub(destDir, 'backend/services/tenant/tenant.service.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function getEffectivePolicyView() { return null; }
function getTenant()  { return null; }
function listTenants() { return []; }
module.exports = { getEffectivePolicyView, getTenant, listTenants };
`);

  // Tenant controller — 403
  writeStub(destDir, 'backend/services/tenant/tenant.controller.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function handleTenantRequest() {
  return { statusCode: 403, body: { error: 'enterprise_only', feature: 'tenant' } };
}
module.exports = { handleTenantRequest };
`);

  // DAG runtime service — opaque stub
  writeStub(destDir, 'backend/services/dag/dag.runtime.service.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function listDagDefinitions() { return []; }
function getDagRegistryInfo() { return { total: 0 }; }
module.exports = { listDagDefinitions, getDagRegistryInfo };
`);

  // DAG controller — 403
  writeStub(destDir, 'backend/services/dag/dag.controller.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function handleDagRequest() {
  return { statusCode: 403, body: { error: 'enterprise_only', feature: 'dag' } };
}
module.exports = { handleDagRequest };
`);

  // Workspace controller — 403
  writeStub(destDir, 'backend/services/workspace/workspace.controller.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function handleRequest() { return { statusCode: 403, body: { error: 'enterprise_only' } }; }
module.exports = { handleRequest };
`);

  // Resilience — circuit breaker always allows in community
  writeStub(destDir, 'backend/services/resilience/circuit-breaker.service.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function canExecute() { return true; }
function recordFailure() {}
function recordSuccess() {}
module.exports = { canExecute, recordFailure, recordSuccess };
`);

  // Resilience — dead letter queue silent in community
  writeStub(destDir, 'backend/services/resilience/dlq.service.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function enqueueDeadLetter() {}
module.exports = { enqueueDeadLetter };
`);

  // store.backend.js — file-mode only; DynamoDB and emulation layers stripped
  writeStub(destDir, 'backend/services/state/store.backend.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
const fs   = require('fs');
const path = require('path');

function createStoreBackend(options = {}) {
  const envKey  = options.filePathEnvKey || '';
  const envVal  = envKey ? process.env[envKey] : '';
  const filePath = envVal || path.join(process.cwd(), options.defaultFileName || '.ki-os-store.json');

  function read() {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return options.defaultValueFactory ? options.defaultValueFactory() : {}; }
  }

  function write(value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = filePath + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
    return value;
  }

  function remove() {
    try { fs.rmSync(filePath, { force: true }); } catch {}
    return true;
  }

  function info() { return { kind: 'file', path: filePath }; }

  return { read, write, remove, info };
}

module.exports = { createStoreBackend };
`);

  // State fabric controller — 403
  writeStub(destDir, 'backend/services/state/state.fabric.controller.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function handleStateFabricRequest() {
  return { statusCode: 403, body: { error: 'enterprise_only', feature: 'state_fabric' } };
}
module.exports = { handleStateFabricRequest };
`);

  // HeyGen controller — 403
  writeStub(destDir, 'backend/services/heygen.controller.js', `'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
function handleHeygenSpeak() {
  return { success: false, error: 'enterprise_only', message: 'HeyGen ist nur in der Enterprise Edition verfügbar.' };
}
module.exports = { handleHeygenSpeak };
`);
}

// ---------------------------------------------------------------------------
// Copyright headers — Apache 2.0 for Core, AGPL-3.0 for Strategic Components
// ---------------------------------------------------------------------------

const HEADER_APACHE = `/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
`;

const HEADER_AGPL = `/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
`;

// Directories/files that get Apache 2.0 (infrastructure, adapters, utilities)
const APACHE_PATHS = [
  'backend/services/core',
  'backend/services/memory',
  'backend/services/connectors',
  'backend/services/providers',
  'backend/services/routing',
  'backend/services/files',
  'backend/services/security',
  'backend/services/domain',
  'backend/services/mesh',
  'backend/memory',
];

function getHeaderFor(relPath) {
  // Normalize to forward slashes for comparison
  const norm = relPath.replace(/\\/g, '/');
  for (const ap of APACHE_PATHS) {
    if (norm.startsWith(ap + '/') || norm === ap) return HEADER_APACHE;
  }
  return HEADER_AGPL;  // Strategic components: AGPL by default
}

function addCopyrightHeaders(destDir) {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'Web']);
  let apacheCount = 0;
  let agplCount   = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full    = path.join(dir, entry);
      const stat    = fs.statSync(full);
      if (stat.isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.js')) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (src.startsWith('/**\n * KI-OS Community')) continue; // already has header
      const relPath = full.replace(destDir + path.sep, '').replace(destDir + '/', '');
      const header  = getHeaderFor(relPath);
      if (!DRY_RUN) fs.writeFileSync(full, header + src, 'utf8');
      if (header === HEADER_APACHE) apacheCount++; else agplCount++;
    }
  }

  if (!DRY_RUN) walk(destDir);
  log(`  ✓ Apache 2.0: ${apacheCount} Dateien  |  AGPL-3.0: ${agplCount} Dateien`);
}

// ---------------------------------------------------------------------------
// Community core/app.js — enterprise routes stripped, no blueprint leakage
// ---------------------------------------------------------------------------
function deployCommunityAppJs(destDir) {
  const src  = path.join(ROOT, 'core', 'app.community.js');
  const dest = path.join(destDir, 'core', 'app.js');
  if (!fs.existsSync(src)) {
    log('  ⚠ core/app.community.js nicht gefunden — übersprungen.');
    return;
  }
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  log('  DEPLOY core/app.js ← app.community.js (Enterprise-Routen entfernt)');
}

// ---------------------------------------------------------------------------
// Community Frontend — Quellcode kopieren
// ---------------------------------------------------------------------------
const FRONTEND_SRC  = 'frontend/orbit-control';
const FRONTEND_DEST = 'frontend';

// Verzeichnisse/Dateien die beim Frontend-Copy übersprungen werden
const FRONTEND_SKIP = new Set([
  'node_modules', '.next', '.git', 'storybook-static',
  'test-results', 'playwright-report',
]);

function copyFrontendSource(destDir) {
  const src  = path.join(ROOT, FRONTEND_SRC);
  const dest = path.join(destDir, FRONTEND_DEST);
  if (!fs.existsSync(src)) {
    log(`  SKIP  ${FRONTEND_SRC} (nicht vorhanden)`);
    return;
  }
  function walk(s, d) {
    const stat = fs.statSync(s);
    if (stat.isDirectory()) {
      if (!DRY_RUN) fs.mkdirSync(d, { recursive: true });
      for (const entry of fs.readdirSync(s)) {
        if (FRONTEND_SKIP.has(entry)) continue;
        walk(path.join(s, entry), path.join(d, entry));
      }
    } else {
      if (!DRY_RUN) {
        fs.mkdirSync(path.dirname(d), { recursive: true });
        fs.copyFileSync(s, d);
      }
    }
  }
  walk(src, dest);
  log(`  COPY  ${FRONTEND_SRC} → frontend/`);
}

// ---------------------------------------------------------------------------
// Community Frontend next.config.ts
// ---------------------------------------------------------------------------
function writeCommunityNextConfig(destDir) {
  const frontendDir = path.join(destDir, FRONTEND_DEST);
  if (!fs.existsSync(frontendDir)) return;

  // output: 'standalone' → Next.js bündelt alles in .next/standalone/
  // Start auf User-Systemen: node frontend/.next/standalone/server.js
  // Kein next dev, kein node_modules Fallback auf Enterprise-Root nötig.
  //
  // turbopack.root: __dirname → nur für `next dev --turbo` (lokales Debugging).
  // Verhindert Walk-up zur übergeordneten Enterprise-Root und Workspace-Konfusion
  // mit "frontend/orbit-control" → Turbopack-Panic auf Windows.
  //
  // outputFileTracingRoot weggelassen: mit diesem Setting crasht Turbopack 15.5.x
  // auf Windows (FileSystemPath("").join("../../../frontend/orbit-control") panic).
  const content = `import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Absoluter Pfad dieser Datei — unabhängig vom npm-CWD
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone-Bundle für Distribution — startet mit: node .next/standalone/server.js
  // Enthält minimales node_modules, kein separates npm install auf User-Systemen nötig.
  output: "standalone",

  turbopack: {
    // Nur für 'next dev --turbo' aktiv (Debugging). Verhindert Walk-up zur Enterprise-Root.
    root: __dirname,
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "date-fns",
      "@tanstack/react-query",
      "reactflow",
    ],
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
`;
  if (!DRY_RUN) fs.writeFileSync(path.join(frontendDir, 'next.config.ts'), content, 'utf8');
  log(`  WRITE frontend/next.config.ts (standalone + turbopack-safe)`);
}

// ---------------------------------------------------------------------------
// Community Frontend — npm install + next build + Standalone postprocess
// ---------------------------------------------------------------------------
function buildFrontendStandalone(destDir) {
  const frontendDir = path.join(destDir, FRONTEND_DEST);
  if (!fs.existsSync(frontendDir)) {
    log('  SKIP  Frontend-Build (kein frontend/ Verzeichnis)');
    return;
  }
  const { execSync } = require('child_process');

  log('  > npm install (Frontend-Abhängigkeiten)...');
  try {
    execSync('npm install --no-audit --no-fund --prefer-offline', {
      cwd: frontendDir, stdio: 'inherit',
    });
  } catch (e) {
    log('  ⚠ npm install fehlgeschlagen — manuell: cd dist/community/frontend && npm install');
    return;
  }

  log('  > next build (Standalone-Bundle)...');
  try {
    execSync('npx next build', { cwd: frontendDir, stdio: 'inherit' });
  } catch (e) {
    log('  ⚠ next build fehlgeschlagen — manuell: cd dist/community/frontend && npx next build');
    return;
  }

  // next build mit output:'standalone' erzeugt .next/standalone/
  // Pflicht: .next/static/ und public/ müssen manuell in den standalone-Ordner kopiert werden.
  const standaloneDir = path.join(frontendDir, '.next', 'standalone');
  if (fs.existsSync(standaloneDir)) {
    // .next/static/ → .next/standalone/.next/static/
    const staticSrc  = path.join(frontendDir, '.next', 'static');
    const staticDest = path.join(standaloneDir, '.next', 'static');
    if (fs.existsSync(staticSrc)) {
      copyRecursive(staticSrc, staticDest);
      log('  COPY  .next/static → .next/standalone/.next/static');
    }
    // public/ → .next/standalone/public/
    const publicSrc  = path.join(frontendDir, 'public');
    const publicDest = path.join(standaloneDir, 'public');
    if (fs.existsSync(publicSrc)) {
      copyRecursive(publicSrc, publicDest);
      log('  COPY  public/ → .next/standalone/public/');
    }
    log('  ✓ Standalone-Bundle fertig: frontend/.next/standalone/server.js');
  } else {
    log('  ⚠ .next/standalone/ nicht gefunden — next build möglicherweise fehlgeschlagen');
  }
}

// ---------------------------------------------------------------------------
// Community Start-Scripts (PS1 / bat / sh) — standalone-kompatibel
// ---------------------------------------------------------------------------
function writeCommunityStartScripts(destDir) {
  const backendPort  = 3000;
  const frontendPort = 3001;

  // ── PowerShell ─────────────────────────────────────────────────────────────
  const ps1 = `param([string]$RootDir = "")

if ($RootDir -eq "") {
  $RootDir = Split-Path -Parent $PSCommandPath
}

$BackendDir    = $RootDir
$FrontendDir   = Join-Path $RootDir "frontend"
$StandaloneJs  = Join-Path $FrontendDir ".next\\\\standalone\\\\server.js"
$BackendPort   = ${backendPort}
$FrontendPort  = ${frontendPort}

function Write-Step([string]$Icon, [string]$Text, [string]$Color = "Cyan") {
  Write-Host ("  " + $Icon + "  ") -NoNewline -ForegroundColor $Color
  Write-Host $Text
}

function Get-NodeExe {
  $candidates = @(
    "C:\\\\Program Files\\\\nodejs\\\\node.exe",
    "C:\\\\Program Files (x86)\\\\nodejs\\\\node.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  $found = where.exe node 2>$null | Where-Object { $_ -notlike "*dist\\\\community*" } | Select-Object -First 1
  if ($found) { return $found }
  return $null
}

function Test-PortOpen([int]$Port) {
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", $Port)
    $tcp.Close()
    return $true
  } catch { return $false }
}

function Wait-For-Port([int]$Port, [int]$MaxSeconds) {
  $deadline = (Get-Date).AddSeconds($MaxSeconds)
  $dots = 0
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen $Port) { Write-Host ""; return $true }
    Write-Host "." -NoNewline
    $dots++
    if ($dots % 30 -eq 0) { Write-Host "" }
    Start-Sleep -Seconds 1
  }
  Write-Host ""
  return $false
}

function Kill-Port([int]$Port) {
  $pids = netstat -ano 2>$null | Select-String ":$Port\\\\s" |
    ForEach-Object { ($_ -split '\\\\s+')[-1] } |
    Where-Object { $_ -match '^\\\\d+$' } | Sort-Object -Unique
  foreach ($p in $pids) {
    try { Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue } catch {}
  }
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkCyan
Write-Host "         KI-OS Community Edition                              " -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor DarkCyan
Write-Host ""

$NodeExe = Get-NodeExe
if (-not $NodeExe) {
  Write-Host "  ! Node.js nicht gefunden. Bitte installieren: https://nodejs.org (v20+)" -ForegroundColor Red
  Read-Host "  Enter zum Beenden"
  exit 1
}
$nodeVer = (& $NodeExe --version 2>&1).ToString().Trim()
Write-Step "+" "Node.js $nodeVer" "Green"

if (-not (Test-Path $StandaloneJs)) {
  Write-Host ""
  Write-Host "  ! Frontend nicht gebaut. Bitte zuerst ausfuehren:" -ForegroundColor Red
  Write-Host "    cd frontend && npx next build" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Enter zum Beenden"
  exit 1
}

Write-Host ""
Write-Step ">" "Ports $BackendPort/$FrontendPort freigeben..."
Kill-Port $BackendPort
Kill-Port $FrontendPort
Start-Sleep -Seconds 1
Write-Step "+" "Ports freigegeben" "Green"
Write-Host ""

Write-Step ">" "Backend starten (Port $BackendPort)..."
$backendCmd = 'title KI-OS Backend && "' + $NodeExe + '" runtime/local/server.js'
Start-Process "cmd.exe" -ArgumentList "/k",$backendCmd -WorkingDirectory $BackendDir
Write-Host ""
Write-Step "~" "Warte auf Backend..." "Cyan"
Write-Host "  " -NoNewline
$backendOk = Wait-For-Port $BackendPort 30
if (-not $backendOk) {
  Write-Step "!" "Backend antwortet nicht auf Port $BackendPort" "Red"
  Read-Host "  Enter zum Beenden"
  exit 1
}
Write-Step "+" "Backend online: http://127.0.0.1:$BackendPort" "Green"
Write-Host ""

Write-Step ">" "Frontend starten (Port $FrontendPort)..."
$env:PORT     = "$FrontendPort"
$env:HOSTNAME = "127.0.0.1"
$frontendCmd  = 'title KI-OS Frontend && set PORT=${frontendPort}&& set HOSTNAME=127.0.0.1&& "' + $NodeExe + '" ".next\\\\standalone\\\\server.js"'
Start-Process "cmd.exe" -ArgumentList "/k",$frontendCmd -WorkingDirectory $FrontendDir
Write-Host ""
Write-Step "~" "Warte auf Frontend..." "Cyan"
Write-Host "  " -NoNewline
$frontendOk = Wait-For-Port $FrontendPort 30
if ($frontendOk) {
  Write-Step "+" "Frontend online: http://localhost:$FrontendPort" "Green"
  Start-Process "http://localhost:$FrontendPort"
} else {
  Write-Step "*" "Frontend braucht laenger - bitte Fenster pruefen." "Yellow"
  Write-Host "  URL: http://localhost:$FrontendPort" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor DarkCyan
Write-Host "  KI-OS Community laeuft!" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend  : http://127.0.0.1:$BackendPort" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Beide Fenster offen lassen solange KI-OS laufen soll." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  [Enter] zum Schliessen"
`;

  // ── Batch (ruft PS1 auf) ───────────────────────────────────────────────────
  const bat = `@echo off
setlocal
set SCRIPT_DIR=%~dp0
if "%SCRIPT_DIR:~-1%"=="\\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\\KI-OS-Community-Start.ps1" -RootDir "%SCRIPT_DIR%"
endlocal
`;

  // ── Shell (Linux / macOS) ──────────────────────────────────────────────────
  const sh = `#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=${backendPort}
FRONTEND_PORT=${frontendPort}
STANDALONE="$SCRIPT_DIR/frontend/.next/standalone/server.js"

echo ""
echo "  KI-OS Community Edition"
echo "  ========================"
echo ""

if [ ! -f "$STANDALONE" ]; then
  echo "  ERROR: Frontend nicht gebaut."
  echo "  Bitte zuerst: cd frontend && npx next build"
  exit 1
fi

# Backend
echo "  > Backend starten (Port $BACKEND_PORT)..."
node "$SCRIPT_DIR/runtime/local/server.js" &
BACKEND_PID=$!

# Warten auf Backend
echo -n "  ~ Warte auf Backend "
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" > /dev/null 2>&1; then
    echo " OK"
    break
  fi
  echo -n "."
  sleep 1
done

# Frontend (standalone)
echo "  > Frontend starten (Port $FRONTEND_PORT)..."
PORT=$FRONTEND_PORT HOSTNAME=127.0.0.1 node "$STANDALONE" &
FRONTEND_PID=$!

echo -n "  ~ Warte auf Frontend "
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo " OK"
    break
  fi
  echo -n "."
  sleep 1
done

echo ""
echo "  Backend  : http://127.0.0.1:$BACKEND_PORT"
echo "  Frontend : http://localhost:$FRONTEND_PORT"
echo ""
echo "  Ctrl+C zum Beenden"
wait $BACKEND_PID $FRONTEND_PID
`;

  if (!DRY_RUN) {
    fs.writeFileSync(path.join(destDir, 'KI-OS-Community-Start.ps1'), ps1, 'utf8');
    fs.writeFileSync(path.join(destDir, 'KI-OS-Community.bat'),        bat, 'utf8');
    fs.writeFileSync(path.join(destDir, 'KI-OS-Community.sh'),         sh,  'utf8');
    // Linux/Mac ausführbar machen
    try { fs.chmodSync(path.join(destDir, 'KI-OS-Community.sh'), 0o755); } catch {}
  }
  log(`  WRITE KI-OS-Community-Start.ps1 / .bat / .sh (standalone-kompatibel)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  log('');
  log('╔══════════════════════════════════════════════════════════╗');
  log('║  KI-OS Community Edition Build                           ║');
  log(`║  Ziel: ${DEST.replace(ROOT, '.')}                        ║`);
  if (DRY_RUN) {
  log('║  MODE: DRY RUN — keine Dateien werden geschrieben        ║');
  }
  log('╚══════════════════════════════════════════════════════════╝');
  log('');

  // Clean destination
  if (!DRY_RUN && fs.existsSync(DEST)) {
    fs.rmSync(DEST, { recursive: true, force: true });
    log('  CLEAN dist/community/');
  }

  // Copy Community paths
  log('');
  log('▶ Kopiere Community-Module...');
  for (const relPath of COMMUNITY_PATHS) {
    const src = path.join(ROOT, relPath);
    if (!fs.existsSync(src)) {
      log(`  SKIP  ${relPath} (nicht vorhanden)`);
      continue;
    }
    const dest = path.join(DEST, relPath);
    copyRecursive(src, dest);
  }

  // Write community .env
  log('');
  log('▶ Schreibe Community-Konfiguration...');
  writeCommunityEnv(DEST);
  patchPackageJson(DEST);
  writeEnterpriseStub(DEST);

  // Remove enterprise-only connector profiles
  log('');
  log('▶ Entferne Enterprise-Connector-Profile...');
  removeEnterpriseConnectorProfiles(DEST);

  // Deploy community-specific core/app.js (enterprise routes stripped)
  log('');
  log('▶ Deploy Community app.js (ohne Enterprise-Routen)...');
  deployCommunityAppJs(DEST);

  // Write community stubs for excluded enterprise modules
  log('');
  log('▶ Schreibe Community-Stubs...');
  writeStubs(DEST);

  // Verify no REAL enterprise code leaked (stubs are intentionally allowed)
  log('');
  log('▶ Prüfe auf Enterprise-Leaks...');
  let leakFound = false;
  for (const entPath of ENTERPRISE_SERVICE_PATHS) {
    // Skip paths where we intentionally placed community stubs
    if (COMMUNITY_STUB_PATHS.has(entPath)) continue;
    const destEntPath = path.join(DEST, entPath);
    if (fs.existsSync(destEntPath)) {
      log(`  ⚠  LEAK GEFUNDEN: ${entPath}`);
      leakFound = true;
    }
  }
  if (!leakFound) log('  ✓ Kein Enterprise-Code in Community-Distribution gefunden.');

  // Frontend-Quellcode kopieren (frontend/orbit-control → dist/community/frontend/)
  log('');
  log('▶ Kopiere Frontend-Quellcode...');
  copyFrontendSource(DEST);

  // Community next.config.ts schreiben (output: standalone + turbopack-safe)
  log('');
  log('▶ Schreibe Frontend next.config.ts...');
  writeCommunityNextConfig(DEST);

  // Add AGPL copyright headers to all authored JS files (Backend only — Frontend bleibt MIT/BSD)
  log('');
  log('▶ Füge Copyright-Header hinzu...');
  addCopyrightHeaders(DEST);

  // Backend-Abhängigkeiten installieren
  if (!DRY_RUN) {
    log('');
    log('▶ Installiere Backend-Abhängigkeiten...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install --no-audit --no-fund --prefer-offline', { cwd: DEST, stdio: 'inherit' });
      log('  ✓ Backend node_modules bereit.');
    } catch (e) {
      log('  ⚠ npm install fehlgeschlagen — manuell: cd dist/community && npm install');
    }

    // Frontend bauen (npm install + next build + standalone postprocess)
    log('');
    log('▶ Baue Frontend (next build --standalone)...');
    buildFrontendStandalone(DEST);

    // ZIP-Optimierung: unnötige Verzeichnisse entfernen
    log('');
    log('▶ ZIP-Optimierung: Entferne node_modules + Frontend-Cache...');
    const toRemove = [
      [path.join(DEST, 'node_modules'),                          'Backend node_modules (~270 MB)'],
      [path.join(DEST, 'frontend', 'node_modules'),              'Frontend node_modules (~720 MB)'],
      [path.join(DEST, 'frontend', '.next', 'cache'),            'Next.js Build-Cache (~295 MB)'],
    ];
    for (const [p, label] of toRemove) {
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        log(`  ✓ ${label} entfernt`);
      }
    }
  }

  // Start-Scripts schreiben (PS1 / bat / sh — standalone-kompatibel)
  log('');
  log('▶ Schreibe Start-Scripts...');
  writeCommunityStartScripts(DEST);

  log('');
  if (DRY_RUN) {
    log('✓ Dry-Run abgeschlossen — keine Dateien geschrieben.');
  } else {
    log(`✓ Community-Build fertig: ${DEST}`);
    log('');
    log('  Backend : node runtime/local/server.js   → http://localhost:3000');
    log('  Frontend: node frontend/.next/standalone/server.js  → http://localhost:3001');
    log('');
    log('  Oder einfach: KI-OS-Community.bat (Windows) / KI-OS-Community.sh (Linux/Mac)');
    log('');
    log('  Distribution: dist/community/ zippen und verteilen.');
    log('  Kein node_modules-Fallback, kein next dev, kein Turbopack auf User-Systemen.');
  }
  log('');
}

main();
