/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: tool.executor.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */


'use strict';
const { ToolRegistryV2 } = require('./tool.registry.v2');

class ToolExecutor {
  constructor(options = {}) {
    this.registry = options.registry || new ToolRegistryV2(options);
  }
  async execute(plan = []) {
    const results = [];
    for (const step of plan) {
      const tool = this.registry.get(step.tool);
      if (!tool) throw new Error(`Unknown tool: ${step.tool}`);
      const result = await tool.execute(step.input || {});
      results.push({ tool: step.tool, result });
    }
    return results;
  }
}

module.exports = { ToolExecutor };
