/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Claude Code Bridge — startet claude -p als Subprocess und gibt stdout zurück

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const CLAUDE_BIN_PATH = '/Users/is/.local/bin/claude';
const CODEX_BIN_PATH  = '/opt/homebrew/bin/codex';
const QWEN_BIN_PATH   = '/Users/is/.npm-global/bin/qwen';
const DEFAULT_ALLOWED_TOOLS = 'Edit,Write,Bash,Read,Glob,Grep';
const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes

async function runClaudeCode(prompt, options = {}) {
    const {
        allowedTools = DEFAULT_ALLOWED_TOOLS,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        cwd = process.cwd()
    } = options;

    return new Promise((resolve) => {
        const startTime = Date.now();
        let output = '';
        let errorOutput = '';

        const claudeProcess = spawn(CLAUDE_BIN_PATH, [
            '--print', '--dangerously-skip-permissions', '--', prompt,
        ], {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: timeoutMs,
            env: { ...process.env, HOME: '/Users/is', PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin' },
        });

        claudeProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        claudeProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        claudeProcess.on('close', (exitCode) => {
            const duration = Date.now() - startTime;
            const result = {
                output,
                duration,
                exitCode
            };

            if (errorOutput) {
                result.error = errorOutput;
            }

            resolve(result);
        });

        claudeProcess.on('error', (err) => {
            const duration = Date.now() - startTime;
            console.error('Claude process error:', err);
            resolve({
                output: '',
                duration,
                exitCode: -1,
                error: err.message
            });
        });
    });
}

async function claudeBridgeHandler(req, res) {
    try {
        const { prompt, allowedTools } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await runClaudeCode(prompt, {
            allowedTools: allowedTools || DEFAULT_ALLOWED_TOOLS
        });

        if (result.exitCode !== 0) {
            return res.status(500).json({
                error: result.error || 'Claude process failed',
                exitCode: result.exitCode
            });
        }

        res.json({
            output: result.output,
            duration: result.duration,
            exitCode: result.exitCode
        });
    } catch (err) {
        console.error('Claude bridge handler error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function runCodex(prompt, options = {}) {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, cwd = process.cwd() } = options;
    return new Promise((resolve) => {
        const startTime = Date.now();
        let output = '', errorOutput = '';
        const proc = spawn(CODEX_BIN_PATH, ['exec', prompt], {
            cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs
        });
        proc.stdout.on('data', d => { output += d.toString(); });
        proc.stderr.on('data', d => { errorOutput += d.toString(); });
        proc.on('close', exitCode => {
            resolve({ output, duration: Date.now() - startTime, exitCode, error: errorOutput || undefined });
        });
        proc.on('error', err => {
            resolve({ output: '', duration: Date.now() - startTime, exitCode: -1, error: err.message });
        });
    });
}

async function runQwen(prompt, options = {}) {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, cwd = process.cwd() } = options;
    return new Promise((resolve) => {
        const startTime = Date.now();
        let output = '', errorOutput = '';
        const proc = spawn(QWEN_BIN_PATH, ['-p', prompt], {
            cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs
        });
        proc.stdout.on('data', d => { output += d.toString(); });
        proc.stderr.on('data', d => { errorOutput += d.toString(); });
        proc.on('close', exitCode => {
            resolve({ output, duration: Date.now() - startTime, exitCode, error: errorOutput || undefined });
        });
        proc.on('error', err => {
            resolve({ output: '', duration: Date.now() - startTime, exitCode: -1, error: err.message });
        });
    });
}

module.exports = {
    runClaudeCode,
    runCodex,
    runQwen,
    claudeBridgeHandler
};
