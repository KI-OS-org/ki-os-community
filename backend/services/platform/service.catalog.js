/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Service Catalog (S8) — aktivierbare Dienste mit persistentem An/Aus-State, Nutzer aktiviert Dienste statt einzelner Tools

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const STATE_FILE = path.join(os.homedir(), '.kios', 'services.json');

const SERVICE_DEFINITIONS = [
  { id: 'briefing',   name: 'Morning Briefing',      description: 'Tägliches Briefing mit Plan-Vorschlag (Telegram)', category: 'proaktiv',   defaultEnabled: false },
  { id: 'watch',      name: 'Screen-Watch',           description: 'Beobachtet den Bildschirm, bietet proaktiv Hilfe an', category: 'proaktiv',   defaultEnabled: false },
  { id: 'research',   name: 'Research',               description: 'Web-Recherche auf Anfrage (web_fetch/web_search)', category: 'auf-anfrage', defaultEnabled: true },
  { id: 'inbox',      name: 'Multi-Channel-Inbox',    description: 'Eingehende Nachrichten aus WhatsApp/Signal/iMessage/Telegram', category: 'proaktiv', defaultEnabled: false },
  { id: 'skillforge', name: 'SkillForge',             description: 'Erkennt wiederkehrende Muster, schlägt Skills vor', category: 'lernend',    defaultEnabled: true },
  { id: 'timeline',   name: 'Timeline',               description: 'Langzeit-Bildschirmhistorie mit semantischer Suche', category: 'gedächtnis', defaultEnabled: false },
  { id: 'claws',      name: 'ClawHub-Skills',         description: 'Fremde Skills sicher installieren und ausführen (Docker-Pflicht)', category: 'erweiterung', defaultEnabled: true },
];

/**
 * Liest den aktuellen State aus der Datei
 * @returns {Object} State-Objekt oder leeres Objekt bei Fehler
 */
function _readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('Fehler beim Lesen des Service-States:', err.message);
    return {};
  }
}

/**
 * Schreibt den State in die Datei
 * @param {Object} state Zu schreibender State
 */
function _writeState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Fehler beim Schreiben des Service-States:', err.message);
  }
}

/**
 * Prüft, ob ein Dienst aktiviert ist
 * @param {string} serviceId ID des Dienstes
 * @returns {boolean} true wenn aktiviert, sonst false
 */
function isEnabled(serviceId) {
  const state = _readState();
  if (serviceId in state) return state[serviceId];

  const definition = SERVICE_DEFINITIONS.find(def => def.id === serviceId);
  return definition ? definition.defaultEnabled : false;
}

/**
 * Listet alle Dienste mit ihrem aktuellen Status
 * @returns {Array} Array von Dienst-Objekten mit enabled-Flag
 */
function listServices() {
  return SERVICE_DEFINITIONS.map(def => ({
    ...def,
    enabled: isEnabled(def.id)
  }));
}

/**
 * Gibt den Status eines einzelnen Dienstes zurück
 * @param {string} serviceId ID des Dienstes
 * @returns {Object|undefined} Dienst-Objekt mit enabled-Flag oder undefined
 */
function getServiceStatus(serviceId) {
  const definition = SERVICE_DEFINITIONS.find(def => def.id === serviceId);
  if (!definition) return undefined;

  return {
    ...definition,
    enabled: isEnabled(serviceId)
  };
}

/**
 * Aktiviert einen Dienst
 * @param {string} serviceId ID des Dienstes
 * @returns {Object} Aktualisierter Dienst-Status
 * @throws {Error} Wenn Dienst nicht existiert
 */
function enableService(serviceId) {
  if (!SERVICE_DEFINITIONS.some(def => def.id === serviceId)) {
    throw new Error('Unbekannter Dienst: ' + serviceId);
  }

  const state = _readState();
  state[serviceId] = true;
  _writeState(state);
  return getServiceStatus(serviceId);
}

/**
 * Deaktiviert einen Dienst
 * @param {string} serviceId ID des Dienstes
 * @returns {Object} Aktualisierter Dienst-Status
 * @throws {Error} Wenn Dienst nicht existiert
 */
function disableService(serviceId) {
  if (!SERVICE_DEFINITIONS.some(def => def.id === serviceId)) {
    throw new Error('Unbekannter Dienst: ' + serviceId);
  }

  const state = _readState();
  state[serviceId] = false;
  _writeState(state);
  return getServiceStatus(serviceId);
}

module.exports = {
  SERVICE_DEFINITIONS,
  listServices,
  getServiceStatus,
  enableService,
  disableService,
  isEnabled
};
