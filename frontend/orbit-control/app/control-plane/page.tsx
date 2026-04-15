import { HealthPanel } from '../../components/control-plane/health-panel';
import { IncidentsPanel } from '../../components/control-plane/incidents-panel';
import { SecurityPanel } from '../../components/control-plane/security-panel';
import { TracesPanel } from '../../components/control-plane/traces-panel';
import { DlqPanel } from '../../components/control-plane/dlq-panel';
import { RecoveryPanel } from '../../components/control-plane/recovery-panel';
import { SupervisorMeshPanel } from '../../components/control-plane/supervisor-mesh-panel';

export default function ControlPlanePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Orbit Control</p>
            <h1 className="text-3xl font-semibold">Control Plane</h1>
            <p className="text-slate-400 mt-2">Health, Incidents, Security, Traces, DLQ, Recovery und Supervisor Mesh mit Auto-Refresh.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
            Operator View • Auto Refresh 15s
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <HealthPanel />
          <IncidentsPanel />
          <SecurityPanel />
          <TracesPanel />
          <DlqPanel />
          <RecoveryPanel />
        </section>

        <SupervisorMeshPanel />
      </div>
    </main>
  );
}
