/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Browser-Use Tool — Haupt-Tool
 * 
 * Kombiniert Playwright + Firecrawl.
 * 
 * @module tools/browser/browser.tool.js
 * @license AGPL-3.0
 */

'use strict';

const playwright = require('./browser.playwright');
const firecrawl = require('./browser.firecrawl');

/**
 * Browser-Tool für KI-OS Agenten.
 *
 * Tools:
 * - browser_navigate(url)
 * - browser_click(selector)
 * - browser_fill(selector, value)
 * - browser_screenshot()
 * - browser_scroll(direction)
 * - browser_wait(ms)
 * - browser_scrape(url)
 * - browser_search(query)
 */
class BrowserTool {
  constructor() {
    this.name = 'browser';
    this.description = 'Browser automation for web navigation, scraping, and search';
    this.version = '1.28.0';
    
    // FIX #2: Cleanup-Hooks für graceful shutdown registrieren
    this._registerCleanupHooks();
  }
  
  /**
   * Cleanup-Hooks registrieren (automatisches Schließen bei Shutdown).
   * @private
   */
  _registerCleanupHooks() {
    // Verhindern von Mehrfach-Registrierung
    if (process._browserToolCleanupRegistered) {
      return;
    }
    
    process._browserToolCleanupRegistered = true;
    
    const cleanup = async () => {
      try {
        await this.cleanup();
      } catch (e) {
        // Silent fail im Shutdown
      }
    };
    
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup().then(() => process.exit(0)); });
    process.on('SIGTERM', () => { cleanup().then(() => process.exit(0)); });
  }
  
  /**
   * Tool-Registry für KI-OS.
   */
  getTools() {
    return [
      {
        name: 'browser_navigate',
        description: 'Navigate to a URL',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate to' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_click',
        description: 'Click an element',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'browser_fill',
        description: 'Fill text into an input',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector' },
            value: { type: 'string', description: 'Text to fill' },
          },
          required: ['selector', 'value'],
        },
      },
      {
        name: 'browser_screenshot',
        description: 'Take a screenshot',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_scroll',
        description: 'Scroll the page',
        parameters: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['up', 'down'] },
            amount: { type: 'number', default: 500 },
          },
        },
      },
      {
        name: 'browser_wait',
        description: 'Wait for milliseconds',
        parameters: {
          type: 'object',
          properties: {
            ms: { type: 'number', default: 1000 },
          },
        },
      },
      {
        name: 'browser_scrape',
        description: 'Scrape a webpage (Firecrawl)',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to scrape' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_search',
        description: 'Web search (Firecrawl)',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ];
  }
  
  /**
   * Tool ausführen.
   */
  async execute(toolName, params) {
    switch (toolName) {
      case 'browser_navigate':
        return await playwright.browserNavigate(params.url);
      
      case 'browser_click':
        return await playwright.browserClick(params.selector);
      
      case 'browser_fill':
        return await playwright.browserFill(params.selector, params.value);
      
      case 'browser_screenshot':
        return await playwright.browserScreenshot();
      
      case 'browser_scroll':
        return await playwright.browserScroll(params.direction, params.amount);
      
      case 'browser_wait':
        return await playwright.browserWait(params.ms);
      
      case 'browser_scrape':
        return await firecrawl.browserScrape(params.url);
      
      case 'browser_search':
        return await firecrawl.browserSearch(params.query);
      
      default:
        throw new Error(`Unknown browser tool: ${toolName}`);
    }
  }
  
  /**
   * Browser schließen (Cleanup).
   */
  async cleanup() {
    await playwright.closeBrowser();
  }
}

module.exports = {
  BrowserTool,
  browserTool: new BrowserTool(),
};
