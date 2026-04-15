import { FlaskConical } from "lucide-react";
import { TestRunner } from "@/components/tests/test-runner";

export const metadata = { title: "Tests — KI-OS" };

export default function TestsPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-[16px] bg-[rgba(90,196,255,0.10)]">
          <FlaskConical className="size-5 text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Frontend Testsuite</h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Automatisierter End-to-End Test — simuliert alle UI-Aktionen (Buttons, Formulare, API-Calls)
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-[20px] border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
        <p className="text-xs text-yellow-200/70">
          <span className="font-semibold text-yellow-300">Hinweis:</span> Die Testsuite legt einen Test-Agent (<code className="font-mono">__KI_OS_TEST__</code>) an
          und löscht ihn am Ende wieder. Alle anderen Daten bleiben unverändert.
          Community Edition: Test schlägt fehl wenn das 3-Agent-Limit bereits erreicht ist.
        </p>
      </div>

      {/* Runner */}
      <TestRunner />
    </div>
  );
}
