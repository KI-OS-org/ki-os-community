import { orbitFetch } from "../core/orbit-fetch";

export type MissionControlTrust = "stable" | "review" | "attention";

export interface MissionControlStatus {
  trust: MissionControlTrust;
  activeFlows: number;
  memoryReady: boolean;
  traces: string;
}

export interface ContinueItem {
  id: string;
  title: string;
  subtitle: string;
  phase: string;
  href: string;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  hint: string;
  href: string;
}

export interface RecommendedSolution {
  id: string;
  title: string;
  summary: string;
  tag: string;
  href: string;
}

export interface CommandAction {
  id: string;
  label: string;
  section: string;
  keywords: string[];
  href: string;
}

export interface MissionControlData {
  greeting: string;
  smartInputPlaceholder: string;
  systemStatus: MissionControlStatus;
  continueWorking: ContinueItem[];
  quickActions: QuickAction[];
  recommendedSolutions: RecommendedSolution[];
  commandPalette: CommandAction[];
}

const fallbackMissionControlData: MissionControlData = {
  greeting: "Was möchtest du heute mit KI-OS erreichen?",
  smartInputPlaceholder:
    "Beschreibe dein Ziel, z. B. \"Erstelle ein Executive-Briefing aus den letzten Logs\" oder \"Analysiere die wichtigsten Risiken im aktuellen Run\".",
  systemStatus: {
    trust: "stable",
    activeFlows: 3,
    memoryReady: true,
    traces: "sichtbar",
  },
  continueWorking: [
    {
      id: "cw-routing-review",
      title: "Routing-Review fortsetzen",
      subtitle: "Die letzten Provider-Entscheidungen prüfen und auffällige Muster erkennen.",
      phase: "Analyse",
      href: "/control-plane",
    },
    {
      id: "cw-workspace-briefing",
      title: "Workspace-Briefing weiterführen",
      subtitle: "Letztes Executive-Briefing öffnen und ergänzen.",
      phase: "In Arbeit",
      href: "/workspace",
    },
  ],
  quickActions: [
    {
      id: "qa-start-workspace",
      title: "Workspace öffnen",
      description: "Direkt mit einem Ziel, einer Datei oder einer Aufgabe starten.",
      hint: "Ideal für Einsteiger und schnelle Ergebnisse",
      href: "/workspace",
    },
    {
      id: "qa-open-control-plane",
      title: "Control Plane prüfen",
      description: "Provider, Routing und laufende Entscheidungen transparent sehen.",
      hint: "Für Operator und Power User",
      href: "/control-plane",
    },
    {
      id: "qa-view-templates",
      title: "Templates nutzen",
      description: "Vordefinierte Einstiege für Retail, Executive und Operations aufrufen.",
      hint: "Schneller Start ohne Setup-Frust",
      href: "/templates",
    },
    {
      id: "qa-open-solutions",
      title: "Lösungen entdecken",
      description: "Passende Workflows und Lösungsbausteine nach Ziel auswählen.",
      hint: "Keine API-Wörter nötig",
      href: "/solutions",
    },
  ],
  recommendedSolutions: [
    {
      id: "rs-executive-briefing",
      title: "Executive Briefing aus aktuellem Systemstatus",
      summary: "Fasse Systemzustand, Provider-Lage und kritische Punkte als Management-Update zusammen.",
      tag: "Executive",
      href: "/workspace?goal=Executive%20Briefing%20zum%20aktuellen%20Systemstatus",
    },
    {
      id: "rs-routing-health",
      title: "Routing Health Check",
      summary: "Prüfe Scorecards, Ausreißer und Performance der aktiven Provider.",
      tag: "Control",
      href: "/control-plane",
    },
    {
      id: "rs-incident-review",
      title: "Incident Review vorbereiten",
      summary: "Erzeuge eine verständliche Zusammenfassung der wichtigsten offenen Themen.",
      tag: "Operations",
      href: "/workspace?goal=Fasse%20die%20wichtigsten%20offenen%20Themen%20zusammen",
    },
  ],
  commandPalette: [
    {
      id: "cp-home",
      label: "Mission Control öffnen",
      section: "Navigation",
      keywords: ["home", "start", "mission", "control"],
      href: "/",
    },
    {
      id: "cp-workspace",
      label: "Workspace starten",
      section: "Produktivität",
      keywords: ["workspace", "ziel", "aufgabe", "arbeiten"],
      href: "/workspace",
    },
    {
      id: "cp-control-plane",
      label: "Control Plane ansehen",
      section: "Monitoring",
      keywords: ["monitoring", "provider", "routing", "status"],
      href: "/control-plane",
    },
    {
      id: "cp-solutions",
      label: "Lösungen entdecken",
      section: "Navigation",
      keywords: ["lösungen", "solutions", "workflow", "module"],
      href: "/solutions",
    },
  ],
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function deriveTrust(failedRuns: number, waitingApprovals: number): MissionControlTrust {
  if (failedRuns > 0) return "attention";
  if (waitingApprovals > 0) return "review";
  return "stable";
}

function deriveActiveFlows(visible: any): number {
  const latestRuns = asArray<any>(visible?.dag?.latestRuns);
  if (latestRuns.length > 0) return latestRuns.length;
  const totalRuns = Number(visible?.executions?.totalRuns);
  return Number.isFinite(totalRuns) && totalRuns > 0 ? totalRuns : fallbackMissionControlData.systemStatus.activeFlows;
}

function deriveGreeting(visible: any): string {
  const providersOnline = visible?.topMetrics?.providersOnline;
  if (providersOnline) {
    const onlineCount = parseInt(String(providersOnline).split("/")[0], 10);
    if (onlineCount > 0) {
      return `Was möchtest du heute mit KI-OS erreichen? ${providersOnline} Provider sind gerade sichtbar.`;
    }
  }
  return fallbackMissionControlData.greeting;
}

function deriveContinueWorking(visible: any): ContinueItem[] {
  const latestRuns = asArray<any>(visible?.dag?.latestRuns);
  if (latestRuns.length === 0) return fallbackMissionControlData.continueWorking;

  return latestRuns.slice(0, 3).map((run, index) => ({
    id: String(run?.runId || `cw-${index}`),
    title: String(run?.task || `Lauf ${index + 1} fortsetzen`),
    subtitle: `Status: ${String(run?.status || "unbekannt")} · Coverage: ${String(run?.coverage ?? "n/a")}`,
    phase: String(run?.status || "In Arbeit"),
    href: run?.runId ? `/workspace?runId=${encodeURIComponent(String(run.runId))}` : "/workspace",
  }));
}

function deriveQuickActions(): QuickAction[] {
  return fallbackMissionControlData.quickActions;
}

function deriveRecommendedSolutions(visible: any): RecommendedSolution[] {
  const preferredProviders = asArray<any>(visible?.routing?.preferredProviders);
  if (preferredProviders.length === 0) return fallbackMissionControlData.recommendedSolutions;

  const providerCards = preferredProviders.slice(0, 2).map((item, index) => ({
    id: `rs-provider-${index}`,
    title: `${String(item?.provider || "Provider")} / ${String(item?.model || "Modell")}`,
    summary: `Score ${String(item?.score ?? "n/a")}, erfolgreiche Läufe ${String(item?.successRuns ?? "n/a")}, Ø Latenz ${String(item?.avgLatencyMs ?? "n/a")} ms.`,
    tag: "Routing",
    href: "/control-plane",
  }));

  return [...providerCards, fallbackMissionControlData.recommendedSolutions[0]].slice(0, 3);
}

function deriveCommandPalette(): CommandAction[] {
  return fallbackMissionControlData.commandPalette;
}

export const missionControlAdapter = {
  async getVisible() {
    const response = await orbitFetch<any>("/ui/control-plane/visible");
    return response.data;
  },
  async getProviders() {
    const response = await orbitFetch<any>("/ui/providers/live");
    return response.data;
  },
};

export async function getMissionControlVisible() {
  return missionControlAdapter.getVisible();
}

export async function getMissionControlProviders() {
  return missionControlAdapter.getProviders();
}

export async function getMissionControlData(): Promise<MissionControlData> {
  try {
    const [visible, providers] = await Promise.allSettled([
      missionControlAdapter.getVisible(),
      missionControlAdapter.getProviders(),
    ]);

    const visibleData = visible.status === "fulfilled" ? visible.value : null;
    const providersData = providers.status === "fulfilled" ? providers.value : null;

    if (!visibleData && !providersData) {
      return fallbackMissionControlData;
    }

    const failedRuns = Number(visibleData?.executions?.failed ?? 0);
    const waitingApprovals = Number(visibleData?.executions?.waitingApprovals ?? 0);
    const traces = visibleData?.telemetry?.enabled === false ? "begrenzt" : "sichtbar";
    const providersOnline = providersData?.routing?.preferredProviders?.length;

    return {
      greeting: deriveGreeting(visibleData),
      smartInputPlaceholder: fallbackMissionControlData.smartInputPlaceholder,
      systemStatus: {
        trust: deriveTrust(failedRuns, waitingApprovals),
        activeFlows: deriveActiveFlows(visibleData),
        memoryReady: Boolean(visibleData?.observability || visibleData?.telemetry),
        traces: providersOnline ? `sichtbar · ${providersOnline} bevorzugte Provider` : traces,
      },
      continueWorking: deriveContinueWorking(visibleData),
      quickActions: deriveQuickActions(),
      recommendedSolutions: deriveRecommendedSolutions(visibleData),
      commandPalette: deriveCommandPalette(),
    };
  } catch {
    return fallbackMissionControlData;
  }
}
