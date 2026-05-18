/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: automation.config.service.js
 * Diese Datei verwaltet Webhook- und Automationskonfigurationen und stellt die zentrale Registry für Hub-Flows bereit.
 * @license AGPL-3.0-only
 */

'use strict';

let DynamoDBClient = null;
let DynamoDBDocumentClient = null;
let PutCommand = null;
let GetCommand = null;
let ScanCommand = null;

try {
  ({ DynamoDBClient } = require('@aws-sdk/client-dynamodb'));
  ({ DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb'));
} catch {
  DynamoDBClient = null;
}

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1';
const TABLE = process.env.KIMBA_AUTOMATION_TABLE || 'kimba_automation';

let ddb = null;
let inMemoryStore = {};

function getClient() {
  if (!ddb && DynamoDBClient && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const base = new DynamoDBClient({ region: REGION });
    ddb = DynamoDBDocumentClient.from(base);
  }
  return ddb;
}

function normalizeBoolean(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function normalizeConfig(body = {}) {
  if (!body || !body.id) {
    throw new Error('saveWebhookConfig: "id" ist erforderlich');
  }

  const now = new Date().toISOString();
  const activeFlag = normalizeBoolean(body.active, body.enabled);
  const timeoutValue = Number(body.timeoutMs);
  const rateValue = Number(body.rateLimitPerMinute);

  return {
    id: body.id,
    hub: body.hub || body.provider || 'http',
    flowId: body.flowId || body.channel || body.event || body.id,
    url: body.url || body.targetUrl || null,
    method: String(body.method || 'POST').toUpperCase(),
    description: body.description || null,
    active: typeof activeFlag === 'boolean' ? activeFlag : true,
    enabled: typeof activeFlag === 'boolean' ? activeFlag : true,
    allowCallback: normalizeBoolean(body.allowCallback) ?? true,
    direction: Array.isArray(body.direction) && body.direction.length ? body.direction : ['outbound', 'inbound'],
    timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : 10000,
    rateLimitPerMinute: Number.isFinite(rateValue) && rateValue > 0 ? rateValue : 60,
    defaultData: body.defaultData || {},
    headers: body.headers || {},
    event: body.event || null,
    channel: body.channel || null,
    provider: body.provider || body.hub || null,
    secret: body.secret || null,
    secretRef: body.secretRef || null,
    targetUrl: body.targetUrl || body.url || null,
    created_at: body.created_at || now,
    updated_at: now
  };
}

async function saveWebhookConfig(body) {
  const item = normalizeConfig(body);
  const client = getClient();
  if (!client) {
    inMemoryStore[item.id] = item;
    return { success: true, item };
  }

  await client.send(new PutCommand({
    TableName: TABLE,
    Item: item
  }));

  return { success: true, item };
}

async function getWebhookConfig(id) {
  if (!id) throw new Error('getWebhookConfig: "id" ist erforderlich');

  const client = getClient();
  if (!client) {
    return inMemoryStore[id] || null;
  }

  const res = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { id }
  }));

  return res.Item || null;
}

async function listWebhookConfigs() {
  const client = getClient();
  if (!client) {
    const items = Object.values(inMemoryStore).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return { success: true, items };
  }

  const res = await client.send(new ScanCommand({ TableName: TABLE }));
  const items = (res.Items || []).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { success: true, items };
}

async function findWebhookConfigByHubFlow(hub, flowId) {
  if (!hub || !flowId) return null;
  const { items } = await listWebhookConfigs();
  return items.find((item) => String(item.hub || '').toLowerCase() === String(hub).toLowerCase() && String(item.flowId || '').toLowerCase() === String(flowId).toLowerCase()) || null;
}

function __resetAutomationConfigStore() {
  inMemoryStore = {};
}

module.exports = {
  saveWebhookConfig,
  getWebhookConfig,
  listWebhookConfigs,
  findWebhookConfigByHubFlow,
  __resetAutomationConfigStore
};
