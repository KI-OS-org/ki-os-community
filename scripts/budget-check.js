/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
#!/usr/bin/env node
/**
 * KI-OS Claude Budget Monitor
 * Wird von Claude nach jeder größeren Operation aufgerufen.
 * Gibt Checkpoint-Status aus und exit(2) wenn Grenze erreicht.
 *
 * Usage:
 *   node scripts/budget-check.js tick          → zählt +1 Tool-Call
 *   node scripts/budget-check.js status        → zeigt aktuellen Stand
 *   node scripts/budget-check.js reset         → setzt Session zurück
 *   node scripts/budget-check.js set-budget 5  → setzt Budget auf $5
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const BUDGET_FILE = path.resolve(__dirname, '../.claude/budget.json');

function load() {
  return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(data, null, 2));
}

function estimateCost(data) {
  const claude   = data.models.claude;
  const deepseek = data.models.deepseek;
  const calls    = data.session.currentToolCalls;
  // Claude: 40% der Calls (Architektur, Review), DeepSeek: 60% (Implementation)
  const claudeCalls    = Math.ceil(calls * 0.4);
  const deepseekCalls  = Math.floor(calls * 0.6);
  const claudeCost     = (claudeCalls   * claude.avgTokensPerCall   / 1_000_000) * claude.flatPricePerM_USD;
  const deepseekCost   = (deepseekCalls * deepseek.avgTokensPerCall / 1_000_000) * deepseek.avgPricePerM_USD;
  return { claudeCost, deepseekCost, total: claudeCost + deepseekCost };
}

function estimateTokens(data) {
  const calls = data.session.currentToolCalls;
  const c = Math.ceil(calls * 0.4)  * data.models.claude.avgTokensPerCall;
  const d = Math.floor(calls * 0.6) * data.models.deepseek.avgTokensPerCall;
  return { claude: c, deepseek: d, total: c + d };
}

function bar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function printStatus(data, label = 'STATUS') {
  const budget  = data.session.budgetUSD;
  const calls   = data.session.currentToolCalls;
  const cp      = data.session.checkpointEveryToolCalls;
  const nextCp  = cp - (calls % cp || cp);
  const cost    = estimateCost(data);
  const tokens  = estimateTokens(data);
  const percent = Math.min((cost.total / budget) * 100, 100);

  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`│  KI-OS v1.2.0 Budget Monitor — ${label.padEnd(23)} │`);
  console.log('├────────────────────────────────────────────────────────┤');
  console.log(`│  GESAMT:     $${budget.toFixed(2).padStart(5)} Budget  │  Verbraucht: $${cost.total.toFixed(3)}          │`);
  console.log(`│  Claude:     $${data.models.claude.budgetUSD.toFixed(2).padStart(5)} Budget  │  ~$${cost.claudeCost.toFixed(3)} (${(tokens.claude/1000).toFixed(0)}K Tokens)    │`);
  console.log(`│  DeepSeek:   $${data.models.deepseek.budgetUSD.toFixed(2).padStart(5)} Budget  │  ~$${cost.deepseekCost.toFixed(3)} (${(tokens.deepseek/1000).toFixed(0)}K Tokens)    │`);
  console.log('├────────────────────────────────────────────────────────┤');
  console.log(`│  Progress:   ${bar(percent)} ${percent.toFixed(0).padStart(3)}%             │`);
  console.log(`│  Tool-Calls: ${String(calls).padStart(4)} total, nächster CP in ${String(nextCp).padStart(2)}               │`);
  console.log('└────────────────────────────────────────────────────────┘');

  if (data.checkpoints.length) {
    console.log('\n  Letzte Checkpoints:');
    data.checkpoints.slice(-3).forEach(cp => {
      console.log(`   • [${cp.time}]  ${cp.summary}`);
    });
  }
  console.log();

  return { cost, percent, calls };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

const cmd = process.argv[2] || 'status';

if (cmd === 'reset') {
  const data = load();
  data.session.currentToolCalls = 0;
  data.session.estimatedSpendUSD = 0;
  data.session.sessionStart = new Date().toISOString();
  data.session.lastCheckpoint = null;
  data.session.status = 'running';
  data.checkpoints = [];
  save(data);
  console.log('  Budget zurückgesetzt. Neue Session gestartet.');
  process.exit(0);
}

if (cmd === 'set-budget') {
  const val = parseFloat(process.argv[3]);
  if (isNaN(val) || val <= 0) { console.error('  Ungültiger Betrag.'); process.exit(1); }
  const data = load();
  data.session.budgetUSD = val;
  save(data);
  console.log(`  Budget gesetzt auf $${val.toFixed(2)}`);
  process.exit(0);
}

if (cmd === 'status') {
  const data = load();
  printStatus(data);
  process.exit(0);
}

if (cmd === 'tick') {
  const data = load();

  // Init bei erster Nutzung
  if (!data.session.sessionStart) {
    data.session.sessionStart = new Date().toISOString();
    data.session.status = 'running';
  }

  data.session.currentToolCalls += 1;
  const cost    = estimateCost(data);
  const budget  = data.session.budgetUSD;
  const percent = (cost.total / budget) * 100;
  data.session.estimatedSpendUSD = cost.total;

  // Hard Stop
  if (percent >= data.session.hardStopAtPercent) {
    data.session.status = 'stopped';
    save(data);
    printStatus(data, 'HARD STOP');
    console.log('  ⛔ Budget aufgebraucht — Claude stoppt hier.');
    console.log('  → node scripts/budget-check.js set-budget <betrag>  um zu erhöhen');
    console.log('  → node scripts/budget-check.js reset                um zurückzusetzen\n');
    process.exit(2);
  }

  // Warning
  if (percent >= data.session.warningAtPercent) {
    data.session.status = 'warning';
  }

  // Checkpoint
  const calls = data.session.currentToolCalls;
  const cp    = data.session.checkpointEveryToolCalls;
  if (calls % cp === 0) {
    const cpEntry = {
      time:    new Date().toLocaleTimeString('de-DE'),
      calls,
      costUSD: cost.total.toFixed(4),
      summary: `${calls} Calls | Claude ~$${cost.claudeCost.toFixed(3)} | DeepSeek ~$${cost.deepseekCost.toFixed(3)} | Total $${cost.total.toFixed(3)}`,
    };
    data.checkpoints.push(cpEntry);
    data.session.lastCheckpoint = new Date().toISOString();
    save(data);

    printStatus(data, 'CHECKPOINT');

    if (percent >= data.session.warningAtPercent) {
      console.log('  ⚠️  Budget-Warnung! Verbraucht:', percent.toFixed(0) + '%');
      console.log('  Claude fragt jetzt nach Anweisung.\n');
      process.exit(3);
    }

    console.log('  ✓ Checkpoint OK — Claude macht weiter.\n');
    process.exit(0);
  }

  save(data);
  process.exit(0);
}

console.error('  Unbekannter Befehl:', cmd);
process.exit(1);
