import { orbitFetch } from "../core/orbit-fetch";
async function getSnapshot() { const [rootPayload, ops, kpis, promo, executive, brain] = await Promise.all([ orbitFetch("/retail").then(r=>r.data), orbitFetch("/retail/ops").then(r=>r.data), orbitFetch("/retail/kpis").then(r=>r.data), orbitFetch("/retail/promo").then(r=>r.data), orbitFetch("/retail/executive").then(r=>r.data), orbitFetch("/retail-brain").then(r=>r.data) ]); return { rootPayload, ops, kpis, promo, executive, brain }; }
export const retailAdapter = { getSnapshot, getOps: async()=>orbitFetch("/retail/ops").then(r=>r.data), getBrain: async()=>orbitFetch("/retail-brain").then(r=>r.data), evaluateDecision: async(payload={})=>orbitFetch("/retail-brain/evaluate", { method: "POST", body: JSON.stringify(payload) }).then(r=>r.data), getPromoPricing: async()=>orbitFetch("/retail/promo").then(r=>r.data), getExecutive: async()=>orbitFetch("/retail/executive").then(r=>r.data) };
export async function getRetailOps() { return retailAdapter.getOps(); }
export async function getRetailBrain() { return retailAdapter.getBrain(); }
export async function getRetailDecisionEvaluator() { return retailAdapter.evaluateDecision({}); }
export async function getRetailPromoPricing() { return retailAdapter.getPromoPricing(); }
export async function getRetailExecutive() { return retailAdapter.getExecutive(); }
