#!/usr/bin/env node
/**
 * KI-OS Community Edition — Startup Script
 *
 * Vollständiger Start-Assistent für KI-OS Community
 * - ASCII Logo beim Start
 * - Interaktives Setup (minimale Konfiguration)
 * - Advanced-Optionen (optional einblendbar)
 * - Automatische Umgebungskonfiguration
 * - Health-Check und Server-Start
 *
 * Aufruf: node start.js
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
const DEFAULT_PORT = 8080;

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Logo — KI-OS
// ─────────────────────────────────────────────────────────────────────────────

const ASCII_LOGO = `                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                    ==================++++++++=+                                    
                               ------:::-=======-------:::.:-=====---                               
                            +---:.:::-----=====------:::::::.....:----==                            
                         ----:...:::::-----------::::::::::..........-==+++                         
                       ==-:.......::::::-=++*****####***+-.............:-+++++                      
                     -=-:::::......:=+++**##%%%%%%%%%%%%#####+-.......::::-+++*# +.::-==            
                   ---::::::::..:===+#%%%#++===----=====++#%%%##*=..::::----=+-:.::-==+             
                 %--::::::::::-==*#%#*=-:.................::-=+#%%##+:---::.::::::--=-              
                ---.:::::::.--=#%%+-:..........................--=#%#-.:::.:===---+#                
               --:..:::::.:--*%#=:...............................:::---:-****#**+====+              
              =-:........--+##+:................................-::--==.+#%*+==-------=             
             ==-........::+#*-..........-+*************+=-......==------:::=+=----------            
            +++.:::....::+#+-.......-*%%%%###*****######%%%%#=:..-+=-:::......-==---=====           
           ***:::::::.::+#+-......-%*=-::...............::::--=-..:-++:..........:-======           
           ##+:-----.:-=##-:......-%%%%#+:...................:::-...:-+*+:...::::::.:===++          
           %%-=====-:==*%=-.......:%%%%##-.......-######-.-####%%-....:-+%#=:::-:::...:+++          
          #%#=++++=-:=+##-:........#%%###+......+#####*:..:*###%%+......:+%%%+:.:....:::=+*         
          %%#++++++--++%*-:........=%#####....-%#####+.....+###%%*:.....::*%%@@=...::---:=*         
          %%#+*****==+*%*-:.........%####%=.:*%####*:......-%%%%%%=......::#%@@@*:.-------=*        
          %@%*###**+=+*%*-:.........*%%%%%*-%%%%%%*.........%%%%%%+......::+#%@@@+.:--===--+        
          %@%*#####*=**%%=-.........-%%%%%%%%%%%%%%*:.......+%%%%%#:......:=##%%%#-:=++++=-=        
          %@@+#####*=++#%+-:........:#%%%%%#:+%%%%%%%+.......%%%%%%-.....::=*##%%#=-+**++===        
          %@@#=#####=-=+%#=-:........+%%%%%%-..+%%%%%%%=.....*%%%%%*....:::=+*###+--+++++===        
          =%%%=+###**:-==%*=-:.......=%%%%%%+...:*%%%%%%#-...-%%%%%%...:::-++###*-:-====-=+-        
           %%%%-****++.:-=%+=-:......:#%%%%%#:....:*%%%%%%*:.:*#%%%%=...::==####=.:------++         
           %%%%*-+++++=:-=+%*==-:.....=#%@@@@=......:*%%%%%%-.=###**=::.:-=##*+-..:::::-++          
            %%%%*-++++++:=++%%+==-.....................................:==##*=...::::::+*+          
            @%%%%#-******=-+*#%#+==-:.................................-=+###+..:::::::***           
              %%%%%=*******=+**#%#+===:........:::..................:-+###*-:-==----=***#           
               %%%%%*+#####**=+*##%%+====-...::::::::::::::::....:--+###*-:=+++===-**##@            
                %%%%%%+*####***==*###%#+====--::...........:::---+*###+::-==++++=+*###              
                 @%%%%%#=*#****++=-=*####%%*=----------------+#####+..:---====-+**#%#               
                  @%%%%%%%++*+++=====---++***####*****###%%%%#*=:..:::::-----+***#%@                
                     %@%%%%%#-==+=======-::...:--==++++=-:...::-::::::::::=+==+#%%                  
                      %@@%%%%%%*+======---:::::::------------------:::-=++=++##%                    
                         %@@%%%%%%#*-:---:::::::---------------:::-++++++*###%                      
                           %@@@@%%#####**+=-:...::::::::::---====++++**####                         
                              @%@@@@%################****++++====++***#                             
                                  @@@@@@@@@%%%%%%%#######***++===+**                                
                                        %%@@@%%%%%%%%%#####***                                      
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    /`;

const SEPARATOR = '═'.repeat(70);

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function printLogo() {
  console.log(ASCII_LOGO);
}

function printCentered(text, char = ' ') {
  const width = 70;
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  console.log(char.repeat(padding) + text);
}

function printStep(step, message) {
  console.log(`  [${step}] ${message}`);
}

function printError(message) {
  console.error(`  ❌ ERROR: ${message}`);
}

function printSuccess(message) {
  console.log(`  ✅ ${message}`);
}

function printWarning(message) {
  console.log(`  ⚠️  WARNING: ${message}`);
}

function printInfo(message) {
  console.log(`  ℹ️  ${message}`);
}

function clearScreen() {
  console.clear();
}

function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      env: { ...process.env, ...options.env },
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, code: 0, output: result.toString('utf8') };
  } catch (error) {
    if (options.ignoreError) {
      return { success: false, code: error.status || 1, error, output: error.message };
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
      const result = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      if (result.trim()) {
        const lines = result.trim().split('\n');
        return lines.map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        }).filter(pid => !isNaN(parseInt(pid)));
      }
    } else {
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

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Prompt
// ─────────────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question, defaultValue = '') {
  return new Promise((resolve) => {
    const promptText = defaultValue 
      ? `${question} [${defaultValue}]: ` 
      : `${question}: `;
    rl.question(promptText, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function promptHidden(question) {
  return new Promise((resolve) => {
    rl.question(question + ': ', (answer) => {
      resolve(answer.trim());
    });
  });
}

function promptConfirm(question, defaultValue = false) {
  return new Promise((resolve) => {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    rl.question(`${question} [${defaultText}]: `, (answer) => {
      if (answer === '') {
        resolve(defaultValue);
      } else {
        resolve(['y', 'yes', 'ja', '1', 'true'].includes(answer.toLowerCase()));
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration State
// ─────────────────────────────────────────────────────────────────────────────

const config = {
  port: DEFAULT_PORT,
  provider: '',
  apiKey: '',
  memoryBackend: 'file',
  advancedMode: false,
  allowedOrigins: '',
  logLevel: 'info',
};

// ─────────────────────────────────────────────────────────────────────────────
// Setup Wizard
// ─────────────────────────────────────────────────────────────────────────────

async function runSetupWizard() {
  console.log('');
  printCentered('KI-OS Community Edition — Setup Wizard', ' ');
  console.log('');
  printCentered('Konfiguriere dein KI-OS für den ersten Start', ' ');
  console.log('');
  console.log(`  ${SEPARATOR}`);
  console.log('');

  // Port konfigurieren
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │  SCHRITT 1/4: Server Port                                  │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');
  printInfo('Auf welchem Port soll KI-OS laufen?');
  const portInput = await prompt('  Port', String(DEFAULT_PORT));
  config.port = parseInt(portInput) || DEFAULT_PORT;
  printSuccess(`Port ${config.port} wird verwendet`);
  console.log('');

  // LLM Provider auswählen
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │  SCHRITT 2/4: AI Provider auswählen                        │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');
  printInfo('Welchen AI-Provider möchtest du verwenden?');
  console.log('');
  console.log('  1. Anthropic Claude (empfohlen)');
  console.log('  2. OpenAI GPT');
  console.log('  3. Google Gemini');
  console.log('  4. DeepSeek');
  console.log('  5. DashScope (Alibaba)');
  console.log('  6. OpenRouter (600+ Modelle)');
  console.log('  7. Demo-Modus (ohne API-Key, eingeschränkt)');
  console.log('');

  const providerChoice = await prompt('  Auswahl', '1');
  const providers = {
    '1': { name: 'anthropic', env: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-' },
    '2': { name: 'openai', env: 'OPENAI_API_KEY', prefix: 'sk-' },
    '3': { name: 'gemini', env: 'GOOGLE_GENERATIVE_AI_API_KEY', prefix: 'AIza' },
    '4': { name: 'deepseek', env: 'DEEPSEEK_API_KEY', prefix: 'sk-' },
    '5': { name: 'dashscope', env: 'DASHSCOPE_API_KEY', prefix: 'sk-' },
    '6': { name: 'openrouter', env: 'OPENROUTER_API_KEY', prefix: 'sk-or-' },
    '7': { name: 'demo', env: null, prefix: '' },
  };

  const selected = providers[providerChoice] || providers['1'];
  config.provider = selected.name;

  if (selected.name === 'demo') {
    printWarning('Demo-Modus aktiviert — eingeschränkte Funktionalität');
  } else {
    printSuccess(`${selected.name} wird verwendet`);
  }
  console.log('');

  // API Key eingeben
  if (selected.env) {
    console.log('  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  SCHRITT 3/4: API Key eingeben                             │');
    console.log('  └─────────────────────────────────────────────────────────────┘');
    console.log('');
    printInfo(`Gib deinen ${selected.name.toUpperCase()} API Key ein:`);
    console.log('');
    printInfo('Tipp: Du kannst den Key auch später in .env eintragen');
    console.log('');
    config.apiKey = await promptHidden(`  ${selected.env}`);
    if (config.apiKey) {
      printSuccess('API Key gespeichert');
    } else {
      printWarning('Kein API Key eingegeben — Demo-Modus aktiv');
    }
    console.log('');
  }

  // Advanced Optionen
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │  SCHRITT 4/4: Erweiterte Optionen                          │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');
  
  const showAdvanced = await promptConfirm('  Möchtest du erweiterte Optionen konfigurieren?', false);
  
  if (showAdvanced) {
    config.advancedMode = true;
    console.log('');
    printInfo('Erweiterte Konfiguration:');
    console.log('');
    
    config.allowedOrigins = await prompt('  CORS Allowed Origins (leer = localhost)', '');
    config.logLevel = await prompt('  Log Level', 'info');
    config.memoryBackend = await prompt('  Memory Backend', 'file');
    
    printSuccess('Erweiterte Optionen konfiguriert');
  } else {
    printSuccess('Standard-Konfiguration wird verwendet');
  }
  console.log('');

  console.log(`  ${SEPARATOR}`);
  console.log('');
  printSuccess('Setup abgeschlossen!');
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment File Management
// ─────────────────────────────────────────────────────────────────────────────

function createEnvFile() {
  const lines = [
    '# ════════════════════════════════════════════════════════════════════════',
    '# KI-OS Community Edition — Environment Configuration',
    '# Erstellt automatisch von start.js',
    '# ════════════════════════════════════════════════════════════════════════',
    '',
    '# ══ Basis-Konfiguration ════════════════════════════════════════════════',
    `KI_OS_EDITION=community`,
    `NODE_ENV=production`,
    `PORT=${config.port}`,
    '',
    '# ══ AI Provider ════════════════════════════════════════════════════════',
  ];

  if (config.provider && config.provider !== 'demo') {
    const providerEnv = {
      'anthropic': 'ANTHROPIC_API_KEY',
      'openai': 'OPENAI_API_KEY',
      'gemini': 'GOOGLE_GENERATIVE_AI_API_KEY',
      'deepseek': 'DEEPSEEK_API_KEY',
      'dashscope': 'DASHSCOPE_API_KEY',
      'openrouter': 'OPENROUTER_API_KEY',
    };
    if (providerEnv[config.provider] && config.apiKey) {
      lines.push(`${providerEnv[config.provider]}=${config.apiKey}`);
    } else {
      lines.push(`# ${providerEnv[config.provider]}=`);
    }
  } else {
    lines.push('# ANTHROPIC_API_KEY=');
    lines.push('# OPENAI_API_KEY=');
    lines.push('# OPENROUTER_API_KEY=');
  }

  lines.push('');
  lines.push('# ══ Memory ═══════════════════════════════════════════════════════');
  lines.push(`MEMORY_BACKEND=${config.memoryBackend}`);
  lines.push('');

  if (config.advancedMode) {
    lines.push('# ══ Advanced Options ═════════════════════════════════════════════');
    if (config.allowedOrigins) {
      lines.push(`ALLOWED_ORIGINS=${config.allowedOrigins}`);
    }
    lines.push(`LOG_LEVEL=${config.logLevel}`);
    lines.push('');
  }

  lines.push('# ══ Optional: Weitere Provider ══════════════════════════════════');
  lines.push('# OPENAI_API_KEY=');
  lines.push('# GOOGLE_GENERATIVE_AI_API_KEY=');
  lines.push('# DEEPSEEK_API_KEY=');
  lines.push('# DASHSCOPE_API_KEY=');
  lines.push('');

  const content = lines.join('\n');
  fs.writeFileSync(ENV_FILE, content, 'utf8');
  printSuccess('.env Datei erstellt');
}

function loadExistingEnv() {
  if (!fileExists(ENV_FILE)) return null;
  
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Checks
// ─────────────────────────────────────────────────────────────────────────────

async function checkNodeVersion() {
  printStep('1', 'Prüfe Node.js Version');
  
  const version = getNodeVersion();
  if (!version) {
    printError('Node.js nicht installiert oder nicht im PATH');
    console.log('');
    console.log('  Bitte Node.js installieren: https://nodejs.org/');
    console.log('  Mindestversion: Node.js 20');
    console.log('');
    return false;
  }
  
  if (version < MIN_NODE_VERSION) {
    printError(`Node.js Version ${version} ist zu alt (minimum ${MIN_NODE_VERSION})`);
    console.log('');
    console.log('  Bitte Node.js aktualisieren: https://nodejs.org/');
    console.log('');
    return false;
  }
  
  printSuccess(`Node.js v${version} ist installiert`);
  return true;
}

async function checkAndKillProcesses() {
  printStep('2', 'Prüfe laufende Prozesse');
  
  const ports = [config.port, 3000];
  let killedCount = 0;
  
  for (const port of ports) {
    const pids = checkPortInUse(port);
    if (pids.length > 0) {
      console.log(`  Port ${port} wird verwendet von PID(s): ${pids.join(', ')}`);
      
      for (const pid of pids) {
        console.log(`  Terminate PID ${pid}...`);
        
        if (killProcess(pid, false)) {
          console.log(`  PID ${pid} sanft terminiert`);
          killedCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
          
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
  
  printStep('i', 'node_modules fehlen — installiere...');
  
  if (!fileExists(PACKAGE_JSON)) {
    printError('package.json nicht gefunden');
    return false;
  }
  
  try {
    console.log('  Führe npm install aus...');
    runCommand('npm install --no-audit --no-fund --prefer-offline', {
      env: { NODE_ENV: 'production' }
    });
    printSuccess('Dependencies installiert');
  } catch (error) {
    printError('npm install fehlgeschlagen');
    printError('Manuell ausführen: npm install');
    return false;
  }
  
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

async function checkHealth(port) {
  const http = require('http');
  
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: true, data: json });
        } catch {
          resolve({ ok: false, error: 'Ungültige Antwort' });
        }
      });
    });
    
    req.on('error', (e) => {
      resolve({ ok: false, error: e.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Start
// ─────────────────────────────────────────────────────────────────────────────

function startServer() {
  printStep('5', 'Starte KI-OS Community Server');
  console.log('');
  console.log(`  ═══════════════════════════════════════════════════════════════`);
  console.log('');
  console.log(`  Server Konfiguration:`);
  console.log(`    • Port:      http://localhost:${config.port}`);
  console.log(`    • Edition:   Community`);
  console.log(`    • Provider:  ${config.provider || 'Demo-Modus'}`);
  console.log(`    • Memory:    ${config.memoryBackend}`);
  if (config.advancedMode) {
    console.log(`    • Log Level: ${config.logLevel}`);
  }
  console.log('');
  console.log(`  ═══════════════════════════════════════════════════════════════`);
  console.log('');
  printInfo('Server startet... (Strg+C zum Beenden)');
  console.log('');
  
  const serverProcess = spawn('node', ['runtime/local/server.js'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      KI_OS_EDITION: 'community',
      PORT: String(config.port),
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
  
  process.on('SIGINT', () => {
    console.log('');
    printStep('i', 'Shutdown initiated...');
    serverProcess.kill('SIGTERM');
  });
  
  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Start (bei bestehender Konfiguration)
// ─────────────────────────────────────────────────────────────────────────────

async function quickStart() {
  const existingEnv = loadExistingEnv();

  if (existingEnv) {
    config.port = parseInt(existingEnv.PORT) || DEFAULT_PORT;

    const hasProvider = [
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'DEEPSEEK_API_KEY',
      'DASHSCOPE_API_KEY',
      'OPENROUTER_API_KEY'
    ].some(key => existingEnv[key] && existingEnv[key].length > 5);

    if (hasProvider) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  clearScreen();
  printLogo();
  console.log('');
  
  // Prüfen ob .env bereits existiert und konfiguriert ist
  const hasConfig = await quickStart();
  
  if (!hasConfig) {
    // Setup Wizard ausführen
    await runSetupWizard();
    
    // .env Datei erstellen
    console.log('  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  Konfiguration speichern                                     │');
    console.log('  └─────────────────────────────────────────────────────────────┘');
    console.log('');
    createEnvFile();
    console.log('');
  } else {
    printSuccess('Bestehende Konfiguration gefunden');
    const env = loadExistingEnv();
    config.port = parseInt(env.PORT) || DEFAULT_PORT;
    console.log('');
  }
  
  // System Checks
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │  System Checks                                               │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');
  
  const nodeOk = await checkNodeVersion();
  if (!nodeOk) {
    process.exit(1);
  }
  console.log('');
  
  await checkAndKillProcesses();
  console.log('');
  
  const depsOk = await installDependencies();
  if (!depsOk) {
    process.exit(1);
  }
  console.log('');
  
  // Health Check vor Server Start
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │  Health Check                                                │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');
  printStep('4', 'Prüfe Server Gesundheit');
  
  const healthBefore = await checkHealth(config.port);
  if (healthBefore.ok) {
    printWarning(`Server läuft bereits auf Port ${config.port}`);
    console.log('');
    console.log('  Optionen:');
    console.log('  1. Bestehenden Server verwenden (beenden und neu starten)');
    console.log('  2. Auf anderem Port starten');
    console.log('  3. Abbrechen');
    console.log('');
    
    const choice = await prompt('  Auswahl', '1');
    
    if (choice === '2') {
      const newPort = await prompt('  Neuer Port', String(config.port + 1));
      config.port = parseInt(newPort) || (config.port + 1);
      await checkAndKillProcesses();
    } else if (choice === '3') {
      printInfo('Abbruch');
      process.exit(0);
    }
  } else {
    printSuccess(`Port ${config.port} ist verfügbar`);
  }
  console.log('');
  
  // Server starten
  startServer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Line Arguments
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('');
  console.log('  KI-OS Community Edition — Start Script');
  console.log('');
  console.log('  Verwendung:');
  console.log('    node start.js              Interaktiver Start mit Setup');
  console.log('    node start.js --quick      Schnellstart mit bestehender .env');
  console.log('    node start.js --reset      Setup zurücksetzen (mit Backup)');
  console.log('    node start.js --port 9000  Server auf bestimmtem Port starten');
  console.log('    node start.js --help       Diese Hilfe anzeigen');
  console.log('');
  process.exit(0);
}

/**
 * Erstellt ein Backup der .env Datei mit Zeitstempel
 * Beispiel: .env.backup.2026-04-08-143052
 */
function createEnvBackup() {
  if (!fileExists(ENV_FILE)) return null;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupPath = path.join(ROOT_DIR, `.env.backup.${timestamp}`);
  
  try {
    fs.copyFileSync(ENV_FILE, backupPath);
    return backupPath;
  } catch (error) {
    printError(`Backup fehlgeschlagen: ${error.message}`);
    return null;
  }
}

if (args.includes('--reset')) {
  if (fileExists(ENV_FILE)) {
    const backupPath = createEnvBackup();
    if (backupPath) {
      printSuccess(`Backup erstellt: ${path.basename(backupPath)}`);
      console.log('');
      console.log('  WICHTIG: Die .env Datei wird NICHT gelöscht!');
      console.log('  Du kannst sie manuell bearbeiten oder das Backup wiederherstellen.');
      console.log('');
      console.log('  Backup: ' + backupPath);
      console.log('');
    } else {
      printWarning('Backup fehlgeschlagen - .env bleibt unverändert');
      console.log('');
    }
  } else {
    printInfo('Keine .env Datei vorhanden');
    console.log('');
  }
  console.log('  Setup wird neu gestartet...');
  console.log('');
  main();
} else if (args.includes('--quick')) {
  if (!fileExists(ENV_FILE)) {
    printError('Keine .env Datei gefunden');
    console.log('');
    console.log('  Bitte zuerst Setup ausführen: node start.js');
    console.log('');
    process.exit(1);
  }
  console.log('');
  printSuccess('Quick Start — verwende bestehende .env');
  console.log('');
  const env = loadExistingEnv();
  config.port = parseInt(env.PORT) || DEFAULT_PORT;
  config.provider = env.ANTHROPIC_API_KEY ? 'anthropic' 
                  : env.OPENAI_API_KEY ? 'openai'
                  : env.GOOGLE_GENERATIVE_AI_API_KEY ? 'gemini'
                  : env.DEEPSEEK_API_KEY ? 'deepseek'
                  : env.DASHSCOPE_API_KEY ? 'dashscope'
                  : 'demo';
  config.memoryBackend = env.MEMORY_BACKEND || 'file';
  startServer();
} else if (args.includes('--port')) {
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    config.port = parseInt(args[portIndex + 1]) || DEFAULT_PORT;
  }
  main();
} else {
  main();
}
