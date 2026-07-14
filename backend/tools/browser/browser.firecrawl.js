/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Browser-Use Tool — Firecrawl Integration
 * 
 * Web-Scraping und Suche via Firecrawl.
 * 
 * Features:
 * - browser_scrape(url) — Webseite scrapen
 * - browser_search(query) — Websuche
 * 
 * @module tools/browser/browser.firecrawl.js
 * @license AGPL-3.0
 */

'use strict';

const https = require('https');
const { BrowserSecurity } = require('./browser.security');

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';

const security = new BrowserSecurity();

/**
 * HTTP-Request zu Firecrawl
 */
function firecrawlRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, FIRECRAWL_BASE_URL);
    
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
      },
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve({ raw: responseData });
          }
        } else {
          reject(new Error(`Firecrawl Error: ${res.statusCode} - ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Firecrawl Timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Webseite scrapen
 * @param {string} url - URL
 * @returns {object} Scraped Content (Text, Links, Metadata)
 */
async function browserScrape(url) {
  security.checkAction({ url });
  
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not set. Scraping unavailable.');
  }
  
  const auditEntry = security.audit('scrape', { url });
  
  try {
    const result = await firecrawlRequest('/scrape', {
      url,
      formats: ['markdown', 'links'],
      onlyMainContent: true,
    });
    
    return {
      success: true,
      url,
      content: result.markdown || '',
      links: result.links || [],
      metadata: result.metadata || {},
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
}

/**
 * Websuche via Firecrawl
 * @param {string} query - Suchanfrage
 * @returns {object} Suchergebnisse
 */
async function browserSearch(query) {
  security.checkAction();

  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY not set. Search unavailable.');
  }

  // FIX #1: Search-Query redacten (Privacy-Schutz)
  const auditEntry = security.audit('search', { query: '[REDACTED]' });
  
  try {
    const result = await firecrawlRequest('/search', {
      query,
      limit: 10,
      lang: 'de',
      country: 'de',
    });
    
    return {
      success: true,
      query,
      results: result.results || [],
      count: (result.results || []).length,
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to search "${query}": ${error.message}`);
  }
}

module.exports = {
  browserScrape,
  browserSearch,
  FIRECRAWL_API_KEY,
};
