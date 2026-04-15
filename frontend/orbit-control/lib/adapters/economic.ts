import { orbitFetch } from "../core/orbit-fetch";
async function getDashboard() { const [overview, profiles, scorecards, decisions] = await Promise.all([ orbitFetch("/economic").then(r=>r.data), orbitFetch("/economic/profiles").then(r=>r.data), orbitFetch("/economic/scorecards").then(r=>r.data), orbitFetch("/economic/decisions").then(r=>r.data) ]); return { overview, profiles, scorecards, decisions }; }
async function getDecisionLog() { return orbitFetch("/economic/decisions").then(r=>r.data); }
async function switchProfile(profile) { return orbitFetch("/economic/evaluate", { method: "POST", body: JSON.stringify({ profile }) }).then(r=>r.data); }
export const economicAdapter = { getDashboard, getDecisionLog, switchProfile };
export async function getEconomicDashboard() { return getDashboard(); }
export async function getEconomicDecisionLog() { return getDecisionLog(); }
export async function switchEconomicProfile(profile) { return switchProfile(profile); }
