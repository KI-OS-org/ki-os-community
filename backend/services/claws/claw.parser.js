/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Parser für Claw-Skill-Manifeste (SKILL.md oder openclaw.plugin.json) in internes Skill-Schema

const fs = require('node:fs');
const path = require('node:path');

const CLAW_SCHEMA_VERSION = '1.0';

/**
 * Parst den YAML-Frontmatter aus einer SKILL.md-Datei.
 * @param {string} content - Der Inhalt der Datei
 * @returns {Object} - Geparstes Frontmatter
 */
function parseFrontmatter(content) {
  const lines = content.split('\n');
  const frontmatter = {};
  let inFrontmatter = false;
  let frontmatterLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!inFrontmatter && line === '---') {
      inFrontmatter = true;
      continue;
    } else if (inFrontmatter && line === '---') {
      inFrontmatter = false;
      break;
    } else if (inFrontmatter) {
      frontmatterLines.push(line);
    }
  }

  if (inFrontmatter) {
    throw new Error('Ungültiges Frontmatter: Kein schließendes "---" gefunden.');
  }

  // Manueller Parser für YAML-Frontmatter
  for (let i = 0; i < frontmatterLines.length; i++) {
    const line = frontmatterLines[i];
    if (!line.includes(':')) continue;
    
    const colonIndex = line.indexOf(':');
    const key = line.substring(0, colonIndex).trim();
    let valueStr = line.substring(colonIndex + 1).trim();

    // Prüfe, ob es sich um eine mehrzeilige Liste handelt (key: ohne Wert)
    if (valueStr === '') {
      // Prüfe, ob die nächste Zeile mit "- " beginnt
      const nextLine = frontmatterLines[i + 1];
      if (nextLine && nextLine.trim().startsWith('- ')) {
        const list = [];
        let j = i + 1;
        while (j < frontmatterLines.length && frontmatterLines[j].trim().startsWith('- ')) {
          const item = frontmatterLines[j].trim().substring(2).trim();
          if (item) list.push(item);
          j++;
        }
        frontmatter[key] = list;
        // Überspringe die verarbeiteten Zeilen
        i = j - 1;
        continue;
      } else {
        // Keine Liste, setze Wert auf null
        frontmatter[key] = null;
        continue;
      }
    }

    // Handle Inline-Listen
    if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      const listStr = valueStr.slice(1, -1).trim();
      if (listStr) {
        const items = listStr.split(',').map(item => item.trim());
        frontmatter[key] = items;
      } else {
        frontmatter[key] = [];
      }
      continue;
    }

    // Handle Inline-Liste mit einzelner Zeile
    if (valueStr.startsWith('- ')) {
      const list = [];
      let j = i;
      while (j < frontmatterLines.length && frontmatterLines[j].trim().startsWith('- ')) {
        const item = frontmatterLines[j].trim().substring(2).trim();
        if (item) list.push(item);
        j++;
      }
      frontmatter[key] = list;
      i = j - 1;
      continue;
    }

    // Handle einfache Werte
    let value = valueStr;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value === 'null' || value === 'undefined') {
      value = null;
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (!isNaN(value) && !isNaN(parseFloat(value))) {
      value = parseFloat(value);
    }
    frontmatter[key] = value;
  }

  return frontmatter;
}

/**
 * Parst eine SKILL.md-Datei und gibt das normierte Skill-Schema zurück.
 * @param {string} filePath - Pfad zur SKILL.md-Datei
 * @returns {Object} - Normiertes Skill-Schema
 */
function parseSkillMd(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);
  const bodyStart = content.indexOf('---\n') + 4;
  const bodyEnd = content.indexOf('\n---\n');
  const rawBody = bodyEnd !== -1 ? content.substring(bodyEnd + 5).trim() : null;

  // Validierung
  if (!frontmatter.name) {
    throw new Error(`Fehlender erforderlicher Wert 'name' im Frontmatter von ${filePath}`);
  }
  if (!frontmatter.description) {
    throw new Error(`Fehlender erforderlicher Wert 'description' im Frontmatter von ${filePath}`);
  }

  // Normalisierung
  const result = {
    schemaVersion: CLAW_SCHEMA_VERSION,
    sourceFormat: 'skill-md',
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version || '0.0.0',
    author: frontmatter.author || null,
    license: frontmatter.license || null,
    permissions: Array.isArray(frontmatter.permissions) ? frontmatter.permissions : [],
    entryPoint: frontmatter.entry || null,
    dependencies: {},
    sourcePath: path.resolve(filePath),
    rawBody: rawBody
  };

  return result;
}

/**
 * Parst eine openclaw.plugin.json-Datei und gibt das normierte Skill-Schema zurück.
 * @param {string} filePath - Pfad zur JSON-Datei
 * @returns {Object} - Normiertes Skill-Schema
 */
function parsePluginJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new Error(`Ungültige JSON-Datei ${filePath}: ${err.message}`);
  }

  // Validierung
  if (!data.name) {
    throw new Error(`Fehlender erforderlicher Wert 'name' in ${filePath}`);
  }
  if (!data.version) {
    throw new Error(`Fehlender erforderlicher Wert 'version' in ${filePath}`);
  }
  if (!data.main) {
    throw new Error(`Fehlender erforderlicher Wert 'main' in ${filePath}`);
  }

  // Normalisierung
  const result = {
    schemaVersion: CLAW_SCHEMA_VERSION,
    sourceFormat: 'plugin-json',
    name: data.name,
    description: data.description || '',
    version: data.version,
    author: data.author || null,
    license: data.license || null,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    entryPoint: data.main,
    dependencies: data.dependencies || {},
    sourcePath: path.resolve(filePath),
    rawBody: null
  };

  return result;
}

/**
 * Parst ein Claw-Verzeichnis und wählt den passenden Parser basierend auf der vorhandenen Manifest-Datei.
 * @param {string} dirPath - Pfad zum Claw-Verzeichnis
 * @returns {Object} - Normiertes Skill-Schema
 */
function parseClawDirectory(dirPath) {
  const skillMdPath = path.join(dirPath, 'SKILL.md');
  const pluginJsonPath = path.join(dirPath, 'openclaw.plugin.json');

  const hasSkillMd = fs.existsSync(skillMdPath);
  const hasPluginJson = fs.existsSync(pluginJsonPath);

  if (!hasSkillMd && !hasPluginJson) {
    throw new Error(`Keine Manifest-Datei gefunden in ${dirPath}. Erwartet: SKILL.md oder openclaw.plugin.json`);
  }

  if (hasSkillMd && hasPluginJson) {
    throw new Error(`Mehrdeutige Manifest-Dateien in ${dirPath}. Nur eine erlaubt: SKILL.md oder openclaw.plugin.json`);
  }

  if (hasSkillMd) {
    return parseSkillMd(skillMdPath);
  } else {
    return parsePluginJson(pluginJsonPath);
  }
}

module.exports = {
  parseClawDirectory,
  parseSkillMd,
  parsePluginJson,
  CLAW_SCHEMA_VERSION
};
