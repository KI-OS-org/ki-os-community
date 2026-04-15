import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const envPath = path.join(frontendDir, ".env.local");
const examplePath = path.join(frontendDir, ".env.local.example");
const packagePath = path.join(frontendDir, "package.json");

const required = [];
if (!fs.existsSync(packagePath)) required.push("frontend package.json fehlt");
if (!fs.existsSync(examplePath)) required.push(".env.local.example fehlt");
if (!fs.existsSync(envPath)) required.push(".env.local fehlt");
if (!fs.existsSync(path.join(frontendDir, "app"))) required.push("frontend app/ fehlt");
if (!fs.existsSync(path.join(frontendDir, "components"))) required.push("frontend components/ fehlt");
if (!fs.existsSync(path.join(frontendDir, "lib", "adapters"))) required.push("frontend lib/adapters fehlt");

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  if (!/^AUTH_SECRET=.+/m.test(env)) required.push("AUTH_SECRET fehlt in .env.local");
  if (!/^NEXT_PUBLIC_API_URL=.+/m.test(env) && !/^KI_OS_API_URL=.+/m.test(env)) {
    required.push("NEXT_PUBLIC_API_URL oder KI_OS_API_URL fehlt in .env.local");
  }
}

if (required.length) {
  console.error("[FEHLER] Frontend doctor fehlgeschlagen:");
  for (const item of required) console.error(` - ${item}`);
  process.exit(1);
}

console.log("[OK] Frontend-ENV und Struktur valide.");
