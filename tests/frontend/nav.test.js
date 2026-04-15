/**
 * @file    nav.test.js
 * @desc    Ghost Control Navigation Simulation — alle 27 Frontend-Routen
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only
 */
const test = require('node:test');
const assert = require('node:assert');
const fetch = require('node-fetch');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

const PAGES = [
  { name: 'Home',              route: '/' },
  { name: 'AgentMesh',         route: '/agentmesh' },
  { name: 'Agents',            route: '/agents' },
  { name: 'Flows',             route: '/flows' },
  { name: 'Runs',              route: '/runs' },
  { name: 'Jobs',              route: '/jobs' },
  { name: 'Workspace',         route: '/workspace' },
  { name: 'Memory',            route: '/memory' },
  { name: 'Files',             route: '/files' },
  { name: 'Documents',         route: '/documents' },
  { name: 'Connector Galaxy',  route: '/connector-galaxy' },
  { name: 'Integrations',      route: '/integrations' },
  { name: 'Webhooks',          route: '/webhooks' },
  { name: 'Providers',         route: '/providers' },
  { name: 'MCP',               route: '/mcp' },
  { name: 'Campaigns',         route: '/campaigns' },
  { name: 'Economic',          route: '/economic' },
  { name: 'Efficiency',        route: '/efficiency' },
  { name: 'Media Studio',      route: '/media' },
  { name: 'Control',           route: '/control' },
  { name: 'Trust',             route: '/trust' },
  { name: 'Privacy',           route: '/privacy' },
  { name: 'Supervisor',        route: '/supervisor' },
  { name: 'Tests',             route: '/tests' },
  { name: 'Tenants',           route: '/tenants' },
  { name: 'State',             route: '/state' },
  { name: 'Notifications',     route: '/notifications' }
];

test('Test Navigation to all pages', async () => {
  for (const { name, route } of PAGES) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 18000);
    try {
      const res = await fetch(`${BASE_URL}/ghost/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: `Navigiere zur ${name} Seite`, mode: 'demo' }),
        signal: controller.signal
      });
      assert.strictEqual(res.status, 200, `HTTP 200 expected for ${name}`);
      const data = await res.json();
      assert.ok(
        'needsClarification' in data,
        `Response muss needsClarification haben für ${name}`
      );
      assert.strictEqual(
        typeof data.needsClarification, 'boolean',
        `needsClarification muss boolean sein für ${name}`
      );
      if (!data.needsClarification) {
        assert.ok(data.plan, `plan muss vorhanden sein für ${name}`);
        assert.ok(Array.isArray(data.plan.steps), `plan.steps muss Array sein für ${name}`);
        assert.ok(data.plan.steps.length >= 1, `plan muss mindestens 1 Step haben für ${name}`);
        // Mindestens ein Step muss zur Route navigieren oder sie erwähnen
        const hasRouteRef = data.plan.steps.some(
          s => (s.target && s.target.includes(route)) ||
               (s.callout && s.callout.toLowerCase().includes(name.toLowerCase()))
        );
        assert.ok(
          hasRouteRef,
          `Kein Step referenziert Route ${route} oder Name ${name}. Steps: ${JSON.stringify(data.plan.steps.map(s => ({ type: s.type, target: s.target })))}`
        );
      }
    } finally {
      clearTimeout(id);
    }
  }
}, 300000);
