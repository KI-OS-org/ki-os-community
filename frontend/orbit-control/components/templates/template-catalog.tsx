const templates = [
  { id: 'retail-kpi-briefing', title: 'Retail KPI Briefing', role: 'Executive', category: 'Retail', quickActions: ['Jetzt starten', 'Anpassen'] },
  { id: 'promo-impact-check', title: 'Promo Impact Check', role: 'Retail', category: 'Retail', quickActions: ['Check starten', 'Daten anhängen'] },
  { id: 'pricing-decision-note', title: 'Pricing Decision Note', role: 'Commercial', category: 'Retail', quickActions: ['Analyse starten', 'Teilen'] },
  { id: 'loyalty-insight-scan', title: 'Loyalty Insight Scan', role: 'CRM', category: 'Retail', quickActions: ['Insights holen', 'Export'] },
  { id: 'ops-incident-summary', title: 'Ops Incident Summary', role: 'Operator', category: 'Operations', quickActions: ['Zusammenfassen', 'Weiterleiten'] },
  { id: 'governance-risk-review', title: 'Governance Risk Review', role: 'Admin', category: 'Control', quickActions: ['Prüfen', 'Freigeben'] },
  { id: 'tenant-health-check', title: 'Tenant Health Check', role: 'Admin', category: 'Control', quickActions: ['Health abrufen', 'Vergleichen'] },
  { id: 'routing-cost-review', title: 'Routing Cost Review', role: 'Operator', category: 'Control', quickActions: ['Kosten prüfen', 'Optimieren'] },
  { id: 'meeting-briefing', title: 'Meeting Briefing', role: 'Executive', category: 'Workspace', quickActions: ['Briefing bauen', 'Kalenderkontext'] },
  { id: 'research-fast-track', title: 'Research Fast Track', role: 'Analyst', category: 'Workspace', quickActions: ['Recherche starten', 'Quellen anhängen'] },
  { id: 'memory-recall-pack', title: 'Memory Recall Pack', role: 'Power User', category: 'Workspace', quickActions: ['Memory holen', 'Fortsetzen'] },
  { id: 'file-to-summary', title: 'File to Summary', role: 'Einsteiger', category: 'Workspace', quickActions: ['Datei hochladen', 'Zusammenfassen'] },
  { id: 'board-decision-card', title: 'Board Decision Card', role: 'Executive', category: 'Executive', quickActions: ['Karte erzeugen', 'Freigeben'] },
  { id: 'supplier-risk-scan', title: 'Supplier Risk Scan', role: 'Procurement', category: 'Operations', quickActions: ['Scan starten', 'Risiko teilen'] },
  { id: 'webhook-action-starter', title: 'Webhook Action Starter', role: 'Power User', category: 'Integrations', quickActions: ['Webhook wählen', 'Action starten'] },
  { id: 'customer-complaint-triage', title: 'Customer Complaint Triage', role: 'Service', category: 'Operations', quickActions: ['Triage starten', 'Escalation'] },
];

function ResultCard({ title, role, category }: { title: string; role: string; category: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <span className="rounded-full border border-cyan-400/30 px-2 py-1 text-xs text-cyan-200">{role}</span>
      </div>
      <p className="text-sm text-slate-300">Kategorie: {category}</p>
      <div className="mt-4 flex gap-2">
        <button className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950">Jetzt starten</button>
        <button className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Dialog öffnen</button>
      </div>
    </div>
  );
}

export function TemplateCatalog() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Orbit Control · F5</p>
          <h1 className="text-3xl font-semibold">Templates &amp; No-Code Actions</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            Vorlagen für schnellen Nutzen ohne Flow-Bau. Jede Hauptaktion bleibt in maximal drei Schritten startbar.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => (
            <ResultCard key={template.id} title={template.title} role={template.role} category={template.category} />
          ))}
        </div>
      </section>
    </main>
  );
}

export { templates };
