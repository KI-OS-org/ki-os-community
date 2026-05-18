export function TemplateStartDialog({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
