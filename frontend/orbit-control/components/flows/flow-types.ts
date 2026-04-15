export type FlowNodeType =
  | "input"
  | "aiTask"
  | "save"
  | "governanceCheck"
  | "privacyMask"
  | "memoryRetrieve"
  | "connectorCall"
  | "approval"
  | "report"
  | "testRun";

export interface FlowNodeDefinition {
  id: string;
  type: FlowNodeType;
  label: string;
  summary: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  estimatedCost: string;
  governanceLevel: "low" | "medium" | "high";
  nodes: FlowNodeDefinition[];
}

export const NODE_LIBRARY: Array<{ type: FlowNodeType; title: string; description: string }> = [
  { type: "input", title: "Input", description: "Startpunkt für Nutzerziel, Datei oder Trigger." },
  { type: "aiTask", title: "AI Task", description: "LLM- oder Agenten-Schritt mit Ziel und Kontext." },
  { type: "save", title: "Save", description: "Speichert Ergebnis, Artefakt oder Memory-Eintrag." },
  { type: "governanceCheck", title: "Governance Check", description: "Prüft Policies, Budget und Residency." },
  { type: "privacyMask", title: "Privacy Mask", description: "Maskiert PII vor externen Calls." },
  { type: "memoryRetrieve", title: "Memory Retrieve", description: "Holt relevante Kontexte und Notizen." },
  { type: "connectorCall", title: "Connector Call", description: "Ruft externe Systeme oder Webhooks an." },
  { type: "approval", title: "Approval", description: "Fordert menschliche Freigabe vor heiklen Schritten." },
  { type: "report", title: "Report", description: "Erstellt Executive- oder Audit-fähige Berichte." },
  { type: "testRun", title: "Testlauf", description: "Simuliert Node-Kette und zeigt Node-Ergebnisse." },
];

const baseNodes = {
  input: { id: "n1", type: "input" as const, label: "Ziel erfassen", summary: "Nutzerziel, Scope und Eingaben werden gesammelt." },
  memory: { id: "n2", type: "memoryRetrieve" as const, label: "Kontext abrufen", summary: "Relevante Memory-Treffer und Historie werden geladen." },
  privacy: { id: "n3", type: "privacyMask" as const, label: "PII maskieren", summary: "Sensible Daten werden vor Connector- und AI-Calls reduziert." },
  governance: { id: "n4", type: "governanceCheck" as const, label: "Governance prüfen", summary: "Policies, Budget und erlaubte Modelle werden vorab geprüft." },
  ai: { id: "n5", type: "aiTask" as const, label: "KI-Aufgabe ausführen", summary: "Agent/LLM erstellt Lösung, Analyse oder Entwurf." },
  approval: { id: "n6", type: "approval" as const, label: "Freigabe einholen", summary: "Operator oder Entscheider gibt kritische Schritte frei." },
  connector: { id: "n7", type: "connectorCall" as const, label: "Connector ausführen", summary: "Externe Aktion über App, API oder Webhook." },
  report: { id: "n8", type: "report" as const, label: "Report erzeugen", summary: "Ergebnis als Ergebnis-Karte und Audit-Bericht aufbereiten." },
  save: { id: "n9", type: "save" as const, label: "Speichern", summary: "Run, Report und Memory werden persistiert." },
  test: { id: "n10", type: "testRun" as const, label: "Testlauf", summary: "Simulierter Lauf zeigt Node-Ergebnisse und Kostenindikator." },
};

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "retail-campaign-check",
    name: "Retail Campaign Check",
    description: "Kampagnenidee prüfen, Policy anwenden und Ergebnis reporten.",
    estimatedCost: "€0.12 / Run",
    governanceLevel: "high",
    nodes: [baseNodes.input, baseNodes.memory, baseNodes.governance, baseNodes.ai, baseNodes.report, baseNodes.save],
  },
  {
    id: "privacy-review",
    name: "Privacy Review",
    description: "PII maskieren, Connector vorbereiten und Freigabe einholen.",
    estimatedCost: "€0.08 / Run",
    governanceLevel: "high",
    nodes: [baseNodes.input, baseNodes.privacy, baseNodes.governance, baseNodes.approval, baseNodes.report],
  },
  {
    id: "exec-briefing",
    name: "Executive Briefing",
    description: "Kontext abrufen, KI-Zusammenfassung bauen und als Report speichern.",
    estimatedCost: "€0.10 / Run",
    governanceLevel: "medium",
    nodes: [baseNodes.input, baseNodes.memory, baseNodes.ai, baseNodes.report, baseNodes.save],
  },
  {
    id: "incident-response",
    name: "Incident Response",
    description: "Incident-Signal aufnehmen, Governance prüfen und Recovery-Aktion triggern.",
    estimatedCost: "€0.15 / Run",
    governanceLevel: "high",
    nodes: [baseNodes.input, baseNodes.governance, baseNodes.connector, baseNodes.report, baseNodes.save],
  },
  {
    id: "supplier-outreach",
    name: "Supplier Outreach",
    description: "Lieferantenkommunikation vorbereiten, Freigabe und Connector-Dispatch.",
    estimatedCost: "€0.11 / Run",
    governanceLevel: "medium",
    nodes: [baseNodes.input, baseNodes.ai, baseNodes.approval, baseNodes.connector, baseNodes.save],
  },
  {
    id: "ops-quality-check",
    name: "Ops Quality Check",
    description: "Operationalen Run mit Testlauf und Kostenindikator absichern.",
    estimatedCost: "€0.07 / Run",
    governanceLevel: "medium",
    nodes: [baseNodes.input, baseNodes.test, baseNodes.governance, baseNodes.report],
  },
  {
    id: "memory-enrichment",
    name: "Memory Enrichment",
    description: "Kontext anreichern, KI-Auswertung erzeugen und im Memory sichern.",
    estimatedCost: "€0.09 / Run",
    governanceLevel: "low",
    nodes: [baseNodes.input, baseNodes.memory, baseNodes.ai, baseNodes.save],
  },
  {
    id: "connector-sandbox",
    name: "Connector Sandbox",
    description: "Connector-Call mit Privacy-, Approval- und Reporting-Schicht testen.",
    estimatedCost: "€0.13 / Run",
    governanceLevel: "high",
    nodes: [baseNodes.input, baseNodes.privacy, baseNodes.connector, baseNodes.approval, baseNodes.report],
  },
];
