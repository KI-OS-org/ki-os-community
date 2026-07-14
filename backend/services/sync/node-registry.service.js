/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 * @file backend/services/sync/node-registry.service.js
 * @description Node Registry — Heartbeat-basierte Verfügbarkeit von Mac Mini und MacBook Pro
 */
"use strict";

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const NODES = {
  'loki-fast': {
    host: '127.0.0.1',
    port: 8091,
    path: '/v1/models',
    model: 'Qwen3-4B-4bit',
    role: 'fast-chat',      // ~200 tok/s
  },
  'loki-pro': {
    host: '127.0.0.1',
    port: 8090,
    path: '/v1/models',
    model: 'Qwen3.6-27B-4bit+kios-v2',
    role: 'high-power',     // ~16 tok/s, KI-OS trainiert
  },
  'loki-mini': {
    host: '192.168.178.102',
    port: 11434,
    path: '/api/tags',
    model: 'gemma4:12b',
    role: 'mac-mini',
  },
};

const STATUS_FILE = process.env.NODE_REGISTRY_PATH || path.join(os.homedir(), 'KI-OS/runtime/local/node-status.json');
const PING_INTERVAL = 30000;
const TIMEOUT = 3000;

let intervalId = null;
let currentStatus = {
  updatedAt: new Date().toISOString(),
  nodes: Object.fromEntries(
    Object.entries(NODES).map(([id, n]) => [id, {
      status: 'offline', lastSeen: null, latencyMs: null, model: n.model, role: n.role
    }])
  ),
  preferredNode: null
};

function pingNode(nodeId, callback) {
  const node = NODES[nodeId];
  const startTime = Date.now();

  const options = {
    hostname: node.host,
    port: node.port,
    path: node.path,
    method: 'GET',
    timeout: TIMEOUT
  };

  const req = http.request(options, (res) => {
    const latency = Date.now() - startTime;
    const status = latency > 5000 ? 'degraded' : 'online';
    callback(null, {
      status,
      latencyMs: latency,
      lastSeen: new Date().toISOString()
    });
  });

  req.on('error', (err) => {
    callback(err, {
      status: 'offline',
      latencyMs: null,
      lastSeen: new Date().toISOString()
    });
  });

  req.on('timeout', () => {
    req.destroy();
    callback(new Error('Timeout'), {
      status: 'offline',
      latencyMs: null,
      lastSeen: new Date().toISOString()
    });
  });

  req.end();
}

function updateStatus() {
  const updates = {};

  Object.keys(NODES).forEach(nodeId => {
    pingNode(nodeId, (err, result) => {
      updates[nodeId] = result;
      if (Object.keys(updates).length === Object.keys(NODES).length) {
        const now = new Date().toISOString();
        currentStatus.updatedAt = now;

        Object.keys(updates).forEach(nodeId => {
          currentStatus.nodes[nodeId].status = updates[nodeId].status;
          currentStatus.nodes[nodeId].lastSeen = updates[nodeId].lastSeen;
          currentStatus.nodes[nodeId].latencyMs = updates[nodeId].latencyMs;
        });

        // Preferred: loki-fast > loki-pro > loki-mini
        currentStatus.preferredNode =
          ['loki-fast', 'loki-pro', 'loki-mini'].find(
            id => currentStatus.nodes[id]?.status === 'online'
          ) || null;

        writeStatusFile();
      }
    });
  });
}

function writeStatusFile() {
  try {
    fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(currentStatus, null, 2));
  } catch (err) {
    console.error('Failed to write node status file:', err);
  }
}

function readStatusFile() {
  try {
    const data = fs.readFileSync(STATUS_FILE, 'utf8');
    currentStatus = JSON.parse(data);
  } catch (err) {
    // If file doesn't exist or is invalid, keep currentStatus as is
  }
}

function start() {
  if (intervalId) return;
  readStatusFile();
  updateStatus();
  intervalId = setInterval(updateStatus, PING_INTERVAL);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function getStatus() {
  return currentStatus;
}

function getPreferred() {
  return currentStatus.preferredNode;
}

function isOnline(nodeId) {
  return currentStatus.nodes[nodeId]?.status === 'online';
}

module.exports = {
  start,
  stop,
  getStatus,
  getPreferred,
  isOnline
};
