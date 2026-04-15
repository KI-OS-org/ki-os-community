import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("F2 ships mission control home with all blueprint modules", () => {
  const page = read("app/page.tsx");
  const missionControl = read("components/home/mission-control.tsx");
  assert.match(page, /MissionControl/);
  [
    "SmartInputBar",
    "SystemStatusWidget",
    "ContinueWorking",
    "QuickActions",
    "RecommendedSolutions",
    "CommandPalette",
  ].forEach((name) => assert.match(missionControl, new RegExp(name)));
});

test("F2 adds mission control adapter with user-friendly fallback content", () => {
  const adapter = read("lib/adapters/mission-control.ts");
  assert.match(adapter, /getMissionControlData/);
  assert.match(adapter, /continueWorking/);
  assert.match(adapter, /recommendedSolutions/);
  assert.match(adapter, /keine API-Wörter|Keine API-Wörter/i);
});

test("F2 command palette route and component are present", () => {
  const route = read("app/api/command-palette/route.ts");
  const component = read("components/home/command-palette.tsx");
  assert.match(route, /commandPalette/);
  assert.match(component, /Befehl öffnen/);
  assert.match(component, /Suche nach Ziel, Bereich oder Aktion/);
});

test("F2 package version and tests reflect mission control sprint", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.version, "0.3.0-f2");
  assert.match(packageJson.scripts.test, /f2\.mission-control/);
});
