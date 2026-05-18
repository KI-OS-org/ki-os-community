/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: worker.contracts.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

class WorkerResponse {
    static text(c, s=[], m={}) { return { type:'text', content:c, sources:s, meta:m }; }
    static error(msg) { return { type:'error', content:msg }; }
    static normalize(o) { return o.type ? o : this.text(o.text||o); }
}
module.exports = { WorkerResponse };
