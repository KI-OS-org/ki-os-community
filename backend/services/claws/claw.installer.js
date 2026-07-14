/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Installer/Registry für installierte Claw-Skills — Ampel-Gate: rot wird nie installiert

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { scanClaw, AMPEL } = require('./claw.scanner.js');
const { parseClawDirectory } = require('./claw.parser.js');

const CLAWS_DIR = path.join(os.homedir(), '.kios', 'claws');
const MANIFEST_PATH = path.join(CLAWS_DIR, 'installed.json');

/**
 * Liest das Manifest-File und gibt es zurück.
 * Bei Fehler oder fehlender Datei wird ein leeres Array zurückgegeben.
 * @returns {Array} - Das Manifest-Array
 */
function _readManifest() {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return [];
    const data = fs.readFileSync(MANIFEST_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

/**
 * Installiert einen Claw-Skill aus einem Verzeichnis.
 * @param {string} sourcePath - Pfad zum Quellverzeichnis des Claws
 * @returns {Object} - Das installierte Manifest-Objekt
 */
async function installClaw(sourcePath) {
  const result = scanClaw(sourcePath);
  
  if (result.ampel === AMPEL.RED) {
    throw new Error(`Installation blockiert: Claw ist ROT (${result.reason}, ${result.clawHavocMatches.length} ClawHavoc-Treffer)`);
  }

  const targetDir = path.join(CLAWS_DIR, result.skill.name);
  fs.mkdirSync(CLAWS_DIR, { recursive: true });

  // Vorhandenes Zielverzeichnis entfernen (Reinstall)
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  // Kopiere den gesamten Claw-Ordner
  fs.cpSync(sourcePath, targetDir, { recursive: true });

  // Manifest aktualisieren
  const manifest = _readManifest();
  const existingIndex = manifest.findIndex(item => item.name === result.skill.name);
  if (existingIndex !== -1) {
    manifest.splice(existingIndex, 1);
  }

  const manifestEntry = {
    name: result.skill.name,
    version: result.skill.version,
    description: result.skill.description,
    permissions: result.skill.permissions,
    ampel: result.ampel,
    permissionRisk: result.permissionRisk,
    installedAt: new Date().toISOString(),
    installedFrom: path.resolve(sourcePath),
    installedPath: targetDir,
    entryPoint: result.skill.entryPoint
  };

  manifest.push(manifestEntry);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Zusätzliche Informationen für Rückgabe
  const returnObj = {
    ...manifestEntry,
    ampel: result.ampel,
    warning: result.ampel === AMPEL.YELLOW 
      ? 'Claw wurde mit gelber Ampel installiert — Vorsicht bei Permissions: ' + JSON.stringify(result.skill.permissions) 
      : null
  };

  return returnObj;
}

/**
 * Deinstalliert einen installierten Claw-Skill.
 * @param {string} name - Name des zu deinstallierenden Claws
 * @returns {Object} - { removed: boolean, name? } - Ob erfolgreich entfernt
 */
function uninstallClaw(name) {
  const targetDir = path.join(CLAWS_DIR, name);
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  const manifest = _readManifest();
  const initialLength = manifest.length;
  const filtered = manifest.filter(item => item.name !== name);
  
  if (filtered.length === initialLength) {
    return { removed: false };
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(filtered, null, 2));
  return { removed: true, name };
}

/**
 * Listet alle installierten Claws auf.
 * @returns {Array} - Array mit installierten Claw-Informationen
 */
function listInstalled() {
  return _readManifest();
}

/**
 * Gibt einen installierten Claw anhand seines Namens zurück.
 * @param {string} name - Name des Claws
 * @returns {Object|undefined} - Das Manifest-Objekt oder undefined
 */
function getInstalledClaw(name) {
  const manifest = _readManifest();
  return manifest.find(item => item.name === name);
}

module.exports = {
  CLAWS_DIR,
  MANIFEST_PATH,
  installClaw,
  uninstallClaw,
  listInstalled,
  getInstalledClaw
};
