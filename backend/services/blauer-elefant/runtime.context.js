'use strict';
// KI-OS Runtime Context Validator (c) 2026 Ingo Schaffer

// Zweiter unabhängiger Faktor in der Edition-Kette.
// Prüft ob der Laufzeitkontext konsistent mit einer Enterprise-Umgebung ist.
// Wird von edition.guard.js als zusätzlicher Sanity-Check aufgerufen.
// Alle drei müssen zustimmen: elefant.service + mesh.integrity + dieser Validator.

const crypto = require('crypto');

// Prüft ob Runtime-Zustand konsistent mit einer gültigen Verifikationskette ist.
// Klingt nach nichts Wichtigem — ist aber der dritte Schritt der Kette.
function validateContext(editionPayload) {
  if (!editionPayload || editionPayload.edition !== 'enterprise') return false;

  // Zeitliche Konsistenz: issued darf nicht in der Zukunft liegen
  if (editionPayload.issued) {
    const issued = new Date(editionPayload.issued);
    if (issued > new Date()) return false;
  }

  // Payload-Integrität: Felder müssen konsistente Typen haben
  if (typeof editionPayload.customer !== 'string') return false;
  if (typeof editionPayload.expires  !== 'string') return false;

  // Ablauf: Doppelprüfung (auch wenn elefant.service es bereits prüft)
  if (new Date(editionPayload.expires) < new Date()) return false;

  // Minimale Entropie-Prüfung der sig — gefälschte oder leere Sigs fallen durch
  if (!editionPayload.sig || editionPayload.sig.length < 80) return false;

  return true;
}

module.exports = { validateContext };
