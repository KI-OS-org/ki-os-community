/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS · heartbeat.service.js
 * Installation-Heartbeat — sendet anonyme Nutzungsdaten an status.ki-os.org
 * © 2026 Ingo Schaffer — ki-os.org
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 * Author: Ingo Schaffer & Kimba (KI-OS Engineering Team)
 * Version: 1.6.0 | License: Proprietary — All rights reserved
 *
 * Was gesendet wird (kein PII):
 *   installId  — anonyme UUID, generiert beim ersten Start, bleibt konstant
 *   version    — KI-OS-Version aus package.json
 *   edition    — 'community' | 'enterprise'
 *   uptime     — Sekunden seit Start
 *   nodeCount  — Anzahl aktiver Nodes (falls AgentMesh)
 *   ts         — Unix-Timestamp
 *
 * Endpoint: POST https://status.ki-os.org/api/heartbeat
 * Intervall: beim Start + alle 60 Minuten
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const http = require('https');
const crypto = require('crypto');

// Endpoint kann via .env überschrieben werden (z.B. für Self-Hosted)
const _url          = process.env.KIOS_HEARTBEAT_URL || 'https://status.ki-os.org/api/heartbeat';
const _parsed       = new URL(_url);
const ENDPOINT_HOST = _parsed.hostname;
const ENDPOINT_PATH = _parsed.pathname;
const INTERVAL_MS   = 60 * 60 * 1000; // 60 min

// Install-ID-Datei: liegt in ~/.ki-os/install-id  (außerhalb des Repos)
const ID_FILE = path.join(os.homedir(), '.ki-os', 'install-id');

/**
 * Liest oder erzeugt eine anonyme, stabile Install-ID.
 * Wird einmal generiert und lokal gespeichert — kein Bezug zu User/IP.
 */
function getInstallId() {
    try {
        const dir = path.dirname(ID_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(ID_FILE)) {
            const id = fs.readFileSync(ID_FILE, 'utf8').trim();
            if (id.length === 36) return id; // valid UUID
        }
        const id = crypto.randomUUID();
        fs.writeFileSync(ID_FILE, id, 'utf8');
        return id;
    } catch {
        // Fallback: session-only ID (nicht persistent)
        return crypto.randomUUID();
    }
}

/**
 * Liest die KI-OS-Version aus dem nächsten package.json.
 */
function getVersion() {
    const candidates = [
        path.resolve(__dirname, '../../../package.json'),
        path.resolve(__dirname, '../../../../package.json'),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')).version || '1.6.0';
        } catch { /* skip */ }
    }
    return '1.6.0';
}

const START_TIME = Date.now();
const INSTALL_ID = getInstallId();
const VERSION    = getVersion();
const EDITION    = process.env.KIOS_EDITION || 'community';
const ENABLED    = process.env.KI_OS_TELEMETRY !== 'false'; // opt-out via .env

/**
 * Sendet einen einzelnen Heartbeat — fire-and-forget, keine Fehlerausbreitung.
 */
function sendHeartbeat(extra = {}) {
    const payload = JSON.stringify({
        installId : INSTALL_ID,
        version   : VERSION,
        edition   : EDITION,
        uptime    : Math.floor((Date.now() - START_TIME) / 1000),
        platform  : process.platform,
        ts        : Date.now(),
        ...extra,
    });

    const req = http.request({
        hostname: ENDPOINT_HOST,
        path    : ENDPOINT_PATH,
        method  : 'POST',
        headers : {
            'Content-Type'  : 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent'    : `ki-os/${VERSION} (${EDITION})`,
        },
        timeout: 5000,
    });

    req.on('error', () => { /* silent — status.ki-os.org nicht erreichbar ist kein Fehler */ });
    req.on('timeout', () => { req.destroy(); });
    req.write(payload);
    req.end();
}

let _timer = null;

/**
 * Startet den Heartbeat-Service.
 * Beim ersten Aufruf: sofortiger Ping + periodischer Interval.
 * Sicher: mehrfacher Aufruf startet keinen zweiten Timer.
 */
function start(extra = {}) {
    if (!ENABLED) return; // KI_OS_TELEMETRY=false → kein Heartbeat
    if (_timer) return; // already running

    // Erster Ping leicht verzögert (5s nach Start) damit Server vollständig initialisiert ist
    setTimeout(() => sendHeartbeat({ event: 'start', ...extra }), 5000);

    // Stündlicher Ping
    _timer = setInterval(() => sendHeartbeat(extra), INTERVAL_MS);
    if (_timer.unref) _timer.unref(); // Verhindert, dass der Timer den Prozess am Laufen hält
}

function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { start, stop, sendHeartbeat, getInstallId };
