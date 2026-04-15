import {
  Activity,
  Bell,
  Bot,
  BrainCircuit,
  Briefcase,
  Cpu,
  Database,
  FileSearch,
  FileText,
  Film,
  FlaskConical,
  Globe,
  Home,
  Lock,
  Megaphone,
  Mic,
  Network,
  PanelLeft,
  PlugZap,
  ShieldCheck,
  TrendingUp,
  Video,
  Webhook,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label:       string;
  href:        string;
  icon:        LucideIcon;
  description: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigationSections: NavSection[] = [
  {
    label: "",   // no heading for top-level single item
    items: [
      { label: "Home", href: "/", icon: Home, description: "Mission Control & schneller Einstieg" },
    ],
  },
  {
    label: "Agents",
    items: [
      { label: "AgentMesh",  href: "/agentmesh", icon: Network,   description: "Multi-Agent Mesh — Tasks starten und überwachen" },
      { label: "Agents",     href: "/agents",    icon: Bot,       description: "Agents verwalten, kategorisieren, steuern" },
      { label: "Flows",      href: "/flows",     icon: Workflow,  description: "No-Code und Low-Code Automatisierung" },
      { label: "Runs",       href: "/runs",      icon: Activity,  description: "Agent Runtime, Traces und Replay" },
      { label: "Jobs",       href: "/jobs",      icon: Briefcase, description: "Queue, Scheduler und Trigger" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Workspace",  href: "/workspace", icon: PanelLeft,    description: "Streaming, Dateien und Ergebnisse" },
      { label: "Memory",     href: "/memory",    icon: BrainCircuit, description: "Memory Explorer, Scopes und Governance" },
      { label: "Files",      href: "/files",     icon: FileText,     description: "Dateien hochladen, durchsuchen und verwalten" },
      { label: "Documents",  href: "/documents", icon: FileSearch,   description: "PDF-Text extrahieren, Excel-Daten parsen" },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Connector Galaxy", href: "/connector-galaxy", icon: Globe,    description: "Live-Konnektoren · Grün · Gelb · Rot" },
      { label: "Integrations",     href: "/integrations",     icon: PlugZap,  description: "Apps, Webhooks und Connector Ops" },
      { label: "Webhooks",         href: "/webhooks",         icon: Webhook,  description: "Webhooks verwalten, testen und Dispatches" },
      { label: "Providers",        href: "/providers",        icon: Database, description: "Modell-Routing, Fallback und Health" },
      { label: "MCP",              href: "/mcp",              icon: Cpu,      description: "Model Context Protocol — Capabilities und Invoke" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Campaigns",    href: "/campaigns", icon: Megaphone, description: "Campaign Orchestrator — Content generieren und koordinieren" },
      { label: "Economic",     href: "/economic",  icon: TrendingUp, description: "Wirtschaftsmodelle, Profile und Scorecards" },
      { label: "Efficiency",   href: "/efficiency", icon: TrendingUp, description: "KI-Analyse: Wettbewerber, Feature-Ideen, Updates" },
      { label: "Media Studio", href: "/media",     icon: Film,       description: "Bild, Video und Audio — Generierung & Synthesis" },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Control",    href: "/control",    icon: ShieldCheck,   description: "Governance, Health und Audit" },
      { label: "Trust",      href: "/trust",      icon: ShieldCheck,   description: "Audit, PKI, Policies und Compliance" },
      { label: "Privacy",    href: "/privacy",    icon: Lock,          description: "PII erkennen, maskieren und de-maskieren" },
      { label: "Supervisor", href: "/supervisor", icon: Activity,      description: "Eskalationen, Recovery-Cockpit und Playbooks" },
      { label: "Tests",      href: "/tests",      icon: FlaskConical,  description: "Automatisierte Frontend- und API-Tests" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Tenants",       href: "/tenants",       icon: Database, description: "Mandantenverwaltung — Pläne, Config und Isolation" },
      { label: "State",         href: "/state",         icon: Database, description: "State Fabric, Export/Import und Backends" },
      { label: "Notifications", href: "/notifications", icon: Bell,     description: "Benachrichtigungen — Runs, Agents, Budget-Warnungen" },
    ],
  },
];

// Flat array for backward compatibility (used by any code that imports primaryNavigation)
export const primaryNavigation = navigationSections.flatMap((s) => s.items);
