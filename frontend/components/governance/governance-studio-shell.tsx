import React from 'react';
import { appConfig } from "@/lib/config";

type Policy = {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'disabled';
  residency: string;
  budgetCents: number;
  killSwitch: boolean;
  privacyLevel: string;
};

type Approval = { id: string; title: string; requester: string; status: string; priority: string };
type Simulation = { decision: string; allowedModels: string[]; notes: string[] };

export type GovernanceStudioSnapshot = {
  policies: Policy[];
  selectedPolicy: Policy;
  approvalQueue: Approval[];
  privacyPanel: { piiMasking: boolean; retentionDays: number; residency: string };
  simulation: Simulation;
};

// ---------------------------------------------------------------------------
// Server component wrapper — fetches real data and passes it to the shell
// ---------------------------------------------------------------------------
export async function GovernanceStudioPage() {
  const baseUrl = appConfig.apiUrl;

  async function safeFetch(url: string) {
    try {
      const res = await fetch(url, { next: { revalidate: 30 } });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  const [registryData, approvalsData] = await Promise.all([
    safeFetch(`${baseUrl}/api/governance/registry`),
    safeFetch(`${baseUrl}/api/governance/approvals`),
  ]);

  const defaultPolicy: Policy = {
    id: "default",
    name: "Default Policy",
    status: "active",
    residency: "EU",
    budgetCents: 5000,
    killSwitch: false,
    privacyLevel: "standard",
  };

  const policies: Policy[] = Array.isArray(registryData?.policies)
    ? registryData.policies
    : Array.isArray(registryData)
      ? registryData
      : [defaultPolicy];

  const approvalQueue: Approval[] = Array.isArray(approvalsData?.items)
    ? approvalsData.items
    : Array.isArray(approvalsData)
      ? approvalsData
      : [];

  const snapshot: GovernanceStudioSnapshot = {
    policies,
    selectedPolicy: policies[0] ?? defaultPolicy,
    approvalQueue,
    privacyPanel: registryData?.privacyPanel ?? {
      piiMasking: true,
      retentionDays: 90,
      residency: "EU",
    },
    simulation: registryData?.simulation ?? {
      decision: "allow",
      allowedModels: ["gpt-4o", "claude-3-5-sonnet"],
      notes: ["Policy active", "Budget within limits"],
    },
  };

  return <GovernanceStudioShell snapshot={snapshot} />;
}

// ---------------------------------------------------------------------------
// Display shell (pure presentational)
// ---------------------------------------------------------------------------
export function GovernanceStudioShell({ snapshot }: { snapshot: GovernanceStudioSnapshot }) {
  return (
    <main className="grid gap-6 p-6 lg:grid-cols-[280px_1fr_320px]">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <h1 className="text-xl font-semibold">Governance Studio</h1>
        <p className="mt-2 text-sm opacity-80">Policies lesbar, Simulator nutzbar, Freigaben sichtbar.</p>
        <div className="mt-4 space-y-3">
          {snapshot.policies.map((policy) => (
            <div key={policy.id} className="rounded-xl border border-white/10 p-3">
              <div className="font-medium">{policy.name}</div>
              <div className="text-xs opacity-70">{policy.id}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span>Status: {policy.status}</span>
                <span>Residency: {policy.residency}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div>
          <h2 className="text-lg font-semibold">Policy Details</h2>
          <div className="mt-3 rounded-xl border border-white/10 p-4">
            <div className="font-medium">{snapshot.selectedPolicy.name}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
              <div>Kill Switch: {snapshot.selectedPolicy.killSwitch ? 'aktiv' : 'inaktiv'}</div>
              <div>Budget: {snapshot.selectedPolicy.budgetCents} Cent</div>
              <div>Residency: {snapshot.selectedPolicy.residency}</div>
              <div>Privacy: {snapshot.selectedPolicy.privacyLevel}</div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Policy Simulator</h2>
          <div className="mt-3 rounded-xl border border-white/10 p-4 text-sm">
            <div>Decision: {snapshot.simulation.decision}</div>
            <div className="mt-2">Allow Models: {snapshot.simulation.allowedModels.join(', ')}</div>
            <ul className="mt-3 list-disc pl-5">
              {snapshot.simulation.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h2 className="text-lg font-semibold">Approval Queue</h2>
          <div className="mt-3 space-y-3">
            {snapshot.approvalQueue.map((approval, idx) => (
              <div key={approval.id ?? idx} className="rounded-xl border border-white/10 p-3 text-sm">
                <div className="font-medium">{approval.title}</div>
                <div className="opacity-70">{approval.requester}</div>
                <div className="mt-2 flex justify-between">
                  <span>{approval.status}</span>
                  <span>{approval.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
          <h2 className="text-lg font-semibold">Privacy Panel</h2>
          <div className="mt-3">PII Masking: {snapshot.privacyPanel.piiMasking ? 'an' : 'aus'}</div>
          <div>Retention: {snapshot.privacyPanel.retentionDays} Tage</div>
          <div>Residency: {snapshot.privacyPanel.residency}</div>
        </div>
      </aside>
    </main>
  );
}
