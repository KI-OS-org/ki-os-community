/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const { AUDIO_ISOLATION_RULE } = require('../../schemas/presence.schema');

// Default-Schwellenwerte (kann durch ENV überschrieben werden)
const DEFAULT_THRESHOLDS = {
  silence: -50,
  whisperLow: -40,
  whisperHigh: -25,
  speech: -20
};

// Aktuelle Schwellenwerte (kann zur Laufzeit geändert werden)
let currentThresholds = {
  silence: parseFloat(process.env.VAD_SILENCE_THRESHOLD) || DEFAULT_THRESHOLDS.silence,
  whisperLow: parseFloat(process.env.VAD_WHISPER_LOW) || DEFAULT_THRESHOLDS.whisperLow,
  whisperHigh: parseFloat(process.env.VAD_WHISPER_HIGH) || DEFAULT_THRESHOLDS.whisperHigh,
  speech: parseFloat(process.env.VAD_SPEECH_THRESHOLD) || DEFAULT_THRESHOLDS.speech
};

// Referenz-dBFS des Nutzers für Sprecherkennung
let userReferenceDbFS = null;

/**
 * Analysiert PCM-Audio-Daten und erkennt Sprachaktivität
 * @param {Float32Array} pcmBuffer - Rohe PCM-Daten (16kHz Mono)
 * @returns {Object} Analyseergebnis mit dBFS, Aktivitätsflags
 */
function analyzePCM(pcmBuffer) {
  // RMS-Berechnung
  let sum = 0;
  for (let i = 0; i < pcmBuffer.length; i++) {
    sum += pcmBuffer[i] * pcmBuffer[i];
  }
  const rms = Math.sqrt(sum / pcmBuffer.length);

  // dBFS-Berechnung
  const dbfs = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

  // Aktivitätsflags
  const isActive = dbfs > currentThresholds.silence;
  const isWhisper = dbfs > currentThresholds.whisperLow && dbfs <= currentThresholds.whisperHigh;
  const isSpeaking = isActive && dbfs > currentThresholds.speech;

  // Nutzer-Sprecherkennung (wenn kalibriert)
  let isUserSpeaking = false;
  if (userReferenceDbFS !== null && isSpeaking) {
    // Toleranzbereich von ±5dB um die Referenz
    isUserSpeaking = Math.abs(dbfs - userReferenceDbFS) <= 5;
  }

  return {
    dbfs,
    isActive,
    isWhisper,
    isSpeaking: isUserSpeaking || isSpeaking, // Nutzer hat Vorrang
    isUserSpeaking
  };
}

/**
 * Gibt aktuelle Schwellenwerte zurück
 * @returns {Object} Aktuelle Schwellenwerte
 */
function getThresholds() {
  return { ...currentThresholds };
}

/**
 * Setzt einen Schwellenwert zur Laufzeit
 * @param {string} name - Name des Schwellenwerts (silence, whisperLow, whisperHigh, speech)
 * @param {number} value - Neuer Wert
 */
function setThreshold(name, value) {
  if (currentThresholds.hasOwnProperty(name)) {
    currentThresholds[name] = value;
  }
}

/**
 * Kalibriert den Nutzer durch Speicherung der Referenz-dBFS
 * @param {Float32Array} pcmSamples - PCM-Audio-Daten des Nutzers
 */
function calibrateUser(pcmSamples) {
  const analysis = analyzePCM(pcmSamples);
  if (analysis.isSpeaking) {
    userReferenceDbFS = analysis.dbfs;
  }
}

module.exports = {
  analyzePCM,
  getThresholds,
  setThreshold,
  calibrateUser,
  AUDIO_ISOLATION_RULE
};
