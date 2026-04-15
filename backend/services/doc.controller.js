/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: doc.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { extractPdfText, parseExcel } = require('./core/worker.tools');

async function handleDocProcess(body) {
    // body: { file_base64, filename, file_type }
    try {
        if(!body.file_base64) return { error: 'Missing file_base64' };
        
        const type = body.file_type || body.filename?.split('.').pop()?.toLowerCase();
        
        if (type === 'pdf') {
            const res = await extractPdfText(body.file_base64);
            return res;
        }
        if (type === 'xlsx' || type === 'xls') {
            const res = await parseExcel(body.file_base64);
            return res;
        }
        
        return { error: `Unsupported file type: ${type}` };
    } catch (e) {
        return { error: e.message };
    }
}

module.exports = { handleDocProcess };