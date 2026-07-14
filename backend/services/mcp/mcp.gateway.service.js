/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: mcp.gateway.service.js
 * KI-OS MCP Gateway — Standard-Port fuer externe KI-Clients (Claude Desktop, Cursor, Claude Code).
 * Exponiert KI-OS-Tools, -Resources und -Prompts via MCP-Protokoll (stdio + SSE).
 * @license AGPL-3.0-only
 */
'use strict';

const logger = require('../core/logger.service');

let _Server, _StdioTransport, _SSETransport, _ResourceTemplate;

function _loadSdk() {
  if (_Server) return true;
  try {
    // WICHTIG (Bug gefunden + gefixt 2026-07-12, Sprint S0): die low-level `Server`-Klasse aus
    // server/index.js hat KEIN .tool()/.resource()/.prompt() -- diese Convenience-API existiert
    // nur auf `McpServer` aus server/mcp.js. Server crashte bisher bei jedem echten Verbindungs-
    // versuch mit "server.tool is not a function", nie bemerkt weil getStatus() das nie aufruft.
    _Server           = require('@modelcontextprotocol/sdk/server/mcp.js').McpServer;
    _ResourceTemplate = require('@modelcontextprotocol/sdk/server/mcp.js').ResourceTemplate;
    _StdioTransport   = require('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;
    _SSETransport     = require('@modelcontextprotocol/sdk/server/sse.js').SSEServerTransport;
    return true;
  } catch (e) {
    logger.warn(`mcp.gateway: SDK not available — ${e.message.split('\n')[0]}`);
    return false;
  }
}

class McpGatewayService {
  constructor() {
    this._server = null;
    this._version = require('../../../package.json').version;
    // sessionId -> Transport, siehe startSse()/handleMessage() -- das SDK erzeugt pro SSE-
    // Verbindung eine eigene sessionId (Query-Param im vom Client abonnierten Endpoint-URL);
    // eingehende POSTs muessen den EXAKT selben Transport treffen, nicht einen frisch erzeugten.
    this._transports = new Map();
  }

  isEnabled() {
    return process.env.MCP_GATEWAY_ENABLED !== 'false' && _loadSdk();
  }

  getServer() {
    if (this._server) return this._server;
    if (!_loadSdk()) return null;

    const name    = process.env.MCP_SERVER_NAME    || 'ki-os';
    const version = process.env.MCP_SERVER_VERSION || this._version;

    const server = new _Server({ name, version }, {
      capabilities: { tools: {}, resources: {}, prompts: {} }
    });

    this._registerTools(server);
    this._registerResources(server);
    this._registerPrompts(server);

    this._server = server;
    return server;
  }

  _registerTools(server) {
    const { z } = (() => { try { return require('zod'); } catch { return { z: null }; } })();

    const schema = z
      ? {
          kios_run_task:    { goal: z.string(), userId: z.string().optional(), namespace: z.string().optional() },
          kios_search_docs: { query: z.string(), limit: z.number().int().min(1).max(50).optional() },
          kios_list_agents: {},
          kios_get_run:     { runId: z.string() },
          kios_search_memory: { query: z.string(), userId: z.string(), namespace: z.string().optional() },
          browser_navigate: { url: z.string(), user: z.string().optional(), noJavaScript: z.boolean().optional(), timeoutMs: z.number().optional() },
          browser_click: { selector: z.string(), user: z.string().optional(), timeoutMs: z.number().optional() },
          browser_fill: { selector: z.string(), value: z.string(), user: z.string().optional(), timeoutMs: z.number().optional() },
          browser_screenshot: { user: z.string().optional(), fullPage: z.boolean().optional(), timeoutMs: z.number().optional() },
          browser_scroll: { direction: z.enum(['up', 'down']).optional(), user: z.string().optional(), timeoutMs: z.number().optional() },
          browser_wait: { ms: z.number().optional(), user: z.string().optional(), timeoutMs: z.number().optional() },
          browser_scrape: { url: z.string(), user: z.string().optional(), timeoutMs: z.number().optional() },
          browser_search: { query: z.string(), limit: z.number().int().min(1).max(20).optional(), user: z.string().optional(), timeoutMs: z.number().optional() }
        }
      : {};

    server.tool('kios_run_task', 'Startet einen AgentMesh-Run mit einem Ziel', schema.kios_run_task || {}, async ({ goal, userId = 'mcp', namespace }) => {
      try {
        const { kernel } = require('../../core/kernel');
        const result = await kernel.run({ goal, userId, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    });

    server.tool('kios_search_docs', 'Durchsucht KI-OS Projekt-Dokumentation (FTS)', schema.kios_search_docs || {}, async ({ query, limit = 10 }) => {
      const db = require('../db/project.db.service');
      const results = db.search(query, limit);
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    });

    server.tool('kios_list_agents', 'Listet alle registrierten KI-OS Agenten', schema.kios_list_agents || {}, async () => {
      const { listAgents } = require('../agent/agent.registry.service');
      const agents = await listAgents();
      return { content: [{ type: 'text', text: JSON.stringify(agents) }] };
    });

    server.tool('kios_get_run', 'Gibt Status eines AgentMesh-Runs zurueck', schema.kios_get_run || {}, async ({ runId }) => {
      const { getRun } = require('../agentmesh/mesh.store');
      const run = getRun(runId);
      return { content: [{ type: 'text', text: JSON.stringify(run || { error: 'Run not found' }) }] };
    });

    server.tool('kios_search_memory', 'Durchsucht KI-OS Memory Broker', schema.kios_search_memory || {}, async ({ query, userId, namespace }) => {
      const broker = require('../memory/memory.broker');
      const results = await broker.retrieve(query, { userId, runId: 'mcp', agentRole: 'mcp-client', namespace });
      return { content: [{ type: 'text', text: JSON.stringify(results) }] };
    });

    this._registerBrowserTools(server, schema);
  }

  _registerBrowserTools(server, schema) {
    // Bug gefunden + gefixt 2026-07-12 (Sprint S0): `createBrowserTool`/`ACTIONS` existierten
    // nie im echten Modul -- die reale API ist die Singleton-Instanz `browserTool` mit
    // getTools() (liefert Name+Beschreibung+JSON-Schema) und execute(toolName, params).
    const { browserTool } = require('../../tools/browser');

    for (const meta of browserTool.getTools()) {
      const name = meta.name;
      server.tool(name, meta.description, schema[name] || {}, async (input = {}) => {
        try {
          const result = await browserTool.execute(name, { user: 'mcp', ...input });
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (e) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
        }
      });
    }
  }

  _registerResources(server) {
    const ResourceTemplate = _ResourceTemplate;

    server.resource('kios-doc', new ResourceTemplate('kios://docs/{filename}', { list: undefined }), async (uri, { filename }) => {
      const db = require('../db/project.db.service');
      const doc = db.get(filename);
      if (!doc) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: `Doc not found: ${filename}` }] };
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: doc.content }] };
    });

    server.resource('kios-status', 'kios://status', async (uri) => {
      const { listAgents } = require('../agent/agent.registry.service');
      const { listRuns }   = require('../agentmesh/mesh.store');
      const db             = require('../db/project.db.service');
      const agents = await listAgents().catch(() => []);
      const runs   = listRuns ? listRuns(10) : [];
      const stats  = db.getStats();
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ version: this._version, agents: agents.length, runs: runs.length, docs: stats.total }) }] };
    });

    // "browser-capabilities" Resource entfernt 2026-07-12 (Sprint S0) -- CAPABILITIES existierte
    // nie im echten backend/tools/browser Modul, war rein fiktiv. "browser-tools" nutzt jetzt
    // die echte browserTool.getTools()-API.
    server.resource('browser-tools', 'kios://tools/browser', async (uri) => {
      const { browserTool } = require('../../tools/browser');
      const tools = browserTool.getTools();
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ tools }) }] };
    });
  }

  _registerPrompts(server) {
    const { z } = (() => { try { return require('zod'); } catch { return { z: null }; } })();
    const schema = z ? { goal: z.string(), context: z.string().optional() } : {};

    server.prompt('kios_agent_brief', 'Generiert einen System-Prompt fuer eine AgentMesh-Aufgabe', schema, ({ goal, context }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Du bist ein KI-OS-Agent. Deine Aufgabe: ${goal}${context ? `\n\nKontext: ${context}` : ''}\n\nNutze die verfuegbaren KI-OS-Tools um die Aufgabe zu erledigen.`
        }
      }]
    }));
  }

  startStdio() {
    if (!_loadSdk()) { logger.warn('mcp.gateway: SDK not available'); return; }
    const server    = this.getServer();
    const transport = new _StdioTransport();
    server.connect(transport).then(() => logger.info('mcp.gateway: stdio transport started'));
  }

  startSse(req, res) {
    if (!_loadSdk()) { res.status(503).json({ error: 'MCP SDK not installed' }); return; }
    const server    = this.getServer();
    const transport = new _SSETransport('/mcp/gateway/message', res);
    this._transports.set(transport.sessionId, transport);
    server.connect(transport).then(() => logger.debug(`mcp.gateway: SSE client connected (session ${transport.sessionId})`));
    req.on('close', () => {
      this._transports.delete(transport.sessionId);
      transport.close();
    });
  }

  handleMessage(req, res) {
    if (!_loadSdk() || !this._server) { res.status(503).json({ error: 'MCP not ready' }); return; }
    // Bug gefunden + gefixt 2026-07-12 (Sprint S0): hier wurde bisher IMMER ein frischer
    // Transport erzeugt statt den in startSse() verbundenen wiederzuverwenden -- das SDK
    // meldete "SSE connection not established", weil der neue Transport nie verbunden war.
    const sessionId = req.query.sessionId;
    const transport = this._transports.get(sessionId);
    if (!transport) { res.status(400).json({ error: `Unbekannte oder fehlende sessionId: ${sessionId}` }); return; }
    // Bug gefunden + gefixt 2026-07-12: express.json() (global in server.js) hat den Body-Stream
    // schon konsumiert, bevor das SDK ihn selbst lesen konnte ("stream is not readable"). Der
    // dritte Parameter reicht den von Express bereits geparsten Body direkt durch.
    transport.handlePostMessage(req, res, req.body);
  }

  getStatus() {
    return {
      enabled: this.isEnabled(),
      sdkAvailable: _loadSdk(),
      serverName: process.env.MCP_SERVER_NAME || 'ki-os',
      version: this._version,
      tools: ['kios_run_task', 'kios_search_docs', 'kios_list_agents', 'kios_get_run', 'kios_search_memory', 'browser_navigate', 'browser_click', 'browser_fill', 'browser_screenshot', 'browser_scroll', 'browser_wait', 'browser_scrape', 'browser_search'],
      resources: ['kios://docs/{filename}', 'kios://status', 'kios://tools/browser'],
      prompts: ['kios_agent_brief']
    };
  }
}

module.exports = new McpGatewayService();
