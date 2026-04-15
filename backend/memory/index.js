/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: index.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';

function createMemoryAdapter() {
  const driver = (process.env.MEMORY_DRIVER || '').toLowerCase();
  if (driver === 'lancedb') {
    const LanceDBAdapter = require('./adapters/lancedb.adapter');
    return new LanceDBAdapter();
  }
  if (driver === 'dynamodb') {
    const DynamoDbAdapter = require('./adapters/dynamodb.adapter');
    return new DynamoDbAdapter();
  }
  if (driver === 'file' || driver === 'sqlite') {
    const FileAdapter = require('./adapters/file.adapter');
    return new FileAdapter();
  }
  if (process.env.AWS_EXECUTION_ENV) {
    const DynamoDbAdapter = require('./adapters/dynamodb.adapter');
    return new DynamoDbAdapter();
  }
  const FileAdapter = require('./adapters/file.adapter');
  return new FileAdapter();
}

module.exports = { createMemoryAdapter };
