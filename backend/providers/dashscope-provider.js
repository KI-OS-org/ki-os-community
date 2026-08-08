/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * DashScope Provider für KI-OS
 * Qwen Coder API Integration
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

const https = require('https');

class DashScopeProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.DASHSCOPE_API_KEY;
    this.apiBase = config.apiBase || process.env.DASHSCOPE_API_BASE || 'https://dashscope-intl.aliyuncs.com/api/v1';
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Chat Completion Request
   * @param {Object} options
   * @param {Array} options.messages - Array von {role, content}
   * @param {string} options.model - Modell-Name (z.B. 'qwen-turbo')
   * @param {number} options.temperature - Temperatur (0-2)
   * @param {number} options.maxTokens - Max Tokens
   * @param {boolean} options.stream - Stream Response
   */
  async chat(options = {}) {
    if (!this.enabled) {
      throw new Error('DashScope Provider ist deaktiviert');
    }

    const {
      messages = [],
      model = 'qwen-turbo',
      temperature = 0.7,
      maxTokens = 4096,
      stream = false
    } = options;

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream
      });

      const req = https.request(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(data);
            resolve({
              success: true,
              data: result,
              usage: result.usage,
              content: result.choices?.[0]?.message?.content
            });
          } else {
            reject(new Error(`DashScope API Error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('DashScope Timeout'));
      });
      req.write(postData);
      req.end();
    });
  }

  /**
   * Code-spezifische Anfrage (optimiert für Coding-Tasks)
   */
  async code(options = {}) {
    const systemPrompt = options.systemPrompt || `Du bist ein erfahrener Software-Entwickler.
Antworte präzise mit funktionierendem Code.
- Erkläre kurz, was der Code tut
- Verwende moderne Best Practices
- Füge Kommentare nur bei komplexer Logik hinzu`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(options.messages || [])
    ];

    return this.chat({
      ...options,
      messages,
      model: options.model || 'qwen-turbo',
      temperature: options.temperature ?? 0.3 // Niedrigere Temp für Code
    });
  }

  /**
   * Verfügbare Modelle abrufen
   */
  async listModels() {
    return new Promise((resolve, reject) => {
      const req = https.request(`${this.apiBase}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(data);
            resolve(result.data || []);
          } else {
            reject(new Error(`DashScope API Error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('DashScope Timeout'));
      });
      req.end();
    });
  }

  /**
   * Health Check
   */
  async health() {
    try {
      const models = await this.listModels();
      return {
        status: 'healthy',
        provider: 'dashscope',
        modelsAvailable: models.length > 0,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        status: 'unhealthy',
        provider: 'dashscope',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = DashScopeProvider;
