/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';

/**
 * Service to interact with the MCP Server Registry.
 * Fetches and caches the list of servers from the official registry.
 */
class McpRegistryService {
  constructor() {
    this._cache = null;
    this._cacheTs = 0;
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
    this.REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
  }

  /**
   * Fetch all MCP servers from the registry with in-memory caching.
   * @returns {Array} List of server objects: { name, description, homepage, categories }
   */
  async getAll() {
    const now = Date.now();
    if (this._cache && now - this._cacheTs < this.CACHE_TTL) {
      return this._cache;
    }

    try {
      const response = await fetch(this.REGISTRY_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // Normalize server objects
      const servers = Array.isArray(data) ? data.map(server => ({
        name: server.name || 'Unknown',
        description: server.description || '',
        homepage: server.homepage || server.url || '',
        categories: Array.isArray(server.categories) ? server.categories : [],
        tags: Array.isArray(server.tags) ? server.tags : []
      })) : [];

      this._cache = servers;
      this._cacheTs = now;
      return servers;
    } catch (error) {
      console.error('McpRegistryService.getAll() failed:', error.message);
      return [];
    }
  }

  /**
   * Search servers by name or description (case-insensitive).
   * @param {string} query - Search term
   * @returns {Array} Max 20 matching servers
   */
  async search(query) {
    if (!query || typeof query !== 'string') return [];

    const all = await this.getAll();
    const q = query.toLowerCase().trim();

    const filtered = all.filter(server =>
      server.name.toLowerCase().includes(q) ||
      server.description.toLowerCase().includes(q)
    );

    return filtered.slice(0, 20);
  }

  /**
   * Suggest top 5 relevant MCP servers based on project context using KIMBA AI.
   * @param {string} projectContext - Description of the project
   * @returns {Array} List of matched server objects from the registry
   */
  async suggest(projectContext) {
    if (!projectContext || typeof projectContext !== 'string') return [];

    const all = await this.getAll();
    if (all.length === 0) return [];

    try {
      const sampleServers = all.slice(0, 50).map(s => ({
        name: s.name,
        description: (s.description || '').slice(0, 80)
      }));

      const prompt = `You are KIMBA. Based on this project context, suggest the 5 most relevant MCP servers from this list. Return ONLY a JSON array of server names.

PROJECT: ${projectContext.slice(0, 500)}

AVAILABLE SERVERS (sample):
${JSON.stringify(sampleServers, null, 2)}`;

      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'kimba',
          'x-role': 'admin'
        },
        body: JSON.stringify({ message: prompt })
      });

      if (!response.ok) throw new Error(`AI service returned status ${response.status}`);

      const text = await response.text();
      let names;
      try {
        names = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Invalid JSON response from AI: ${text}`);
      }

      if (!Array.isArray(names)) throw new Error('AI did not return a JSON array');

      // Match returned names to full server objects
      const matched = names
        .map(name => all.find(s => s.name === name))
        .filter(Boolean);

      return matched.slice(0, 5); // Ensure max 5
    } catch (error) {
      console.error('McpRegistryService.suggest() failed:', error.message);
      return [];
    }
  }
}

module.exports = { McpRegistryService };
