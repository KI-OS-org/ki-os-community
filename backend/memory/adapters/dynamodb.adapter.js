/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: dynamodb.adapter.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */


'use strict';
const Base = require('./base.adapter');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class DynamoDbAdapter extends Base {
  constructor() {
    super();
    const region = process.env.AWS_REGION || 'eu-central-1';
    this.table = process.env.KIMBA_MEMORY_TABLE || 'kimba_memory';
    this.ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  async save(item) {
    const normalized = { memoryId: item.memoryId || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...item };
    await this.ddb.send(new PutCommand({ TableName: this.table, Item: normalized }));
    return normalized;
  }
  async listByUser(userId, limit = 20, options = {}) {
    const res = await this.ddb.send(new QueryCommand({
      TableName: this.table,
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      Limit: Math.max(limit * 5, limit),
      ScanIndexForward: false
    }));
    const tenantId = options.tenantId || 'default';
    return (res.Items || []).filter((item) => String(item.tenantId || 'default') === tenantId).slice(0, limit);
  }
  async getById(userId, memoryId, options = {}) {
    const items = await this.listByUser(userId, 200, options);
    return items.find((item) => item.memoryId === memoryId) || null;
  }
  async health() { return { ok: true, adapter: 'dynamodb', table: this.table }; }
}
module.exports = DynamoDbAdapter;
