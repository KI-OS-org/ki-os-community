/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const { createStoreBackend } = require('../state/store.backend');
const backend = createStoreBackend({ name: 'dlq', backendEnvKey: 'DLQ_STORE_BACKEND', filePathEnvKey: 'DLQ_STORE_PATH', tableEnvKey: 'DLQ_STORE_TABLE', defaultFileName: '.ki-os-dlq.json', defaultTableName: 'ki_os_dlq', partitionKey: 'dlq_store', defaultValueFactory: () => ({ items: [] }) });
let state = backend.read() || { items: [] };
function load() { state = backend.read() || { items: [] }; return state; }
function persist() { backend.write(state); }
function enqueue(item = {}) { load(); const entry = { id: item.id || `dlq-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, type: item.type || 'unknown', reason: item.reason || item.type || 'unknown', error: item.error || null, payload: item.payload || null, createdAt: new Date().toISOString() }; state.items.unshift(entry); state.items = state.items.slice(0, Number(process.env.DLQ_LIMIT || 200)); persist(); return entry; }
function list(limit = 50) { load(); return state.items.slice(0, Math.max(1, Number(limit || 50))); }
function reset() { state = { items: [] }; backend.remove(); }
function getSnapshot() { load(); return { success: true, backend: backend.info(), total: state.items.length, items: state.items.slice(0, 20) }; }
module.exports = { enqueue, list, reset, getSnapshot, listDeadLetters: list, resetDeadLetters: reset, enqueueDeadLetter: enqueue };