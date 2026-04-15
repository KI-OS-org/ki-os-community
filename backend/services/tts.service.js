/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: tts.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

const axios = require('./core/http.client');
module.exports = {
    async stream(text, voice='alloy') {
        const clean = text.replace(/[*#_`\[\]]/g, '');
        const response = await axios.post('https://api.openai.com/v1/audio/speech', 
            { model: "tts-1", input: clean, voice: voice }, 
            { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, responseType: 'stream' }
        );
        return response.data;
    }
};
