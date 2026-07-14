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
 * @file backend/tools/piper-tts.tool.js
 * @description Piper TTS lokal — Text-zu-Sprache ohne Cloud, DSGVO-konform, $0
 */
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TOOL_NAME = "piper_tts_synthesize";

const VOICE_MODELS = {
  "de": path.join(os.homedir(), "piper-voices", "de_DE-thorsten-medium.onnx"),
  "en": path.join(os.homedir(), "piper-voices", "en_US-lessac-medium.onnx"),
};

const definition = {
  name: TOOL_NAME,
  description: "Synthesizes text to speech using Piper TTS locally.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to synthesize.",
      },
      outputPath: {
        type: "string",
        description: "The path to save the output WAV file. Defaults to /tmp/ki-os-tts-<timestamp>.wav.",
        nullable: true,
      },
      voice: {
        type: "string",
        description: "The voice to use. Supported: 'de', 'en'. Defaults to 'de'.",
        enum: Object.keys(VOICE_MODELS),
        default: "de",
      },
    },
    required: ["text"],
  },
};

/**
 * Synthesizes text to speech using Piper TTS locally.
 * @param {object} params - The parameters for synthesis.
 * @param {string} params.text - The text to synthesize.
 * @param {string} [params.outputPath] - The path to save the output WAV file. Defaults to /tmp/ki-os-tts-<timestamp>.wav.
 * @param {string} [params.voice="de"] - The voice to use. Supported: 'de', 'en'.
 * @returns {Promise<{success: true, outputPath: string, durationMs: number} | {success: false, error: string}>}
 */
async function execute({ text, outputPath, voice = "de" }) {
  return new Promise(async (resolve) => {
    const defaultOutputPath = path.join(
      os.tmpdir(),
      `ki-os-tts-${Date.now()}.wav`
    );
    const finalOutputPath = outputPath || defaultOutputPath;
    const outputDir = path.dirname(finalOutputPath);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (err) {
        return resolve({ success: false, error: `Failed to create output directory: ${err.message}` });
      }
    }

    const piperBinary = await findPiperBinary();
    if (!piperBinary) {
      return resolve({ success: false, error: "Piper binary not found. Please install Piper and ensure it's in your PATH or at ~/piper/piper." });
    }

    const voiceModelPath = VOICE_MODELS[voice];
    if (!voiceModelPath || !fs.existsSync(voiceModelPath)) {
      return resolve({ success: false, error: `Voice model for "${voice}" not found at ${voiceModelPath}.` });
    }

    const piperArgs = [
      "--model",
      voiceModelPath,
      "--output_file",
      finalOutputPath,
    ];

    const piperProcess = spawn(piperBinary, piperArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Echo text to piper's stdin
    piperProcess.stdin.write(text);
    piperProcess.stdin.end();

    let stderrOutput = "";
    piperProcess.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    let stdoutOutput = "";
    piperProcess.stdout.on("data", (data) => {
      stdoutOutput += data.toString();
    });

    const timeout = 30000; // 30 seconds
    const timeoutId = setTimeout(() => {
      piperProcess.kill();
      resolve({ success: false, error: `Piper TTS synthesis timed out after ${timeout / 1000} seconds.` });
    }, timeout);

    piperProcess.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        if (fs.existsSync(finalOutputPath)) {
          const stats = fs.statSync(finalOutputPath);
          const durationMs = Math.round(stats.size / (16000 * 2)); // Approximation for 16kHz mono 16-bit PCM
          resolve({ success: true, outputPath: finalOutputPath, durationMs });
        } else {
          resolve({ success: false, error: `Piper process exited successfully but output file was not found at ${finalOutputPath}. Stderr: ${stderrOutput}` });
        }
      } else {
        resolve({ success: false, error: `Piper TTS synthesis failed with code ${code}. Stderr: ${stderrOutput}` });
      }
    });

    piperProcess.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({ success: false, error: `Failed to start Piper process: ${err.message}` });
    });
  });
}

async function findPiperBinary() {
  return new Promise((resolve) => {
    const checkPath = (command, fallbackPath) => {
      const proc = spawn(command, ["which", "piper"], { stdio: "pipe" });
      let foundPath = "";
      proc.stdout.on("data", (data) => {
        foundPath = data.toString().trim();
      });
      proc.on("close", (code) => {
        if (code === 0 && foundPath && fs.existsSync(foundPath)) {
          resolve(foundPath);
        } else {
          if (fallbackPath && fs.existsSync(fallbackPath)) {
            resolve(fallbackPath);
          } else {
            resolve(null);
          }
        }
      });
      proc.on("error", () => {
        if (fallbackPath && fs.existsSync(fallbackPath)) {
          resolve(fallbackPath);
        } else {
          resolve(null);
        }
      });
    };

    // Try "which piper" first
    checkPath("which", path.join(os.homedir(), "piper", "piper"));
  });
}

module.exports = {
  TOOL_NAME,
  definition,
  execute,
};

