/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

'use strict';

class LLMQueue {
  constructor(options) {
    const opts = options || {};
    const concurrency = Number(opts.concurrency || 5);
    const timeoutMs = Number(process.env.LLM_QUEUE_TIMEOUT_MS || opts.timeout || 30000);

    this.concurrency = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 5;
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
    this.activeCount = 0;
    this.pending = [];
  }

  add(fn) {
    if (typeof fn !== 'function') {
      return Promise.reject(new TypeError('LLMQueue.add erwartet eine Funktion'));
    }

    return new Promise((resolve, reject) => {
      const entry = {
        fn,
        resolve,
        reject,
        timer: null
      };

      entry.timer = setTimeout(() => {
        const index = this.pending.indexOf(entry);
        if (index !== -1) {
          this.pending.splice(index, 1);
        }

        const error = new Error('Maximale gleichzeitige Verbindungen erreicht — bitte kurz warten und erneut versuchen.');
        error.statusCode = 429;
        error.code = 'LLM_QUEUE_TIMEOUT';
        reject(error);
      }, this.timeoutMs);

      this.pending.push(entry);
      this._drain();
    });
  }

  _drain() {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const entry = this.pending.shift();
      clearTimeout(entry.timer);
      this.activeCount += 1;

      Promise.resolve()
        .then(() => entry.fn())
        .then((result) => {
          this.activeCount -= 1;
          entry.resolve(result);
          this._drain();
        })
        .catch((error) => {
          this.activeCount -= 1;
          entry.reject(error);
          this._drain();
        });
    }
  }
}

module.exports = new LLMQueue({
  concurrency: process.env.LLM_QUEUE_CONCURRENCY || 5
});
