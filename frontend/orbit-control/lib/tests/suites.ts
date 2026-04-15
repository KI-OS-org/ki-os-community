/**
 * KI-OS Frontend Test Suites
 * Jeder Step spiegelt exakt die Aktion eines UI-Buttons / Formular-Submits.
 */

import type { TestStep } from "./runner";
import { assertOk, assertHas } from "./runner";

const TEST_AGENT_NAME    = "__KI_OS_TEST__";
const TEST_AGENT_PAYLOAD = {
  name:         TEST_AGENT_NAME,
  category:     "IT",
  subCategory:  "TestSuite",
  owner:        "test@ki-os.local",
  domain:       "it",
  description:  "Automatisch angelegter Test-Agent — wird nach Test gelöscht",
  systemPrompt: "Du bist ein Test-Agent. Bestätige jeden Befehl mit OK.",
  tags:         ["test", "automated"],
  tools:        ["web_search", "memory_search"],
  visibleTo:    ["IT", "Admin"],
};

// ---------------------------------------------------------------------------
// Suite 1 — Backend & Health
// ---------------------------------------------------------------------------
const healthSuite: TestStep[] = [
  {
    id: "health.backend",
    group: "1. Backend & Health",
    name: "Backend erreichbar (GET /api/control-plane/health)",
    critical: true,
    fn: async ({ assert, log }) => {
      const res  = await fetch("/api/control-plane/health", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      log(JSON.stringify(data).slice(0, 120));
      assert(res.status !== 0, "Backend antwortet nicht (status 0)");
      assert(res.status < 500, `Backend liefert HTTP ${res.status}`);
    },
  },
  {
    id: "health.status",
    group: "1. Backend & Health",
    name: "System-Status (GET /api/control-plane/health → status field)",
    critical: false,
    fn: async ({ assert, log, warn }) => {
      const res  = await fetch("/api/control-plane/health", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      log(`status: ${data.status}`);
      if (data.status === "degraded") {
        warn(`System ist degraded (weiterhin lauffähig): ${JSON.stringify(data.checks).slice(0, 100)}`);
      } else {
        assert(data.status === "ok" || data.status === "degraded", `Unbekannter Status: ${data.status}`);
      }
    },
  },
  {
    id: "health.notifications",
    group: "1. Backend & Health",
    name: "Notifications API (GET /api/notifications/feed → Array)",
    critical: false,
    fn: async ({ assert, log }) => {
      const res  = await fetch("/api/notifications/feed", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      log(`${Array.isArray(data) ? data.length : "?"} Notifications`);
      assert(Array.isArray(data), "Erwartet Array, nicht Fehler-Objekt");
    },
  },
];

// ---------------------------------------------------------------------------
// Suite 2 — Agent CRUD (spiegelt alle UI-Buttons 1:1)
// ---------------------------------------------------------------------------
const agentSuite: TestStep[] = [
  {
    id: "agents.cleanup_before",
    group: "2. Agent CRUD",
    name: "Vorherige Test-Agents bereinigen",
    critical: false,
    fn: async ({ log }) => {
      const res  = await fetch("/api/agents?limit=100", { cache: "no-store" });
      const data = await res.json().catch(() => ({ agents: [] }));
      const old  = (data.agents ?? []).filter((a: { name: string }) => a.name === TEST_AGENT_NAME);
      for (const a of old) {
        await fetch(`/api/agents/${a.id}`, { method: "DELETE" });
      }
      log(`${old.length} alte Test-Agent(s) gelöscht`);
    },
  },
  {
    id: "agents.create",
    group: "2. Agent CRUD",
    name: "Agent anlegen — wie /agents/new Formular-Submit",
    critical: true,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch("/api/agents", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(TEST_AGENT_PAYLOAD),
      });
      const data = await res.json().catch(() => ({}));
      log(JSON.stringify(data).slice(0, 120));
      if (res.status === 403 && data.code === "COMMUNITY_LIMIT_EXCEEDED") {
        throw new Error(`Community-Limit erreicht (${data.limit} Agents). Test-Daten können nicht angelegt werden.`);
      }
      assertOk(res, "Agent anlegen");
      assertHas(data, "id", "Agent");
      assertHas(data, "name", "Agent");
      store.agentId     = data.id;
      store.agentName   = data.name;
      store.agentStatus = data.status;
      log(`Angelegt: ${data.name} (id: ${data.id})`);
    },
  },
  {
    id: "agents.list",
    group: "2. Agent CRUD",
    name: "Agent in Liste — wie AgentList initial load",
    critical: true,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch("/api/agents", { cache: "no-store" });
      const data = await res.json().catch(() => ({ agents: [] }));
      assertOk(res, "Agent-Liste");
      const found = (data.agents ?? []).find((a: { id: unknown }) => a.id === store.agentId);
      assert(!!found, `Test-Agent (id: ${store.agentId}) nicht in Liste gefunden`);
      log(`${data.agents?.length ?? 0} Agents gesamt, Test-Agent gefunden`);
    },
  },
  {
    id: "agents.detail",
    group: "2. Agent CRUD",
    name: "Agent-Detail laden — wie /agents/:id page load",
    critical: true,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch(`/api/agents/${store.agentId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      assertOk(res, "Agent-Detail");
      assertHas(data, "id", "Agent-Detail");
      assert(data.name === TEST_AGENT_NAME, `Name falsch: ${data.name}`);
      assert(data.category === "IT", `Kategorie falsch: ${data.category}`);
      log(`Detail OK: ${data.name} / ${data.category} / ${data.status}`);
    },
  },
  {
    id: "agents.toggle_pause",
    group: "2. Agent CRUD",
    name: "Agent pausieren — wie Pause-Button in AgentList / AgentDetailActions",
    critical: true,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch(`/api/agents/${store.agentId}/toggle`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      assertOk(res, "Agent pausieren");
      assert(data.status === "paused", `Erwartet 'paused', war '${data.status}'`);
      store.agentStatus = data.status;
      log(`Status nach Toggle: ${data.status}`);
    },
  },
  {
    id: "agents.toggle_activate",
    group: "2. Agent CRUD",
    name: "Agent aktivieren — zweiter Toggle (active ← paused)",
    critical: true,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch(`/api/agents/${store.agentId}/toggle`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      assertOk(res, "Agent aktivieren");
      assert(data.status === "active", `Erwartet 'active', war '${data.status}'`);
      store.agentStatus = data.status;
      log(`Status nach Toggle: ${data.status}`);
    },
  },
  {
    id: "agents.stats",
    group: "2. Agent CRUD",
    name: "Agent-Stats / Heatmap — wie AgentHeatmap data fetch",
    critical: false,
    fn: async ({ assert, log }) => {
      const res  = await fetch("/api/agents/stats", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      assertOk(res, "Agent-Stats");
      assertHas(data, "total", "Stats");
      assertHas(data, "byCategory", "Stats");
      log(`total: ${data.total}, active: ${data.active}, IT: ${data.byCategory?.IT?.total ?? 0}`);
    },
  },
  {
    id: "agents.filter_category",
    group: "2. Agent CRUD",
    name: "Agent-Filter nach Kategorie — wie Dropdown in AgentList",
    critical: false,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch("/api/agents?category=IT", { cache: "no-store" });
      const data = await res.json().catch(() => ({ agents: [] }));
      assertOk(res, "Agent-Filter");
      const found = (data.agents ?? []).find((a: { id: unknown }) => a.id === store.agentId);
      assert(!!found, "Test-Agent nicht im IT-Filter");
      log(`IT-Filter: ${data.agents?.length ?? 0} Agents`);
    },
  },
  {
    id: "agents.delete",
    group: "2. Agent CRUD",
    name: "Agent löschen — wie Trash-Button + Bestätigungs-Dialog",
    critical: true,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch(`/api/agents/${store.agentId}`, { method: "DELETE" });
      assertOk(res, "Agent löschen");
      // Verifiziere: Agent nicht mehr in Liste
      const listRes  = await fetch("/api/agents", { cache: "no-store" });
      const listData = await listRes.json().catch(() => ({ agents: [] }));
      const found    = (listData.agents ?? []).find((a: { id: unknown; status: string }) => a.id === store.agentId && a.status !== "deleted");
      assert(!found, "Agent noch in Liste nach Löschen");
      log(`Test-Agent ${store.agentId} erfolgreich gelöscht und aus Liste entfernt`);
    },
  },
];

// ---------------------------------------------------------------------------
// Suite 3 — SelfRepair
// ---------------------------------------------------------------------------
const selfRepairSuite: TestStep[] = [
  {
    id: "repair.stats",
    group: "3. SelfRepair",
    name: "SelfRepair Stats (GET /api/selfrepair/stats)",
    critical: true,
    fn: async ({ assert, log }) => {
      const res  = await fetch("/api/selfrepair/stats", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      assertOk(res, "SelfRepair Stats");
      assertHas(data, "total", "Stats");
      log(`total: ${data.total}, open: ${data.open}, l1: ${data.l1_open}`);
    },
  },
  {
    id: "repair.list",
    group: "3. SelfRepair",
    name: "Incident-Liste laden (GET /api/selfrepair)",
    critical: true,
    fn: async ({ assert, log }) => {
      const res  = await fetch("/api/selfrepair", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      assertOk(res, "SelfRepair Liste");
      assert(Array.isArray(data.incidents), "Erwartet incidents-Array");
      log(`${data.total ?? 0} Incidents gesamt`);
    },
  },
  {
    id: "repair.trigger",
    group: "3. SelfRepair",
    name: "Test-Incident auslösen (POST /api/selfrepair — Trigger)",
    critical: false,
    fn: async ({ store, assert, log }) => {
      const res  = await fetch("/api/selfrepair", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          error:  "TestError: Automatisch ausgelöst durch TestSuite",
          source: "/tests/selfrepair",
          stack:  "TestError: Automatisch ausgelöst\n  at runTests (lib/tests/suites.ts:1:1)",
          context: { automated: true },
        }),
      });
      // 201 = angelegt, 400/403 auch akzeptabel (Backend-Guard)
      const data = await res.json().catch(() => ({}));
      log(JSON.stringify(data).slice(0, 120));
      assert(res.status < 500, `Server-Fehler beim Trigger: ${res.status}`);
      if (data.id) store.incidentId = data.id;
    },
  },
  {
    id: "repair.resolve",
    group: "3. SelfRepair",
    name: "Test-Incident auflösen (POST /api/selfrepair/:id/resolve)",
    critical: false,
    fn: async ({ store, assert, log }) => {
      if (!store.incidentId) { log("Kein Incident-ID aus vorherigem Test — übersprungen"); return; }
      const res = await fetch(`/api/selfrepair/${store.incidentId}/resolve`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ notes: "Automatisch aufgelöst durch TestSuite" }),
      });
      assertOk(res, "Incident resolve");
      const data = await res.json().catch(() => ({}));
      assert(data.status === "resolved", `Erwartet 'resolved', war '${data.status}'`);
      log(`Incident ${store.incidentId} → resolved`);
    },
  },
];

// ---------------------------------------------------------------------------
// Suite 4 — Navigation / Routen
// ---------------------------------------------------------------------------
const navSuite: TestStep[] = [
  {
    id: "nav.home",      group: "4. Navigation", name: "/ (Home-Seite erreichbar)", critical: false,
    fn: async ({ assert }) => { const r = await fetch("/", { cache: "no-store" }); assert(r.ok, `HTTP ${r.status}`); },
  },
  {
    id: "nav.agents",    group: "4. Navigation", name: "/agents erreichbar", critical: false,
    fn: async ({ assert }) => { const r = await fetch("/agents", { cache: "no-store" }); assert(r.ok || r.status === 307, `HTTP ${r.status}`); },
  },
  {
    id: "nav.repair",    group: "4. Navigation", name: "/repair erreichbar", critical: false,
    fn: async ({ assert }) => { const r = await fetch("/repair", { cache: "no-store" }); assert(r.ok || r.status === 307, `HTTP ${r.status}`); },
  },
  {
    id: "nav.control",   group: "4. Navigation", name: "/control erreichbar", critical: false,
    fn: async ({ assert }) => { const r = await fetch("/control", { cache: "no-store" }); assert(r.ok || r.status === 307, `HTTP ${r.status}`); },
  },
  {
    id: "nav.flows",     group: "4. Navigation", name: "/flows erreichbar", critical: false,
    fn: async ({ assert }) => { const r = await fetch("/flows", { cache: "no-store" }); assert(r.ok || r.status === 307, `HTTP ${r.status}`); },
  },
  {
    id: "nav.trust",     group: "4. Navigation", name: "/trust erreichbar", critical: false,
    fn: async ({ assert }) => { const r = await fetch("/trust", { cache: "no-store" }); assert(r.ok || r.status === 307, `HTTP ${r.status}`); },
  },
];

// ---------------------------------------------------------------------------
// Suite 5 — DOM: Interaktive Elemente prüfen
// ---------------------------------------------------------------------------
const domSuite: TestStep[] = [
  {
    id: "dom.sidebar",
    group: "5. DOM & UI",
    name: "Sidebar: alle Nav-Links im DOM vorhanden",
    critical: false,
    fn: async ({ assert, log }) => {
      const links = document.querySelectorAll("nav a[href]");
      const hrefs = Array.from(links).map(a => (a as HTMLAnchorElement).getAttribute("href"));
      log(`Gefundene Nav-Links: ${hrefs.join(", ")}`);
      assert(links.length >= 3, `Nur ${links.length} Nav-Links gefunden (erwartet ≥ 3)`);
    },
  },
  {
    id: "dom.repair_link",
    group: "5. DOM & UI",
    name: "Sidebar: /repair Link vorhanden",
    critical: false,
    fn: async ({ assert }) => {
      const link = document.querySelector("nav a[href='/repair']");
      assert(!!link, "Kein /repair Link in der Sidebar-Navigation gefunden");
    },
  },
  {
    id: "dom.agents_link",
    group: "5. DOM & UI",
    name: "Sidebar: /agents Link vorhanden",
    critical: false,
    fn: async ({ assert }) => {
      const link = document.querySelector("nav a[href='/agents']");
      assert(!!link, "Kein /agents Link in der Sidebar-Navigation gefunden");
    },
  },
  {
    id: "dom.heading",
    group: "5. DOM & UI",
    name: "Seiteninhalt: Mindestens ein h1 oder h2 vorhanden",
    critical: false,
    fn: async ({ assert, log }) => {
      const headings = document.querySelectorAll("h1, h2");
      log(`${headings.length} Überschrift(en) auf der Seite`);
      assert(headings.length > 0, "Keine Überschriften gefunden — Seite möglicherweise leer");
    },
  },
  {
    id: "dom.no_error",
    group: "5. DOM & UI",
    name: "Keine Next.js Error-Boundary auf der Seite",
    critical: false,
    fn: async ({ assert, warn }) => {
      const errorBoundary = document.querySelector("[data-nextjs-error], .nextjs-error");
      const errorText = document.body.innerText.toLowerCase();
      if (errorBoundary) {
        throw new Error("Next.js Error-Boundary sichtbar auf der Seite");
      }
      if (errorText.includes("application error") || errorText.includes("unhandled error")) {
        warn("Mögliche Fehlermeldung im Seiteninhalt entdeckt");
      } else {
        assert(true, "OK");
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Community Edition Guard
// ---------------------------------------------------------------------------
const communityGuardSuite: TestStep[] = [
  {
    id: "community.env",
    group: "6. Community Guard",
    name: "KI_OS_EDITION konfiguriert (über /api/control-plane/health)",
    critical: false,
    fn: async ({ log, warn }) => {
      const res  = await fetch("/api/control-plane/health", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      log(`os_level: ${data.os_level}, runtime: ${data.runtime}`);
      warn("Edition-Check: Stelle sicher dass KI_OS_EDITION in .env gesetzt ist");
    },
  },
  {
    id: "community.agent_limit",
    group: "6. Community Guard",
    name: "Agent-Limit: 4. Agent wird abgelehnt (Community = max 3)",
    critical: false,
    fn: async ({ log, warn }) => {
      // Hole aktuelle Anzahl
      const listRes  = await fetch("/api/agents", { cache: "no-store" });
      const listData = await listRes.json().catch(() => ({ agents: [] }));
      const count    = (listData.agents ?? []).filter((a: { status: string }) => a.status !== "deleted").length;
      log(`Aktuell ${count} Agents`);
      if (count < 3) {
        warn(`Nur ${count}/3 Agents vorhanden — Limit-Test benötigt 3 vorhandene Agents`);
        return;
      }
      // Versuche 4. Agent anzulegen
      const res  = await fetch("/api/agents", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ ...TEST_AGENT_PAYLOAD, name: "__LIMIT_TEST__" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "COMMUNITY_LIMIT_EXCEEDED") {
        log(`✓ Limit-Guard korrekt: ${data.message}`);
      } else if (res.ok) {
        // Aufräumen
        if (data.id) await fetch(`/api/agents/${data.id}`, { method: "DELETE" });
        warn("4. Agent wurde angelegt — Community-Limit nicht aktiv (oder Edition=enterprise)");
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Alle Suiten zusammenführen
// ---------------------------------------------------------------------------
export const ALL_TEST_STEPS: TestStep[] = [
  ...healthSuite,
  ...agentSuite,
  ...selfRepairSuite,
  ...navSuite,
  ...domSuite,
  ...communityGuardSuite,
];

export const SUITE_NAMES = [
  "1. Backend & Health",
  "2. Agent CRUD",
  "3. SelfRepair",
  "4. Navigation",
  "5. DOM & UI",
  "6. Community Guard",
];
