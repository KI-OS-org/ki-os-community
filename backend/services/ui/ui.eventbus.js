/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const { EventEmitter } = require('events');

const bus = new EventEmitter();
const history = [];
const MAX_HISTORY = Number(process.env.UI_EVENT_HISTORY_LIMIT || 200);

function push(event, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    event,
    timestamp: new Date().toISOString(),
    ...payload
  };
  history.push(entry);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  bus.emit('event', entry);
  return entry;
}

function list(limit = 50) {
  return history.slice(-Math.max(1, limit));
}

function reset() {
  history.length = 0;
}

module.exports = { bus, push, list, reset };
