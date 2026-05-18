"use client";

/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Decision Theater — Share-Dialog für Tier-basierte Run-Freigaben mit Redaction-Preview und Sichtbarkeitsregeln
 */

import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Eye, EyeOff, Shield } from "lucide-react";

type TierId = "community" | "business" | "enterprise";
type Visibility = "private" | "unlisted" | "public";
type RedactionType = "pii" | "prompt" | "secret";

type TierAccent = {
  id: string;
  label: string;
  subtitle: string;
  bg: string;
  border: string;
};

type TierInfo = {
  rules: string[];
  legal: string;
  retention: string;
  host: string;
};

type TierButtonProps = {
  tierId: TierId;
  accent: TierAccent;
  active: boolean;
  onClick: () => void;
};

type RedactedChunkProps = {
  children: React.ReactNode;
  type: RedactionType;
  tier: TierId;
};

const TIERS: Record<TierId, TierAccent> = {
  community: {
    id: "Tier 1",
    label: "Community",
    subtitle: "ki-os.org Relay",
    bg: "rgba(34,197,94,0.12)",
    border: "var(--accent-green)",
  },
  business: {
    id: "Tier 2",
    label: "Business",
    subtitle: "Self-hosted",
    bg: "rgba(251,146,60,0.12)",
    border: "var(--accent-orange)",
  },
  enterprise: {
    id: "Tier 3",
    label: "Enterprise",
    subtitle: "Customer AWS",
    bg: "rgba(167,139,250,0.12)",
    border: "var(--accent-purple)",
  },
};

const TIER_INFO: Record<TierId, TierInfo> = {
  community: {
    rules: [
      "Alle PII-Muster werden hart entfernt und durch Platzhalter ersetzt",
      "User-Prompts komplett unkenntlich — nur Agent-Outputs sichtbar",
      "Tool-Payloads werden nach Regex-Scan maskiert",
      "Connector-Responses durchlaufen einen zweiten LLM-Filter",
    ],
    legal: "Opt-In · AV nicht nötig · Daten sind effektiv anonymisiert",
    retention: "Snapshot liegt 90 Tage auf ki-os.org EU Relay",
    host: "ki-os.org · Frankfurt · DSGVO-konform",
  },
  business: {
    rules: [
      "PII-Erkennung läuft, aber Admin kann Kategorien einzeln freigeben",
      "Prompts sind für Team-Mitglieder sichtbar, für externe Links gefiltert",
      "Rollen-basierte Sicht: Entwickler · Reviewer · Auditor sehen Verschiedenes",
      "Share-Aktionen werden im Audit-Log persistiert inkl. Tenant-Watermark",
    ],
    legal: "Interner Zweck · AV-Vertrag mit Team-Organisation · Art. 6 (1) f",
    retention: "Konfigurierbar · Default 180 Tage · Archiv-Mode nach Ablauf",
    host: "Eure eigene AWS · Azure · On-Prem — ihr entscheidet",
  },
  enterprise: {
    rules: [
      "Volle Sichtbarkeit für Auditor-Rolle · ISO 27001 konform",
      "4-Augen-Prinzip: jeder Share braucht zweite Freigabe",
      "Jeder Snapshot ist Hash-signiert und in Chain verknüpft",
      "Keine öffentlichen Share-Links — Zugriff nur über authentifizierte User",
    ],
    legal: "Kunde ist Verantwortlicher · KI-OS ist Auftragsverarbeiter",
    retention: "Gemäß Retention-Policy des Kunden · Legal Hold supported",
    host: "Kunden-eigenes AWS · Private Subnets · KMS-Encryption",
  },
};

function TierButton({ tierId, accent, active, onClick }: TierButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-[24px] px-4 py-4 text-left transition-all"
      style={{
        background: active ? accent.bg : "transparent",
        border: active ? `1px solid ${accent.border}` : "1px solid transparent",
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: active ? accent.border : "var(--muted-foreground)" }}>
        {accent.id}
      </div>
      <div className="mt-1 text-sm font-semibold" style={{ color: active ? accent.border : "var(--foreground)" }}>
        {accent.label}
      </div>
      <div className="mt-0.5 text-[11px]" style={{ color: active ? accent.border : "var(--muted-foreground)" }}>
        {accent.subtitle}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.14em]" style={{ color: active ? accent.border : "rgba(169,183,230,0.55)" }}>
        {tierId}
      </div>
    </button>
  );
}

function RedactedChunk({ children, type, tier }: RedactedChunkProps) {
  const colors: Record<RedactionType, { bg: string; border: string; text: string; label: string }> = {
    pii: { bg: "#3B1515", border: "#A32D2D", text: "var(--accent-red)", label: "pii" },
    prompt: { bg: "#1A2F3B", border: "#185FA5", text: "var(--accent-blue)", label: "prompt" },
    secret: { bg: "#3B2A15", border: "#854F0B", text: "var(--accent-orange)", label: "secret" },
  };

  const color = colors[type];
  const hidden =
    tier === "community" ||
    (tier === "business" && type !== "prompt") ||
    (tier === "enterprise" && type === "secret");

  return (
    <span
      className="inline-flex items-baseline gap-1 rounded-sm px-1.5"
      style={{ background: color.bg, border: `1px solid ${color.border}` }}
    >
      <span className="text-[9px] uppercase tracking-wider" style={{ color: color.text, opacity: 0.7 }}>
        {color.label}
      </span>
      {hidden ? (
        <span style={{ color: color.text, letterSpacing: "0.1em" }}>████████</span>
      ) : (
        <span style={{ color: color.text }}>{children}</span>
      )}
    </span>
  );
}

export default function TheaterShareDialog() {
  const [tier, setTier] = useState<TierId>("community");
  const [visibility, setVisibility] = useState<Visibility>("unlisted");
  const [title, setTitle] = useState<string>("Retail-Agent: Retoure-Bearbeitung Live-Run");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const current = TIER_INFO[tier];
  const accent = TIERS[tier];
  const VisibilityIcon = visibility === "private" ? EyeOff : Eye;

  return (
    <div className="min-h-screen p-6 lg:p-8" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-baseline gap-3">
          <div
            className="text-xs font-mono px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(90,196,255,0.10)", color: "var(--accent)" }}
          >
            Decision Theater
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Share this run</h1>
        </div>

        <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur">
          <div className="border-b border-white/10 p-3">
            <div className="flex flex-col gap-2 md:flex-row">
              {(Object.keys(TIERS) as TierId[]).map((key) => (
                <TierButton
                  key={key}
                  tierId={key}
                  accent={TIERS[key]}
                  active={tier === key}
                  onClick={() => setTier(key)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--muted-foreground)" }}>
                Run title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full border-0 border-b bg-transparent pb-2 text-lg font-medium outline-none"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </div>

            <div>
              <label className="mb-3 block text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--muted-foreground)" }}>
                Redaction preview
              </label>
              <div
                className="rounded-[24px] border p-5 font-mono text-[13px] leading-7"
                style={{ background: "rgba(5,8,22,0.82)", borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
              >
                <div>
                  <span style={{ color: "var(--muted-foreground)" }}>[step 3]</span>{" "}
                  <span style={{ color: "var(--accent-green)" }}>user_prompt</span>{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>→</span>{" "}
                  <RedactedChunk type="prompt" tier={tier}>Kunde Maria Schmidt (Nr. 44892) möchte Retoure</RedactedChunk>
                </div>
                <div>
                  <span style={{ color: "var(--muted-foreground)" }}>[step 4]</span>{" "}
                  <span style={{ color: "var(--accent-orange)" }}>tool_call</span>{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>crm.lookup</span>{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>→</span>{" "}
                  <RedactedChunk type="pii" tier={tier}>maria.schmidt@example.com</RedactedChunk>
                  <span style={{ color: "var(--muted-foreground)" }}>, +49 30 </span>
                  <RedactedChunk type="pii" tier={tier}>12345678</RedactedChunk>
                </div>
                <div>
                  <span style={{ color: "var(--muted-foreground)" }}>[step 5]</span>{" "}
                  <span style={{ color: "var(--accent-purple)" }}>agent_output</span>{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>→</span>{" "}
                  <span style={{ color: "var(--foreground)" }}>Retoure ist gemäß AGB § 4 möglich, Rückversand an Lager DE-2.</span>
                </div>
                <div>
                  <span style={{ color: "var(--muted-foreground)" }}>[step 6]</span>{" "}
                  <span style={{ color: "var(--accent-orange)" }}>api_key</span>{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>→</span>{" "}
                  <RedactedChunk type="secret" tier={tier}>sk-ant-prod-8f3a9b...</RedactedChunk>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2 text-[13px]">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.15em]" style={{ color: accent.border }}>
                  <Shield className="h-3.5 w-3.5" />
                  Schwärzungs-Regeln
                </div>
                <ul className="space-y-1.5" style={{ color: "var(--muted-foreground)" }}>
                  {current.rules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span style={{ color: accent.border }}>—</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.15em]" style={{ color: accent.border }}>
                    Rechtliche Basis
                  </div>
                  <div style={{ color: "var(--muted-foreground)" }}>{current.legal}</div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.15em]" style={{ color: accent.border }}>
                    Retention
                  </div>
                  <div style={{ color: "var(--muted-foreground)" }}>{current.retention}</div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.15em]" style={{ color: accent.border }}>
                    Hosting
                  </div>
                  <div style={{ color: "var(--muted-foreground)" }}>{current.host}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <label className="mb-3 block text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--muted-foreground)" }}>
                Sichtbarkeit
              </label>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-wrap gap-2">
                  {(["private", "unlisted", "public"] as Visibility[]).map((value) => {
                    const Icon = value === "private" ? EyeOff : Eye;
                    const active = visibility === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setVisibility(value)}
                        className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition hover:opacity-90"
                        style={
                          active
                            ? { background: "var(--accent-dim)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }
                            : { background: "transparent", border: "1px solid var(--border)", color: "var(--muted-foreground)" }
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {value}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1" />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCopied(true)}
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition hover:opacity-90"
                    style={{ background: "var(--accent-dim)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Kopiert" : "Preview-Link"}
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm font-medium transition hover:opacity-90"
                    style={{ background: "var(--accent)", color: "#0a0f1e" }}
                  >
                    <VisibilityIcon className="h-4 w-4" />
                    Freigeben
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div
          className="mt-6 rounded-[24px] p-4 text-[12px] leading-relaxed"
          style={{ background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.2)", color: "#d4b072" }}
        >
          <span className="inline-flex items-center gap-2 font-semibold" style={{ color: "var(--accent-orange)" }}>
            <AlertTriangle className="h-4 w-4" />
            Hinweis · DSGVO Art. 5
          </span>{" "}
          Die Redaction-Preview oben zeigt exakt, was geteilt wird. Felder in farbigen Kästen werden entsprechend der gewählten Tier-Policy geschwärzt. Die Redaction passiert vor dem Upload und ist nicht umkehrbar. Bei Zweifel bitte auf Community-Tier wechseln.
        </div>
      </div>
    </div>
  );
}
