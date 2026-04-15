/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: worker.contracts.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

class WorkerResponse {
    static text(c, s=[], m={}) { return { type:'text', content:c, sources:s, meta:m }; }
    static error(msg) { return { type:'error', content:msg }; }
    static normalize(o) { return o.type ? o : this.text(o.text||o); }
}
module.exports = { WorkerResponse };
