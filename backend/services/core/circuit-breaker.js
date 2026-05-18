/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

'use strict';

const STATE_CLOSED = 'CLOSED';
const STATE_OPEN = 'OPEN';
const STATE_HALF_OPEN = 'HALF_OPEN';

const providerStates = new Map();

function isEnabled() {
  return process.env.CIRCUIT_BREAKER_ENABLED !== 'false';
}

function getThreshold() {
  const value = Number(process.env.CIRCUIT_BREAKER_THRESHOLD || 3);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

function getCooldownMs() {
  const value = Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS || 60000);
  return Number.isFinite(value) && value > 0 ? value : 60000;
}

function getOrCreateState(provider) {
  if (!providerStates.has(provider)) {
    providerStates.set(provider, {
      state: STATE_CLOSED,
      failures: 0,
      openedAt: 0
    });
  }
  return providerStates.get(provider);
}

function isOpen(provider) {
  if (!isEnabled()) return false;

  const entry = getOrCreateState(provider);
  if (entry.state !== STATE_OPEN) return false;

  const cooldownMs = getCooldownMs();
  if ((Date.now() - entry.openedAt) >= cooldownMs) {
    entry.state = STATE_HALF_OPEN;
    return false;
  }

  return true;
}

function recordFailure(provider) {
  if (!isEnabled()) return getState(provider);

  const entry = getOrCreateState(provider);
  const threshold = getThreshold();

  if (entry.state === STATE_HALF_OPEN) {
    entry.state = STATE_OPEN;
    entry.failures = threshold;
    entry.openedAt = Date.now();
    return getState(provider);
  }

  entry.failures += 1;
  if (entry.failures >= threshold) {
    entry.state = STATE_OPEN;
    entry.openedAt = Date.now();
  }

  return getState(provider);
}

function recordSuccess(provider) {
  if (!isEnabled()) return getState(provider);

  providerStates.set(provider, {
    state: STATE_CLOSED,
    failures: 0,
    openedAt: 0
  });

  return getState(provider);
}

function getState(provider) {
  const entry = getOrCreateState(provider);
  return {
    state: entry.state,
    failures: entry.failures,
    openedAt: entry.openedAt
  };
}

function reset(provider) {
  if (provider) {
    providerStates.delete(provider);
    return;
  }
  providerStates.clear();
}

module.exports = {
  isOpen,
  recordFailure,
  recordSuccess,
  getState,
  reset
};
