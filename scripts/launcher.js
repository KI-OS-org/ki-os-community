#!/usr/bin/env node
/**
 * KI-OS Community Edition — Launcher
 * 
 * Desktop-App Launcher mit GUI
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ASCII Logo
const LOGO = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║      ██████╗ ██╗████████╗██╗  ██╗██╗   ██╗██████╗     ███████╗ ██████╗ ███╗   ██╗
║     ██╔════╝ ██║╚══██╔══╝██║  ██║██║   ██║██╔══██╗    ██╔════╝██╔═══██╗████╗  ██║
║     ██║  ███╗██║   ██║   ███████║██║   ██║██████╔╝    ███████╗██║   ██║██╔██╗ ██║
║     ██║   ██║██║   ██║   ██╔══██║██║   ██║██╔══██╗    ╚════██║██║   ██║██║╚██╗██║
║     ╚██████╔╝██║   ██║   ██║  ██║╚██████╔╝██║  ██║    ███████║╚██████╔╝██║ ╚████║
║      ╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝    ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝
║                                                                              ║
║                          Community Edition · v1.1.1-security                 ║
║                          AI Operating System · AGPL-3.0                      ║
║                                                                              ║
║     📚 Books available: April 15, 2026 — ki-os.org/buch                      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

console.log(LOGO);
console.log('\n🚀 Starting KI-OS Community Edition...\n');

const ROOT_DIR = __dirname;
const SERVER_SCRIPT = path.join(ROOT_DIR, 'runtime', 'local', 'server.js');

// Check if server.js exists
if (!fs.existsSync(SERVER_SCRIPT)) {
  console.error('❌ Error: server.js not found!');
  console.error('   Please ensure you are in the correct directory.');
  process.exit(1);
}

// Start server
const server = spawn('node', [SERVER_SCRIPT], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  env: {
    ...process.env,
    KI_OS_EDITION: 'community',
    PORT: process.env.PORT || '8080'
  }
});

server.on('error', (err) => {
  console.error('\n❌ Server error:', err.message);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`\n\nServer exited with code ${code}`);
  if (code !== 0) {
    console.log('\nPress any key to exit...');
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.exit(code);
    });
  }
  process.exit(code || 0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  server.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});
