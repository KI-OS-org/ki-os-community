/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Timeline App-Blacklist (S6) — Privacy-First-Default, verhindert dass sensible Apps in der Timeline landen

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BLACKLIST_PATH = path.join(os.homedir(), '.kios', 'timeline-blacklist.json');

/**
 * Privacy-First-Default-Liste für sensible macOS-Apps
 * (lieber zu viel blockieren als zu wenig)
 */
const DEFAULT_BLACKLIST = [
  "1Password",
  "1Password 7",
  "Passwords",
  "Keychain Access",
  "Banking",
  "Wallet"
];

/**
 * Liest die Blacklist synchron
 * @returns {string[]} Array von App-Namen
 */
function getBlacklist() {
  try {
    if (!fs.existsSync(BLACKLIST_PATH)) {
      // Erstmaliges Lesen: Default-Liste anlegen
      fs.mkdirSync(path.dirname(BLACKLIST_PATH), { recursive: true });
      fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(DEFAULT_BLACKLIST, null, 2));
      return DEFAULT_BLACKLIST;
    }

    const content = fs.readFileSync(BLACKLIST_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Bei Parse-Fehlern: leere Liste zurückgeben (nicht überschreiben)
      return [];
    }
    throw err; // andere Fehler weiterwerfen
  }
}

/**
 * Schreibt die Blacklist synchron
 * @param {string[]} apps - Array von App-Namen
 * @returns {string[]} Deduplizierte Liste
 * @throws {Error} Wenn apps kein Array von Strings ist
 */
function setBlacklist(apps) {
  if (!Array.isArray(apps) || !apps.every(app => typeof app === 'string')) {
    throw new Error('apps muss ein Array von Strings sein');
  }

  const deduplicated = [...new Set(apps)];
  fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(deduplicated, null, 2));
  return deduplicated;
}

/**
 * Fügt eine App zur Blacklist hinzu (falls nicht schon enthalten)
 * @param {string} appName - Name der App
 * @returns {string[]} Aktualisierte Blacklist
 */
function addToBlacklist(appName) {
  if (typeof appName !== 'string') {
    throw new Error('appName muss ein String sein');
  }

  const currentList = getBlacklist();
  if (!currentList.some(app => app.toLowerCase() === appName.toLowerCase())) {
    currentList.push(appName);
    return setBlacklist(currentList);
  }
  return currentList;
}

/**
 * Entfernt eine App aus der Blacklist
 * @param {string} appName - Name der App
 * @returns {string[]} Aktualisierte Blacklist
 */
function removeFromBlacklist(appName) {
  if (typeof appName !== 'string') {
    throw new Error('appName muss ein String sein');
  }

  const currentList = getBlacklist();
  const filteredList = currentList.filter(
    app => app.toLowerCase() !== appName.toLowerCase()
  );
  return setBlacklist(filteredList);
}

/**
 * Prüft ob eine App blacklisted ist
 * @param {string} appName - Name der App
 * @returns {boolean} true wenn blacklisted
 */
function isBlacklisted(appName) {
  if (!appName) return false;

  const currentList = getBlacklist();
  return currentList.some(
    app => app.toLowerCase() === appName.toLowerCase()
  );
}

module.exports = {
  BLACKLIST_PATH,
  getBlacklist,
  setBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  isBlacklisted
};
