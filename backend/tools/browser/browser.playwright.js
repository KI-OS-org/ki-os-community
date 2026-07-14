/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Browser-Use Tool
 * 
 * Playwright-Integration für Browser-Automation.
 * 
 * Features:
 * - browser_navigate(url) — Webseite öffnen
 * - browser_click(selector) — Element klicken
 * - browser_fill(selector, value) — Text eingeben
 * - browser_screenshot() — Screenshot machen
 * - browser_scroll(direction) — Scrollen
 * - browser_wait(ms) — Warten
 * 
 * @module tools/browser/browser.playwright.js
 * @license AGPL-3.0
 */

'use strict';

const { BrowserSecurity } = require('./browser.security');

// Playwright optional laden
let playwright = null;
let browser = null;
let context = null;
let page = null;

try {
  playwright = require('playwright');
} catch (e) {
  console.warn('[BrowserTool] Playwright not installed. Browser actions will fail.');
}

const security = new BrowserSecurity();

/**
 * Browser initialisieren
 */
async function initBrowser(options = {}) {
  if (!playwright) {
    throw new Error('Playwright not installed. Run: npm install playwright');
  }
  
  if (browser) {
    return browser;
  }
  
  const { headless = true, noJavascript = false } = options;
  
  browser = await playwright.chromium.launch({
    headless,
    args: noJavascript ? ['--disable-javascript'] : [],
  });
  
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'KI-OS-Browser/1.28.0',
  });
  
  page = await context.newPage();
  
  return browser;
}

/**
 * Browser schließen
 */
async function closeBrowser() {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

/**
 * Webseite öffnen
 * @param {string} url - URL
 * @param {object} options - Optionen
 */
async function browserNavigate(url, options = {}) {
  security.checkAction({ url });
  
  await initBrowser(options);
  
  const auditEntry = security.audit('navigate', { url });
  
  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: security.timeoutMs,
    });
    
    return {
      success: true,
      url: page.url(),
      title: await page.title(),
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to navigate to ${url}: ${error.message}`);
  }
}

/**
 * Element klicken
 * @param {string} selector - CSS Selector
 */
async function browserClick(selector) {
  security.checkAction();
  
  if (!page) {
    throw new Error('Browser not initialized. Call browserNavigate first.');
  }
  
  const auditEntry = security.audit('click', { selector });
  
  try {
    await page.click(selector, { timeout: 10000 });
    
    return {
      success: true,
      selector,
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to click ${selector}: ${error.message}`);
  }
}

/**
 * Text eingeben
 * @param {string} selector - CSS Selector
 * @param {string} value - Wert
 */
async function browserFill(selector, value) {
  security.checkAction();
  
  if (!page) {
    throw new Error('Browser not initialized. Call browserNavigate first.');
  }
  
  const auditEntry = security.audit('fill', { selector, value: '[REDACTED]' });
  
  try {
    await page.fill(selector, value, { timeout: 10000 });
    
    return {
      success: true,
      selector,
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to fill ${selector}: ${error.message}`);
  }
}

/**
 * Screenshot machen
 * @returns {string} Base64 Screenshot
 */
async function browserScreenshot() {
  security.checkAction();
  
  if (!page) {
    throw new Error('Browser not initialized. Call browserNavigate first.');
  }
  
  const auditEntry = security.audit('screenshot');
  
  try {
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    
    return {
      success: true,
      screenshot: screenshot.toString('base64'),
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to take screenshot: ${error.message}`);
  }
}

/**
 * Scrollen
 * @param {string} direction - 'up' oder 'down'
 * @param {number} amount - Pixel (default: 500)
 */
async function browserScroll(direction = 'down', amount = 500) {
  security.checkAction();
  
  if (!page) {
    throw new Error('Browser not initialized. Call browserNavigate first.');
  }
  
  const auditEntry = security.audit('scroll', { direction, amount });
  
  try {
    const scrollAmount = direction === 'up' ? -amount : amount;
    await page.evaluate((scrollY) => {
      window.scrollBy(0, scrollY);
    }, scrollAmount);
    
    return {
      success: true,
      direction,
      amount,
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to scroll: ${error.message}`);
  }
}

/**
 * Warten
 * @param {number} ms - Millisekunden
 */
async function browserWait(ms = 1000) {
  security.checkAction();
  
  const auditEntry = security.audit('wait', { ms });
  
  await new Promise(resolve => setTimeout(resolve, ms));
  
  return {
    success: true,
    ms,
    auditEntry,
  };
}

/**
 * Seite extrahieren (Text + Links)
 */
async function browserExtractContent() {
  security.checkAction();
  
  if (!page) {
    throw new Error('Browser not initialized. Call browserNavigate first.');
  }
  
  const auditEntry = security.audit('extract_content');
  
  try {
    const content = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
        text: a.textContent.trim(),
        href: a.href,
      })).filter(l => l.text && l.href);
      
      return {
        title: document.title,
        text: document.body.innerText,
        links,
        url: window.location.href,
      };
    });
    
    return {
      success: true,
      content,
      auditEntry,
    };
  } catch (error) {
    throw new Error(`Failed to extract content: ${error.message}`);
  }
}

module.exports = {
  initBrowser,
  closeBrowser,
  browserNavigate,
  browserClick,
  browserFill,
  browserScreenshot,
  browserScroll,
  browserWait,
  browserExtractContent,
};
