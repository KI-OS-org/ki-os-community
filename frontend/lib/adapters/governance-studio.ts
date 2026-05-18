// @ts-nocheck
import { orbitFetch } from "../core/orbit-fetch";
async function getStudioSnapshot() { const [registry, policies, approvals, privacy, explain] = await Promise.all([ orbitFetch("/ui/governance/registry").then(r=>r.data), orbitFetch("/ui/governance/policies").then(r=>r.data), orbitFetch("/ui/governance/approvals").then(r=>r.data), orbitFetch("/ui/privacy").then(r=>r.data), orbitFetch("/ui/policy/explain").then(r=>r.data) ]); return { registry, policies: policies?.items || policies, approvals: approvals?.items || approvals, privacy, explain }; }
async function simulate(payload) { return orbitFetch("/governance/simulate", { method: "POST", body: JSON.stringify(payload) }).then(r=>r.data); }
export const governanceStudioAdapter = { getStudioSnapshot, simulate, getApprovals: async()=>orbitFetch("/ui/governance/approvals").then(r=>r.data) };
export async function getGovernanceRegistry() { return orbitFetch("/governance/registry").then(r=>r.data); }
export async function simulateGovernance(payload) { return simulate(payload); }
export async function getGovernanceApprovals() { return governanceStudioAdapter.getApprovals(); }
