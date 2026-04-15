'use strict';
/**
 * KI-OS Startup Notice
 * Displays license information and AS-IS disclaimer at server startup.
 * Required for US software distribution compliance.
 */

const RESET  = '\x1b[0m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const BLUE   = '\x1b[34m';

const KI_OS_ASCII = `
${BLUE}       ██╗  ██╗██╗  ██╗ ██████╗██╗  ██╗
${BLUE}       ██║  ██║██║  ██║██╔════╝██║ ██╔╝
${BLUE}       ███████║███████║██║     █████╔╝ 
${BLUE}       ██╔══██║╚════██║██║     ██╔═██╗ 
${BLUE}       ██║  ██║     ██║╚██████╗██║  ██╗
${BLUE}       ╚═╝  ╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝${RESET}
${DIM}${BLUE}       KI-OS · AI Operating System · v1.1.1-security${RESET}`;

function printStartupNotice(edition, version, port) {
  const ed = (edition || 'community').toLowerCase();
  const v  = version || '1.1.0';
  const p  = port    || 8080;

  // Print ASCII Art
  console.log(KI_OS_ASCII);

  const line = '─'.repeat(61);

  console.log('');
  console.log(CYAN + BOLD + '┌' + line + '┐' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + '  ⚙  KI-OS — AI Operating System' +
    ' '.repeat(27) + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET +
    `     Version ${v} · ${ed.toUpperCase()} Edition · Port ${p}` +
    ' '.repeat(Math.max(0, 20 - v.length - ed.length)) +
    CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + '     © 2026 Ingo Schaffer · ki-os.org' +
    ' '.repeat(24) + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '├' + line + '┤' + RESET);

  // License block
  console.log(CYAN + BOLD + '│' + RESET + BOLD + '  LICENSE' + RESET +
    ' '.repeat(53) + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  KI-OS Community Edition is licensed under the' +
    ' '.repeat(13) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + YELLOW +
    '  GNU Affero General Public License v3.0 (AGPL-3.0)' +
    ' '.repeat(9) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  https://www.gnu.org/licenses/agpl-3.0.html' +
    ' '.repeat(16) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  Third-party components: Apache 2.0 · MIT · BSD' +
    ' '.repeat(12) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  See LICENSE, LICENSE-APACHE, LICENSE-AGPL in install dir.' +
    ' '.repeat(1) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '├' + line + '┤' + RESET);

  // AS-IS / Disclaimer block
  console.log(CYAN + BOLD + '│' + RESET + BOLD + '  DISCLAIMER' + RESET +
    ' '.repeat(49) + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY' +
    ' '.repeat(7) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT' +
    ' '.repeat(8) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS' +
    ' '.repeat(9) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.' +
    ' '.repeat(13) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS' +
    ' '.repeat(8) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY' +
    ' '.repeat(7) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '│' + RESET + DIM +
    '  ARISING FROM THE USE OF THIS SOFTWARE.' +
    ' '.repeat(20) + RESET + CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '├' + line + '┤' + RESET);

  // Community limits
  if (ed === 'community') {
    console.log(CYAN + BOLD + '│' + RESET + BOLD + '  COMMUNITY LIMITS' + RESET +
      ' '.repeat(43) + CYAN + BOLD + '│' + RESET);
    console.log(CYAN + BOLD + '│' + RESET + GREEN +
      '  ✓  Local operation only (127.0.0.1)' +
      ' '.repeat(23) + RESET + CYAN + BOLD + '│' + RESET);
    console.log(CYAN + BOLD + '│' + RESET + GREEN +
      '  ✓  Max 3 Agents · Basic governance · Memory' +
      ' '.repeat(15) + RESET + CYAN + BOLD + '│' + RESET);
    console.log(CYAN + BOLD + '│' + RESET + RED +
      '  ✗  No cloud deployment · No multi-tenancy' +
      ' '.repeat(16) + RESET + CYAN + BOLD + '│' + RESET);
    console.log(CYAN + BOLD + '│' + RESET + RED +
      '  ✗  No SAP/Salesforce/M365 connectors' +
      ' '.repeat(21) + RESET + CYAN + BOLD + '│' + RESET);
    console.log(CYAN + BOLD + '│' + RESET + DIM +
      '  Enterprise: enterprise@ki-os.org' +
      ' '.repeat(26) + RESET + CYAN + BOLD + '│' + RESET);
    console.log(CYAN + BOLD + '├' + line + '┤' + RESET);
  }

  console.log(CYAN + BOLD + '│' + RESET +
    `  Starting on http://127.0.0.1:${p}` +
    ' '.repeat(Math.max(0, 25 - String(p).length)) +
    CYAN + BOLD + '│' + RESET);
  console.log(CYAN + BOLD + '└' + line + '┘' + RESET);
  console.log('');
}

module.exports = { printStartupNotice };
