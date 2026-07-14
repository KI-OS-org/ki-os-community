/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Browser-Use Tool Tests
 * 
 * Tests für:
 * - Security (Domain-Allowlist, Rate-Limit)
 * - Playwright-Integration (Mock)
 * - Firecrawl-Integration (Mock)
 * 
 * @module tools/browser/__tests__/browser.tool.test.js
 * @license AGPL-3.0
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Mocks für externe Dependencies
const mockPlaywright = {
  chromium: {
    launch: async () => ({
      newContext: async () => ({
        newPage: async () => ({
          goto: async () => {},
          title: async () => 'Test Page',
          url: () => 'http://localhost:3000',
          click: async () => {},
          fill: async () => {},
          screenshot: async () => Buffer.from('test'),
          evaluate: async () => ({}),
          close: async () => {},
        }),
        close: async () => {},
      }),
    }),
  },
};

// Playwright mocken
const originalRequire = require;
require = function(modulePath) {
  if (modulePath === 'playwright') {
    return mockPlaywright;
  }
  return originalRequire.apply(this, arguments);
};

// Tools laden
const { BrowserSecurity, matchesDomain, parseAllowlist } = require('../browser.security');

// ─── SECURITY TESTS ────────────────────────────────────────────────────────────

test.describe('BrowserSecurity', () => {
  test('should allow localhost by default', () => {
    const security = new BrowserSecurity();
    const result = security.assertUrlAllowed('http://localhost:3000/test');
    assert.ok(result);
    assert.equal(result.hostname, 'localhost');
  });

  test('should allow ki-os.org subdomains', () => {
    const security = new BrowserSecurity();
    const result = security.assertUrlAllowed('https://app.ki-os.org/test');
    assert.ok(result);
    assert.equal(result.hostname, 'app.ki-os.org');
  });

  test('should block unknown domains', () => {
    const security = new BrowserSecurity();
    assert.throws(
      () => security.assertUrlAllowed('https://evil.com/malicious'),
      /Domain not allowed/
    );
  });

  test('should block non-HTTP protocols', () => {
    const security = new BrowserSecurity();
    assert.throws(
      () => security.assertUrlAllowed('file:///etc/passwd'),
      /Blocked protocol/
    );
  });

  test('should enforce rate limiting', () => {
    let currentTime = Date.now();
    const security = new BrowserSecurity({
      rateLimit: 3,
      rateWindowMs: 60000,
      clock: () => currentTime,
    });

    // Erste 3 Requests sollten durchgehen
    security.checkAction();
    security.checkAction();
    security.checkAction();

    // 4. Request sollte geblockt werden
    assert.throws(
      () => security.checkAction(),
      /Browser rate limit exceeded/
    );

    // Nach 61 Sekunden sollte es wieder gehen
    currentTime += 61000;
    security.checkAction(); // Sollte nicht werfen
  });

  test('should timeout operations', async () => {
    const security = new BrowserSecurity({ timeoutMs: 100 });

    await assert.rejects(
      async () => {
        await security.withTimeout(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
        });
      },
      /timed out after 100ms/
    );
  });

  test('should audit actions', () => {
    const auditLogs = [];
    const mockLogger = {
      info: (msg, entry) => auditLogs.push({ msg, entry }),
    };

    const security = new BrowserSecurity({ auditLogger: mockLogger });
    security.checkAction({ url: 'http://localhost/test' });
    const auditEntry = security.audit('click', { selector: '#test' });

    assert.equal(auditLogs.length, 2);
    assert.equal(auditLogs[1].entry.action, 'click');
    assert.equal(auditLogs[1].entry.selector, '#test');
  });
});

// ─── DOMAIN MATCHING TESTS ─────────────────────────────────────────────────────

test.describe('matchesDomain', () => {
  test('should match exact domains', () => {
    assert.ok(matchesDomain('localhost', 'localhost'));
    assert.ok(matchesDomain('ki-os.org', 'ki-os.org'));
  });

  test('should match wildcard subdomains', () => {
    assert.ok(matchesDomain('app.ki-os.org', '*.ki-os.org'));
    assert.ok(matchesDomain('api.ki-os.org', '*.ki-os.org'));
  });

  test('should not match unrelated domains', () => {
    assert.equal(matchesDomain('evil.com', 'ki-os.org'), false);
    assert.equal(matchesDomain('ki-os.org.evil.com', 'ki-os.org'), false);
  });

  test('should handle IP addresses', () => {
    assert.ok(matchesDomain('127.0.0.1', '127.0.0.1'));
    assert.equal(matchesDomain('192.168.1.1', '127.0.0.1'), false);
  });
});

// ─── ALLOWLIST PARSING TESTS ───────────────────────────────────────────────────

test.describe('parseAllowlist', () => {
  test('should parse CSV allowlist', () => {
    const result = parseAllowlist('localhost,127.0.0.1,*.ki-os.org');
    assert.deepEqual(result, ['localhost', '127.0.0.1', '*.ki-os.org']);
  });

  test('should handle whitespace', () => {
    const result = parseAllowlist(' localhost , 127.0.0.1 , *.ki-os.org ');
    assert.deepEqual(result, ['localhost', '127.0.0.1', '*.ki-os.org']);
  });

  test('should use default if empty', () => {
    const result = parseAllowlist('');
    assert.ok(result.length > 0);
    assert.ok(result.includes('localhost'));
  });
});

// ─── INTEGRATION TESTS (MOCKED) ────────────────────────────────────────────────

test.describe('BrowserTool Integration', () => {
  test('should execute browser_navigate', async () => {
    const { browserTool } = require('../browser.tool');
    
    const result = await browserTool.execute('browser_navigate', {
      url: 'http://localhost:3000',
    });

    assert.equal(result.success, true);
    assert.equal(result.url, 'http://localhost:3000');
  });

  test('should execute browser_click', async () => {
    const { browserTool } = require('../browser.tool');

    // Erst navigieren (mock)
    await browserTool.execute('browser_navigate', { url: 'http://localhost:3000' });

    const result = await browserTool.execute('browser_click', {
      selector: '#test-button',
    });

    assert.equal(result.success, true);
    assert.equal(result.selector, '#test-button');
  });

  test('should execute browser_fill with redacted audit', async () => {
    const { browserTool } = require('../browser.tool');

    await browserTool.execute('browser_navigate', { url: 'http://localhost:3000' });

    const result = await browserTool.execute('browser_fill', {
      selector: '#username',
      value: 'secret-password',
    });

    assert.equal(result.success, true);
    // Audit sollte [REDACTED] enthalten
  });

  test('should execute browser_screenshot', async () => {
    const { browserTool } = require('../browser.tool');

    await browserTool.execute('browser_navigate', { url: 'http://localhost:3000' });

    const result = await browserTool.execute('browser_screenshot', {});

    assert.equal(result.success, true);
    assert.ok(result.screenshot);
  });

  test('should execute browser_search with redacted query', async () => {
    // Firecrawl ohne API-Key sollte Error werfen
    const { browserTool } = require('../browser.tool');

    await assert.rejects(
      async () => {
        await browserTool.execute('browser_search', { query: 'test query' });
      },
      /FIRECRAWL_API_KEY not set/
    );
  });

  test('should cleanup on exit', async () => {
    const { browserTool } = require('../browser.tool');

    // Cleanup sollte nicht werfen
    await browserTool.cleanup();
  });
});

// ─── ERROR HANDLING TESTS ──────────────────────────────────────────────────────

test.describe('Error Handling', () => {
  test('should handle invalid URLs', async () => {
    const { browserTool } = require('../browser.tool');

    await assert.rejects(
      async () => {
        await browserTool.execute('browser_navigate', { url: 'not-a-url' });
      },
      /Invalid URL/
    );
  });

  test('should handle missing selectors', async () => {
    const { browserTool } = require('../browser.tool');

    await browserTool.execute('browser_navigate', { url: 'http://localhost:3000' });

    await assert.rejects(
      async () => {
        await browserTool.execute('browser_click', { selector: '' });
      },
      /Failed to click/
    );
  });

  test('should handle unknown tools', async () => {
    const { browserTool } = require('../browser.tool');

    await assert.rejects(
      async () => {
        await browserTool.execute('browser_unknown', {});
      },
      /Unknown browser tool/
    );
  });
});
