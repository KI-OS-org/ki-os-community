/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 * @file backend/tools/whisper-local.tool.js
 * @description Whisper Large v3 lokal via mlx-whisper — kein OpenAI API-Call, $0 Kosten, DSGVO-konform
 */
"use strict";

const { spawn } = require("child_process");
const path = require("path");

const TOOL_NAME = "whisper_local_transcribe";

const definition = {
  name: TOOL_NAME,
  description: "Transkribiere Audio-Dateien lokal mit Whisper Large v3 (mlx-whisper) ohne API-Call",
  parameters: {
    type: "object",
    properties: {
      audioPath: {
        type: "string",
        description: "Pfad zur Audio-Datei (WAV, MP3, M4A)",
      },
      language: {
        type: "string",
        description: "Sprachcode (z.B. 'de' für Deutsch)",
        default: "de",
      },
    },
    required: ["audioPath"],
  },
};

async function execute({ audioPath, language = "de" }) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const command = path.join(process.env.HOME, "miniforge3/envs/mlx-lm/bin/mlx_whisper");
    const args = [
      "--model", "mlx-community/whisper-large-v3-mlx",
      "--language", language,
      "--output-format", "txt",
      audioPath
    ];

    const whisperProcess = spawn(command, args, {
      timeout: 60000, // 60s Timeout
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    let errorOutput = "";

    whisperProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    whisperProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    whisperProcess.on("error", (err) => {
      resolve({
        success: false,
        error: `Whisper-Prozess fehlgeschlagen: ${err.message}`
      });
    });

    whisperProcess.on("close", (code) => {
      const durationMs = Date.now() - startTime;

      if (code !== 0) {
        resolve({
          success: false,
          error: `Whisper-Prozess beendet mit Code ${code}. Fehler: ${errorOutput.trim()}`
        });
        return;
      }

      if (!output.trim()) {
        resolve({
          success: false,
          error: "Keine Transkription erhalten"
        });
        return;
      }

      resolve({
        success: true,
        text: output.trim(),
        language,
        durationMs
      });
    });
  });
}

module.exports = {
  TOOL_NAME,
  definition,
  execute
};

