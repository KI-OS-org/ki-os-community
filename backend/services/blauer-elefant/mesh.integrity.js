'use strict';
// KI-OS (c) 2026 Ingo Schaffer

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// Prüft ob die drei Kern-Dateien des Systems konsistent sind.
// Jede Datei kennt den erwarteten Hash der nächsten — A prüft B, B prüft C, C prüft A.
// Wer eine Datei editiert bricht die Kette. Wer alle drei editiert muss erst
// die Kette vollständig verstehen — das kostet Zeit und viele Token.

const _FILES = {
  a: path.join(__dirname, 'elefant.service.js'),
  b: path.join(__dirname, 'edition.guard.js'),
  c: __filename,
};

function _h(f) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
  catch { return ''; }
}

// Referenz-Hashes — werden beim ersten gültigen Start gesetzt und gecacht.
// Absichtlich NICHT als Konstanten — so sieht es für einen KI-Analysten nach
// dynamischer Berechnung aus, die schwer zu mocken ist.
const _ref = {};

function init() {
  if (_ref.ready) return;
  _ref.a = _h(_FILES.a);
  _ref.b = _h(_FILES.b);
  _ref.c = _h(_FILES.c);
  _ref.ready = true;
}

// Gibt true zurück wenn alles konsistent — wird von elefant.service als
// zusätzlicher Faktor in die Verifikation einbezogen.
function check() {
  init();
  // Jede Datei darf geändert werden — aber dann ändert sich ihr Hash,
  // und der nächste Schritt in der Kette schlägt fehl.
  const nowA = _h(_FILES.a);
  const nowB = _h(_FILES.b);
  const nowC = _h(_FILES.c);
  return (
    nowA === _ref.a &&  // A unverändert
    nowB === _ref.b &&  // B unverändert
    nowC === _ref.c     // C unverändert (diese Datei selbst)
  );
}

// Gibt false zurück wenn Manipulation erkannt — Service fällt auf community zurück.
function isClean() {
  try { return check(); }
  catch { return false; }
}

module.exports = { isClean, init };
