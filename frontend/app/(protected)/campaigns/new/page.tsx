"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";

const TONES   = ["professional", "casual", "inspiring", "urgent", "informative"];
const LANGS   = [{ value: "de", label: "Deutsch" }, { value: "en", label: "English" }];
const PLATFORMS_OPTIONS = [
  { value: "manual",   label: "Manuell (kein Connector)", note: "Community Edition" },
  { value: "twitter",  label: "X / Twitter",              note: "Community Edition" },
  { value: "instagram",label: "Instagram",                 note: "Community Edition" },
  { value: "tiktok",   label: "TikTok",                    note: "Connector erforderlich" },
  { value: "email",    label: "E-Mail / Newsletter",       note: "Connector erforderlich" },
  { value: "linkedin", label: "LinkedIn",                  note: "Connector erforderlich" },
];

type Form = {
  name:        string;
  goal:        string;
  product:     string;
  audience:    string;
  tone:        string;
  language:    string;
  platforms:   string[];
  budgetCents: string;
  currency:    string;
  scheduleAt:  string;
};

const STEPS = ["Ziel & Produkt", "Zielgruppe & Ton", "Plattformen & Budget", "Überprüfen & Starten"];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
            i < current  ? "bg-[#5ac4ff] border-[#5ac4ff] text-black"  :
            i === current ? "border-[#5ac4ff] text-[#5ac4ff] bg-[#5ac4ff]/10" :
                            "border-white/20 text-gray-500"
          }`}>
            {i < current ? <Check size={13} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-px w-8 transition-colors ${i < current ? "bg-[#5ac4ff]/60" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [form, setForm] = useState<Form>({
    name:        "",
    goal:        "",
    product:     "",
    audience:    "",
    tone:        "professional",
    language:    "de",
    platforms:   ["manual"],
    budgetCents: "",
    currency:    "EUR",
    scheduleAt:  "",
  });

  function set(key: keyof Form, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function togglePlatform(p: string) {
    set("platforms", form.platforms.includes(p)
      ? form.platforms.filter(x => x !== p)
      : [...form.platforms, p]
    );
  }

  function canNext() {
    if (step === 0) return form.goal.trim().length >= 5 && form.product.trim().length >= 2;
    if (step === 1) return true;
    if (step === 2) return form.platforms.length > 0;
    return true;
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...form,
        budgetCents: form.budgetCents ? Math.round(parseFloat(form.budgetCents) * 100) : 0,
        scheduleAt:  form.scheduleAt || null,
      };
      const res  = await fetch("/api/campaigns", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Fehler beim Erstellen der Kampagne");
        return;
      }
      router.push("/campaigns");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";
  const labelCls = "block text-xs text-gray-400 mb-1.5 font-medium";

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/campaigns" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={16} />
          Zurück zu Kampagnen
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Megaphone className="text-[#5ac4ff]" size={26} />
          <div>
            <h1 className="text-xl font-bold">Neue Kampagne</h1>
            <p className="text-sm text-gray-400">Schritt {step + 1} von {STEPS.length} — {STEPS[step]}</p>
          </div>
        </div>

        {/* Step Indicator */}
        <StepIndicator current={step} total={STEPS.length} />

        {/* Card */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">

          {/* ── Step 0: Ziel & Produkt ─────────────────────────── */}
          {step === 0 && (
            <>
              <div>
                <label className={labelCls}>Kampagnen-Name (optional)</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="z.B. Sommer-Launch 2026" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kampagnenziel *</label>
                <textarea
                  value={form.goal}
                  onChange={e => set("goal", e.target.value)}
                  rows={3}
                  placeholder="Was soll die Kampagne erreichen? z.B. Markenbekanntheit steigern, Neukunden gewinnen..."
                  className={inputCls + " resize-none"}
                />
                <div className="text-xs text-gray-500 mt-1">{form.goal.length} Zeichen (min. 5)</div>
              </div>
              <div>
                <label className={labelCls}>Produkt / Dienstleistung *</label>
                <input value={form.product} onChange={e => set("product", e.target.value)} placeholder="z.B. KI-OS Enterprise, Premium-Software, Beratungspaket..." className={inputCls} />
              </div>
            </>
          )}

          {/* ── Step 1: Zielgruppe & Ton ───────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <label className={labelCls}>Zielgruppe</label>
                <textarea
                  value={form.audience}
                  onChange={e => set("audience", e.target.value)}
                  rows={2}
                  placeholder="z.B. IT-Entscheider in mittelständischen Unternehmen, 35-55 Jahre..."
                  className={inputCls + " resize-none"}
                />
              </div>
              <div>
                <label className={labelCls}>Ton & Stil</label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map(t => (
                    <button
                      key={t}
                      onClick={() => set("tone", t)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors capitalize ${
                        form.tone === t
                          ? "bg-[#5ac4ff]/20 border-[#5ac4ff]/40 text-[#5ac4ff]"
                          : "border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Sprache</label>
                <div className="flex gap-2">
                  {LANGS.map(l => (
                    <button
                      key={l.value}
                      onClick={() => set("language", l.value)}
                      className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                        form.language === l.value
                          ? "bg-[#5ac4ff]/20 border-[#5ac4ff]/40 text-[#5ac4ff]"
                          : "border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Plattformen & Budget ──────────────────── */}
          {step === 2 && (
            <>
              <div>
                <label className={labelCls}>Zielplattformen *</label>
                <div className="space-y-2">
                  {PLATFORMS_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => togglePlatform(p.value)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-colors text-left ${
                        form.platforms.includes(p.value)
                          ? "bg-[#5ac4ff]/10 border-[#5ac4ff]/40 text-white"
                          : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${form.platforms.includes(p.value) ? "bg-[#5ac4ff] border-[#5ac4ff]" : "border-white/20"}`}>
                          {form.platforms.includes(p.value) && <Check size={10} className="text-black" />}
                        </div>
                        {p.label}
                      </div>
                      <span className="text-xs text-gray-500">{p.note}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Budget (optional)</label>
                  <input
                    type="number"
                    value={form.budgetCents}
                    onChange={e => set("budgetCents", e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Währung</label>
                  <select value={form.currency} onChange={e => set("currency", e.target.value)} className={inputCls}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Geplante Ausführung (optional)</label>
                <input type="datetime-local" value={form.scheduleAt} onChange={e => set("scheduleAt", e.target.value)} className={inputCls} />
              </div>
            </>
          )}

          {/* ── Step 3: Review ────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-300 mb-3">Zusammenfassung</div>
              {[
                { label: "Name",        value: form.name || "(automatisch)" },
                { label: "Ziel",        value: form.goal },
                { label: "Produkt",     value: form.product },
                { label: "Zielgruppe",  value: form.audience || "—" },
                { label: "Ton",         value: form.tone },
                { label: "Sprache",     value: form.language },
                { label: "Plattformen", value: form.platforms.join(", ") },
                { label: "Budget",      value: form.budgetCents ? `${form.budgetCents} ${form.currency}` : "Kein Budget" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3 text-sm">
                  <span className="text-gray-500 w-28 shrink-0">{label}</span>
                  <span className="text-white">{value}</span>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-400">
                Nach dem Erstellen kannst du die Kampagne auf der Übersichtsseite starten.
                Der DAG generiert Content und Budget-Plan — kein automatisches Posten ohne Social-Connector.
              </div>
            </div>
          )}

        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : router.push("/campaigns")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-sm hover:text-white hover:border-white/20 transition-colors"
          >
            <ChevronLeft size={15} />
            {step === 0 ? "Abbrechen" : "Zurück"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
            >
              Weiter
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Kampagne erstellen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
