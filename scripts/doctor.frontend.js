/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const frontendDir = path.join(rootDir, "frontend", "orbit-control");
const envPath = path.join(frontendDir, ".env.local");
const examplePath = path.join(frontendDir, ".env.local.example");
const failures = [];

if (!fs.existsSync(frontendDir)) failures.push("frontend/orbit-control fehlt");
if (!fs.existsSync(path.join(frontendDir, "package.json"))) failures.push("frontend package.json fehlt");
if (!fs.existsSync(examplePath)) failures.push(".env.local.example fehlt");
if (!fs.existsSync(path.join(frontendDir, "app"))) failures.push("frontend app/ fehlt");
if (!fs.existsSync(path.join(frontendDir, "components"))) failures.push("frontend components/ fehlt");
if (!fs.existsSync(path.join(frontendDir, "lib", "adapters"))) failures.push("frontend lib/adapters fehlt");
if (!fs.existsSync(envPath)) failures.push(".env.local fehlt");

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  if (!/^AUTH_SECRET=.+/m.test(env)) failures.push("AUTH_SECRET fehlt");
  if (!/^NEXT_PUBLIC_API_URL=.+/m.test(env) && !/^KI_OS_API_URL=.+/m.test(env)) {
    failures.push("NEXT_PUBLIC_API_URL oder KI_OS_API_URL fehlt");
  }
}

if (failures.length) {
  console.error("[FEHLER] Frontend doctor fehlgeschlagen:");
  failures.forEach((item) => console.error(` - ${item}`));
  process.exit(1);
}

console.log("[OK] Frontend doctor bestanden.");
