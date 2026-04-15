import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const frontendDir = path.resolve(__dirname, "..");
const backendDir = rootDir;
const versionFile = path.join(rootDir, ".ki-os-version");
const appVersion = fs.existsSync(versionFile) ? (fs.readFileSync(versionFile, 'utf8').trim() || '1.0.2') : '1.0.2';
const backendUrl = process.env.KI_OS_API_URL || "http://localhost:3000";
const frontendPort = process.env.FRONTEND_PORT || "3001";
const timeoutMs = Number(process.env.KI_OS_HEALTH_TIMEOUT_MS || 60000);
function runChecked(cmd, args, cwd, label) { return new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true });
  child.on('exit', (code) => code === 0 ? resolve(code) : reject(new Error(`${label}_failed_${code}`)));
  child.on('error', reject);
});}
function startDetached(cmd, args, cwd, label) {
  const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true });
  child.on('exit', (code) => console.log(`[${label}] beendet mit Code ${code}`));
}
function ping(url) { return new Promise((resolve) => {
  const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 500); });
  req.on('error', () => resolve(false));
  req.setTimeout(2500, () => { req.destroy(); resolve(false); });
});}
async function waitForBackend(url, maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) { if (await ping(url)) return true; await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error('backend_health_timeout');
}
async function main() {
  console.log(`=== KI-OS-Start ${appVersion} ===`);
  await runChecked('node', ['scripts/doctor.js'], backendDir, 'backend_doctor');
  await runChecked('node', ['scripts/frontend-doctor.mjs'], frontendDir, 'frontend_doctor');
  await runChecked('node', [`scripts/release-gate-${appVersion}.js`], backendDir, 'release_gate');
  startDetached('npm', ['run', 'start:local'], backendDir, 'backend');
  await waitForBackend(`${backendUrl}/health`, timeoutMs);
  startDetached('npm', ['run', 'dev', '--', '--port', String(frontendPort)], frontendDir, 'frontend');
}
main().catch((error) => { console.error(`[KI-OS-Start ${appVersion}] Fehler`, error); process.exit(1); });
