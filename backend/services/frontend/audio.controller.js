/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: audio.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

const TTS = require('../tts.service');
module.exports = {
    async speak(req, res) {
        try {
            const stream = await TTS.stream(req.body.text, req.body.voice);
            res.setHeader('Content-Type', 'audio/mpeg');
            stream.pipe(res);
        } catch(e) { res.status(500).json({error: e.message}); }
    }
};
