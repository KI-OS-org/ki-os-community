/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Docker-Pflicht-Sandbox für Claw-Ausführung — Ausführung ohne Docker wird komplett blockiert, keine schwächere Fallback-Isolation

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');

/**
 * Prüft, ob Docker verfügbar ist.
 * @returns {boolean} - true wenn Docker verfügbar ist, sonst false
 */
function isDockerAvailable() {
  try {
    const result = spawnSync('docker', ['info'], { timeout: 5000, stdio: 'ignore' });
    return result.status === 0;
  } catch (err) {
    // ENOENT oder andere Fehler -> Docker nicht verfügbar
    return false;
  }
}

/**
 * Führt einen Claw in einer isolierten Docker-Umgebung aus.
 * @param {Object} skill - Das Skill-Objekt (aus parser.js)
 * @param {Object} options - Optionen für die Ausführung
 * @param {number} options.timeoutMs - Timeout in Millisekunden (default: 30000)
 * @returns {Promise<Object>} - Ergebnis der Ausführung
 */
async function runClaw(skill, options = {}) {
  const timeoutMs = options.timeoutMs || 30000;

  // 1. Prüfe, ob Docker verfügbar ist
  if (!isDockerAvailable()) {
    return {
      blocked: true,
      reason: 'docker-unavailable',
      mode: null,
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      durationMs: 0
    };
  }

  // 2. Prüfe, ob ein Entry Point vorhanden ist
  if (!skill.entryPoint) {
    return {
      blocked: true,
      reason: 'no-entry-point',
      mode: null,
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      durationMs: 0
    };
  }

  // 3. Pfad-Traversal-Schutz
  const clawDir = path.dirname(skill.sourcePath);
  const entryPointAbsolute = path.resolve(clawDir, skill.entryPoint);
  const resolvedBase = path.resolve(clawDir);
  if (!entryPointAbsolute.startsWith(resolvedBase + path.sep) && entryPointAbsolute !== resolvedBase) {
    return {
      blocked: true,
      reason: 'entry-point-path-traversal',
      mode: null,
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      durationMs: 0
    };
  }

  // 4. Prüfe, ob das benötigte Docker-Image lokal vorhanden ist
  const imageInspectResult = spawnSync('docker', ['image', 'inspect', 'node:22-alpine'], { stdio: 'ignore' });
  if (imageInspectResult.status !== 0) {
    return {
      blocked: true,
      reason: 'image-not-pulled',
      mode: null,
      exitCode: null,
      stdout: '',
      stderr: 'Docker-Image node:22-alpine ist nicht lokal vorhanden. Einmalig manuell ausführen: docker pull node:22-alpine',
      timedOut: false,
      durationMs: 0
    };
  }

  // 5. Erstelle temporäres Sandbox-Verzeichnis
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-claw-'));
  let containerName = null;
  let timeoutId = null;

  try {
    // Kopiere den kompletten Claw-Ordner in das Sandbox-Verzeichnis
    fs.cpSync(clawDir, sandboxDir, { recursive: true });

    // Erstelle Container-Namen
    containerName = `kios-claw-${randomUUID()}`;

    // Starte den Container
    const args = [
      'run',
      '--rm',
      `--name=${containerName}`,
      '--network=none',
      '--read-only',
      '--tmpfs=/tmp:rw,size=64m,noexec',
      '--memory=256m',
      '--memory-swap=256m',
      '--cpus=0.5',
      '--pids-limit=64',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--user=1000:1000',
      `-v=${sandboxDir}:/claw:ro`,
      '-w=/claw',
      'node:22-alpine',
      'node',
      `/claw/${skill.entryPoint}`
    ];

    const startTime = Date.now();
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Sammle stdout/stderr
    let stdout = '';
    let stderr = '';
    const maxOutputSize = 1024 * 1024; // 1MB

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > maxOutputSize) {
        stdout = stdout.substring(0, maxOutputSize - 20) + '...[truncated]';
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > maxOutputSize) {
        stderr = stderr.substring(0, maxOutputSize - 20) + '...[truncated]';
      }
    });

    // Timeout-Handling
    let timedOut = false;
    timeoutId = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try {
          spawnSync('docker', ['kill', containerName], { stdio: 'ignore' });
        } catch (err) {
          // Ignorieren, da der Container bereits gestoppt sein könnte
        }
      }
    }, timeoutMs);

    // Warte auf Prozessende
    const result = await new Promise((resolve) => {
      child.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        resolve({
          blocked: false,
          mode: 'docker',
          exitCode,
          stdout,
          stderr,
          timedOut,
          durationMs
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;
        resolve({
          blocked: false,
          mode: 'docker',
          exitCode: null,
          stdout,
          stderr,
          timedOut,
          durationMs
        });
      });
    });

    return result;
  } finally {
    // Cleanup des Sandbox-Verzeichnisses
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch (err) {
      // Ignorieren, da es sich um eine Cleanup-Operation handelt
    }
  }
}

module.exports = {
  isDockerAvailable,
  runClaw
};
