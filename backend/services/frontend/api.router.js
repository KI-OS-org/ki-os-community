/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: api.router.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

const express = require('express');
const router = express.Router();
const Chat = require('./chat.controller');
const Audio = require('./audio.controller');
const OS_VERSION = "5.9-Final-Guidance";

router.post('/chat', (req, res) => Chat.handleRequest(req, res));
router.post('/voice/speak', (req, res) => Audio.speak(req, res));
router.get('/health', (req, res) => res.json({ status: 'ok', os_level: OS_VERSION }));
module.exports = router;