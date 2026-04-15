/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: verifier.v2.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */


'use strict';
const { verifyAnswer } = require('./verifier.service');
const { decideTrust } = require('../policy/trust.policy');

async function verifyAndDecide(payload) {
  const verifier = await verifyAnswer(payload);
  const decision = decideTrust({ verifier, routing: payload.routing, result: payload.result || { sources: payload.sources } });
  return { verifier, decision };
}

module.exports = { verifyAndDecide };
