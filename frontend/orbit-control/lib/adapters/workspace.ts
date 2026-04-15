import { orbitFetch } from "../core/orbit-fetch";
export const workspaceAdapter = { startRun: async(payload)=>orbitFetch("/chat", { method: "POST", body: JSON.stringify(payload), timeoutMs: 30000 }).then(r=>r.data), getWorkspace: async()=>orbitFetch("/ui/workspace").then(r=>r.data), getRuns: async()=>orbitFetch("/ui/runs").then(r=>r.data) };
export async function startWorkspaceRun(payload) { return workspaceAdapter.startRun(payload); }
