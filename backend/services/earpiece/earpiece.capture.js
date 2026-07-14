/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const { spawn } = require('child_process');
const { AUDIO_ISOLATION_RULE } = require('../../schemas/presence.schema');

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const EARPIECE_DRY_RUN = process.env.EARPIECE_DRY_RUN === 'true';
const DEFAULT_CHUNK_SECS = parseInt(process.env.EARPIECE_CHUNK_SECS) || 5;
const SAMPLE_RATE = parseInt(process.env.EARPIECE_SAMPLE_RATE) || 16000;

let ffmpegProcess = null;
let accumulatedBuffer = Buffer.alloc(0);
let chunkInterval = null;
let startTime = null;
let chunkCount = 0;
let currentOptions = null;
let status = {
  running: false,
  source: null,
  deviceIndex: null,
  chunkCount: 0,
  elapsedSecs: 0
};

async function listDevices() {
  return new Promise((resolve, reject) => {
    const args = ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'];
    const ffmpeg = spawn(FFMPEG_PATH, args);

    let output = '';
    let errorOutput = '';

    ffmpeg.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
        return;
      }

      const devices = [];
      const lines = errorOutput.split('\n');
      let inAudioDevices = false;

      for (const line of lines) {
        if (line.includes('[AVFoundation indev')) {
          inAudioDevices = true;
          continue;
        }

        if (inAudioDevices && line.includes(']')) {
          const match = line.match(/\[(\d+)\] (.+)/);
          if (match) {
            devices.push({
              index: parseInt(match[1]),
              name: match[2].trim()
            });
          }
        }
      }

      resolve(devices);
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

function startCapture(options) {
  if (status.running) {
    throw new Error('Capture is already running');
  }

  // Validate options
  if (!options || !options.source) {
    throw new Error('Invalid options: source is required');
  }

  if (options.source === 'blackhole' && options.blackholeIndex === undefined) {
    throw new Error('BlackHole device index is required for blackhole source');
  }

  if (options.source === 'both' && (options.deviceIndex === undefined || options.blackholeIndex === undefined)) {
    throw new Error('Both device indices are required for "both" source');
  }

  // Audio isolation check
  if (AUDIO_ISOLATION_RULE.GUARD_CHECK_REQUIRED) {
    const ttsOutputDevice = process.env.TTS_OUTPUT_DEVICE_INDEX;
    if (ttsOutputDevice && options.deviceIndex !== undefined &&
        parseInt(ttsOutputDevice) === options.deviceIndex) {
      throw new Error('Audio isolation violation: capture device cannot be TTS output device');
    }
  }

  currentOptions = {
    source: options.source,
    deviceIndex: options.deviceIndex,
    blackholeIndex: options.blackholeIndex,
    chunkSecs: options.chunkSecs || DEFAULT_CHUNK_SECS,
    onChunk: options.onChunk,
    onError: options.onError
  };

  if (EARPIECE_DRY_RUN) {
    startDryRun();
    return;
  }

  const args = buildFfmpegArgs(currentOptions);

  try {
    ffmpegProcess = spawn(FFMPEG_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    startTime = Date.now();
    chunkCount = 0;
    status = {
      running: true,
      source: currentOptions.source,
      deviceIndex: currentOptions.deviceIndex,
      chunkCount: 0,
      elapsedSecs: 0
    };

    // Setup chunk interval
    chunkInterval = setInterval(() => {
      if (accumulatedBuffer.length > 0) {
        const chunk = Buffer.from(accumulatedBuffer);
        accumulatedBuffer = Buffer.alloc(0);

        if (currentOptions.onChunk) {
          currentOptions.onChunk(chunk, currentOptions.source);
        }

        chunkCount++;
        status.chunkCount = chunkCount;
        status.elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
      }
    }, currentOptions.chunkSecs * 1000);

    // Handle ffmpeg output
    ffmpegProcess.stdout.on('data', (data) => {
      accumulatedBuffer = Buffer.concat([accumulatedBuffer, data]);
    });

    // Handle errors
    ffmpegProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      if (currentOptions.onError) {
        currentOptions.onError(new Error(`ffmpeg error: ${errorMsg}`));
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0 && currentOptions.onError) {
        currentOptions.onError(new Error(`ffmpeg process exited with code ${code}`));
      }
      cleanup();
    });

    ffmpegProcess.on('error', (err) => {
      if (currentOptions.onError) {
        currentOptions.onError(err);
      }
      cleanup();
    });

  } catch (err) {
    if (currentOptions.onError) {
      currentOptions.onError(err);
    }
    cleanup();
    throw err;
  }
}

function buildFfmpegArgs(options) {
  const args = ['-f', 'avfoundation'];

  if (options.source === 'mic') {
    args.push('-i', `:${options.deviceIndex}`);
  } else if (options.source === 'blackhole') {
    args.push('-i', `:${options.blackholeIndex}`);
  } else if (options.source === 'both') {
    // For 'both' source, we need to handle it differently as ffmpeg can't capture from multiple sources simultaneously
    // This is a simplified approach - in a real implementation, you might need a more complex solution
    args.push('-i', `:${options.deviceIndex}`);
  }

  // Common audio processing args
  args.push(
    '-ar', SAMPLE_RATE.toString(),
    '-ac', '1',
    '-f', 'wav'
  );

  // For streaming to pipe
  args.push('pipe:1');

  return args;
}

function startDryRun() {
  status = {
    running: true,
    source: currentOptions.source,
    deviceIndex: currentOptions.deviceIndex,
    chunkCount: 0,
    elapsedSecs: 0
  };

  startTime = Date.now();
  chunkCount = 0;

  chunkInterval = setInterval(() => {
    // Create a minimal WAV header (44 bytes) for dry run
    const mockBuffer = Buffer.alloc(44);
    mockBuffer.write('RIFF', 0);
    mockBuffer.writeUInt32LE(40, 4); // Chunk size
    mockBuffer.write('WAVE', 8);
    mockBuffer.write('fmt ', 12);
    mockBuffer.writeUInt32LE(16, 16); // Subchunk1 size
    mockBuffer.writeUInt16LE(1, 20); // Audio format (PCM)
    mockBuffer.writeUInt16LE(1, 22); // Num channels
    mockBuffer.writeUInt32LE(SAMPLE_RATE, 24); // Sample rate
    mockBuffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // Byte rate
    mockBuffer.writeUInt16LE(2, 32); // Block align
    mockBuffer.writeUInt16LE(16, 34); // Bits per sample
    mockBuffer.write('data', 36);
    mockBuffer.writeUInt32LE(0, 40); // Data size

    if (currentOptions.onChunk) {
      currentOptions.onChunk(mockBuffer, currentOptions.source);
    }

    chunkCount++;
    status.chunkCount = chunkCount;
    status.elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
  }, currentOptions.chunkSecs * 1000);
}

function stopCapture() {
  if (!status.running) {
    return;
  }

  if (chunkInterval) {
    clearInterval(chunkInterval);
    chunkInterval = null;
  }

  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill('SIGTERM');
    } catch (err) {
      console.error('Error stopping ffmpeg process:', err);
    }
    ffmpegProcess = null;
  }

  cleanup();
}

function cleanup() {
  accumulatedBuffer = Buffer.alloc(0);
  currentOptions = null;
  status.running = false;
}

function getStatus() {
  if (status.running && startTime) {
    status.elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
  }
  return { ...status };
}

module.exports = {
  startCapture,
  stopCapture,
  listDevices,
  getStatus
};
