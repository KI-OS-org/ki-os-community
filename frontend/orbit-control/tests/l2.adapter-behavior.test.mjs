/**
 * KI-OS Orbit Control — L2 Adapter Behavior Test
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Verifiziert L2 robust auf Node-Ebene ohne fragile Direktimporte der Adapter-Module.
 * Der Test prüft:
 * 1. Adapter-Quelldateien enthalten die erwarteten Live-Light-Endpunkte.
 * 2. Die Runtime-Service-Schicht erzeugt echte Run-/Explain-/Trust-/Files-/Memory-Daten.
 *
 * Status:
 * QA
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("L2 adapters expose expected API paths in source and runtime service produces live-light data", async () => {
  const root = process.cwd();

  const explainAdapterPath = path.join(root, "frontend", "orbit-control", "lib", "adapters", "explain-trust.ts");
  const filesAdapterPath = path.join(root, "frontend", "orbit-control", "lib", "adapters", "files-memory.ts");

  assert.equal(fs.existsSync(explainAdapterPath), true);
  assert.equal(fs.existsSync(filesAdapterPath), true);

  const explainSource = fs.readFileSync(explainAdapterPath, "utf8");
  const filesSource = fs.readFileSync(filesAdapterPath, "utf8");

  assert.match(explainSource, /\/api\/explain/);
  assert.match(explainSource, /\/api\/trust/);
  assert.match(filesSource, /\/api\/files/);
  assert.match(filesSource, /\/api\/memory\/retrieve/);

  const runtime = await import("file://" + path.join(root, "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.ts"));

  runtime.uiRuntimeService.reset();

  const created = runtime.uiRuntimeService.createRuntimeRun({
    tenant: "demo-tenant",
    workspaceId: "ws-retail",
    summary: "Retail margin review required",
    tags: ["retail", "margin"],
    fileName: "retail-margin.md",
    confidence: 0.93
  });

  const explain = runtime.uiRuntimeService.buildExplainResponse(created.runId);
  const trust = runtime.uiRuntimeService.buildTrustResponse(created.runId);
  const files = runtime.uiRuntimeService.listFiles("demo-tenant");
  const memory = runtime.uiRuntimeService.retrieveMemory("margin", "demo-tenant", "ws-retail");

  assert.equal(explain.ok, true);
  assert.equal(explain.mode, "LIVE");
  assert.equal(explain.runId, created.runId);
  assert.equal(trust.trustStatus, "green");
  assert.equal(Array.isArray(files), true);
  assert.equal(files.some((entry) => entry.fileId === created.fileId), true);
  assert.equal(Array.isArray(memory), true);
  assert.equal(memory.some((entry) => entry.linkedRunId === created.runId), true);
});
