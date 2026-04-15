#!/usr/bin/env node
/**
 * KI-OS Community Edition — Startup Script
 * 
 * Automatisierte Installation und Start von KI-OS
 * - Prüft Node.js Version
 * - Installiert Dependencies (wenn nötig)
 * - Bereinigt alte Prozesse
 * - Validiert Konfiguration
 * - Startet den Server
 */

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─────────────────────────────────────────────────────────────────────────────
// Konfiguration
// ─────────────────────────────────────────────────────────────────────────────

const ROOT_DIR = __dirname;
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
const NODE_MODULES = path.join(ROOT_DIR, 'node_modules');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const ENV_EXAMPLE = path.join(ROOT_DIR, '.env.example');

const MIN_NODE_VERSION = 20;
const COMMUNITY_PORT = process.env.PORT || 8080;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function printBanner() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          KI-OS Community Edition — Startup Script             ║');
  console.log('║                     Version 1.1.1-security                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
}

function printStep(step, message) {
  console.log(`[${step}] ${message}`);
}

function printError(message) {
  console.error(`❌ ERROR: ${message}`);
}

function printSuccess(message) {
  console.log(`✅ ${message}`);
}

function printWarning(message) {
  console.log(`⚠️  WARNING: ${message}`);
}

function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, ...options.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return { success: true, code: 0 };
  } catch (error) {
    if (options.ignoreError) {
      return { success: false, code: error.status || 1, error };
    }
    throw error;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function directoryExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function isNodeModulesComplete() {
  if (!directoryExists(NODE_MODULES)) return false;
  
  // Prüfe ob wichtige Pakete installiert sind
  const requiredPackages = ['express', 'cors', 'dotenv'];
  for (const pkg of requiredPackages) {
    const pkgPath = path.join(NODE_MODULES, pkg, 'package.json');
    if (!fileExists(pkgPath)) return false;
  }
  return true;
}

function getNodeVersion() {
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    const match = version.match(/v(\d+)\./);
    return match ? parseInt(match[1]) : null;
  } catch {
    return null;
  }
}

function checkPortInUse(port) {
  try {
    if (process.platform === 'win32') {
      // Windows: netstat verwenden
      const result = execSync(`netstat -ano | findstr :${port}`, { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'ignore'] 
      });
      if (result.trim()) {
        // PID extrahieren
        const lines = result.trim().split('\n');
        const pids = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        }).filter(pid => !isNaN(parseInt(pid)));
        return pids;
      }
    } else {
      // Unix/Linux/Mac: lsof verwenden
      const result = execSync(`lsof -i :${port} -t`, { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'ignore'] 
      });
      if (result.trim()) {
        return result.trim().split('\n').filter(Boolean);
      }
    }
    return [];
  } catch {
    return [];
  }
}

function killProcess(pid, force = false) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill ${force ? '/F' : ''} /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

function createEnvFile() {
  if (fileExists(ENV_FILE)) {
    printStep('✓', '.env existiert bereits');
    return;
  }
  
  if (!fileExists(ENV_EXAMPLE)) {
    printWarning('.env.example nicht gefunden — erstelle minimale .env');
    fs.writeFileSync(ENV_FILE, 'KI_OS_EDITION=community\nNODE_ENV=production\nPORT=8080\n');
    return;
  }
  
  printStep('i', 'Kopiere .env.example nach .env');
  fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
  printSuccess('.env erstellt');
}

function validateEnvFile() {
  if (!fileExists(ENV_FILE)) {
    printError('.env Datei nicht gefunden');
    return false;
  }
  
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  
  // Prüfe ob mindestens ein Provider konfiguriert ist
  const hasProvider = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'DASHSCOPE_API_KEY'
  ].some(key => {
    const regex = new RegExp(`${key}\\s*=\\s*.+`, 'i');
    return regex.test(content);
  });
  
  if (!hasProvider) {
    printWarning('Kein AI Provider API Key in .env konfiguriert');
    printWarning('KI-OS wird im Demo-Modus starten (eingeschränkte Funktionalität)');
    printWarning('Bearbeite .env und füge mindestens einen API Key hinzu');
  }
  
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptfunktionen
// ─────────────────────────────────────────────────────────────────────────────

async function checkNodeVersion() {
  printStep('1', 'Prüfe Node.js Version');
  
  const version = getNodeVersion();
  if (!version) {
    printError('Node.js nicht installiert oder nicht im PATH');
    process.exit(1);
  }
  
  if (version < MIN_NODE_VERSION) {
    printError(`Node.js Version ${version} ist zu alt (minimum ${MIN_NODE_VERSION})`);
    printError('Bitte Node.js aktualisieren: https://nodejs.org/');
    process.exit(1);
  }
  
  printSuccess(`Node.js v${version} ist installiert`);
}

async function checkAndKillProcesses() {
  printStep('2', 'Prüfe auf laufende KI-OS Prozesse');
  
  // Prüfe Port 8080 und 3000
  const ports = [COMMUNITY_PORT, 3000];
  let killedCount = 0;
  
  for (const port of ports) {
    const pids = checkPortInUse(port);
    if (pids.length > 0) {
      console.log(`  Port ${port} wird verwendet von PID(s): ${pids.join(', ')}`);
      
      for (const pid of pids) {
        console.log(`  Terminate PID ${pid}...`);
        
        // Erst sanft terminieren
        if (killProcess(pid, false)) {
          console.log(`  PID ${pid} sanft terminiert`);
          killedCount++;
          
          // Kurz warten
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Falls noch aktiv, forcefully kill
          const stillRunning = checkPortInUse(port);
          if (stillRunning.includes(pid)) {
            console.log(`  PID ${pid} reagiert nicht — force kill...`);
            if (killProcess(pid, true)) {
              console.log(`  PID ${pid} terminiert`);
            } else {
              printWarning(`Konnte PID ${pid} nicht terminieren`);
            }
          }
        } else {
          printWarning(`Konnte PID ${pid} nicht terminieren`);
        }
      }
    }
  }
  
  if (killedCount > 0) {
    printSuccess(`${killedCount} Prozess(e) terminiert`);
    // Kurz warten damit Ports frei werden
    await new Promise(resolve => setTimeout(resolve, 1000));
  } else {
    printStep('✓', 'Keine laufenden KI-OS Prozesse');
  }
}

async function installDependencies() {
  printStep('3', 'Prüfe Dependencies');
  
  if (isNodeModulesComplete()) {
    printSuccess('node_modules sind vollständig installiert');
    printStep('i', 'Überspringe npm install (bereits installiert)');
    return;
  }
  
  printStep('i', 'node_modules fehlen oder sind unvollständig — installiere...');
  
  // Prüfe ob package.json existiert
  if (!fileExists(PACKAGE_JSON)) {
    printError('package.json nicht gefunden');
    process.exit(1);
  }
  
  try {
    // npm install mit Optimierungen für Community Edition
    runCommand('npm install --no-audit --no-fund --prefer-offline', {
      env: { NODE_ENV: 'production' }
    });
    printSuccess('Dependencies installiert');
  } catch (error) {
    printError('npm install fehlgeschlagen');
    printError('Manuell ausführen: npm install');
    process.exit(1);
  }
}

async function setupEnvironment() {
  printStep('4', 'Validiere Umgebung');
  
  createEnvFile();
  validateEnvFile();
}

async function startServer() {
  printStep('5', 'Starte KI-OS Community Server');
  console.log('');
  
  // Server als Child Process starten (damit wir bei Ctrl+C sauber beenden können)
  const serverProcess = spawn('node', ['runtime/local/server.js'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      KI_OS_EDITION: 'community',
      PORT: String(COMMUNITY_PORT),
    },
  });
  
  serverProcess.on('error', (err) => {
    printError(`Server Start fehlgeschlagen: ${err.message}`);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    console.log('');
    if (code === 0) {
      printSuccess('KI-OS sauber beendet');
    } else {
      printError(`KI-OS beendet mit Code ${code}`);
    }
    process.exit(code || 0);
  });
  
  // SIGINT (Ctrl+C) abfangen
  process.on('SIGINT', () => {
    console.log('');
    printStep('i', 'Shutdown initiated...');
    serverProcess.kill('SIGTERM');
  });
  
  // SIGTERM abfangen
  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  printBanner();
  
  try {
    await checkNodeVersion();
    await checkAndKillProcesses();
    await installDependencies();
    await setupEnvironment();
    await startServer();
  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}

// Start
main().catch(err => {
  printError(err.message);
  process.exit(1);
});
