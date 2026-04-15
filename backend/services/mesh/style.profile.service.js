/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: style.profile.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';

function analyzeStyle(input = '', samples = []) {
  const text = [input, ...samples].filter(Boolean).join(' ');
  const avgSentenceLength = Math.max(1, Math.round(text.split(/[.!?]/).filter(Boolean).reduce((a, s) => a + s.trim().split(/\s+/).filter(Boolean).length, 0) / Math.max(1, text.split(/[.!?]/).filter(Boolean).length)));
  const directness = /!|\bbitte\b|\bmuss\b|\bklar\b|\bdirekt\b/i.test(text) ? 'direct' : 'balanced';
  const formality = /sehr geehrt|mit freundlichen gr|hiermit|bezugnehmend/i.test(text) ? 'formal' : 'professional';
  const structure = /:|-|\n\d|\b1\.|\b2\./.test(text) ? 'structured' : 'freeform';
  return {
    avgSentenceLength,
    directness,
    formality,
    structure,
    directive: `Schreibe ${formality}, ${directness === 'direct' ? 'praegnant-direkt' : 'balanciert'} und ${structure === 'structured' ? 'klar strukturiert' : 'gut lesbar'}.`
  };
}

module.exports = { analyzeStyle };
