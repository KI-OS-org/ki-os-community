import { OrbitHeader } from "@/components/orbit/orbit-header";
import { OrbitSidebar } from "@/components/orbit/orbit-sidebar";
import { SmartInputBar } from "@/components/home/smart-input-bar";
import { SystemStatusWidget } from "@/components/home/system-status-widget";
import { ContinueWorking } from "@/components/home/continue-working";
import { QuickActions } from "@/components/home/quick-actions";
import { RecommendedSolutions } from "@/components/home/recommended-solutions";
import { getMissionControlData } from "@/lib/adapters/mission-control";
import { Badge } from "@/components/ui/badge";
import { AIDigestBanner } from "@/components/demo/ai-digest-banner";

export async function MissionControl() {
  const data = await getMissionControlData();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(52,116,255,0.25),transparent_32%),linear-gradient(180deg,#08101f,#04060c)] p-4 text-[var(--foreground)] xl:p-6">
      <div className="mx-auto flex max-w-[1680px] gap-4 xl:gap-6">
        <OrbitSidebar />
        <main className="min-w-0 flex-1 space-y-4 xl:space-y-6">
          <OrbitHeader />

          <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Mission Control</Badge>
              <Badge className="text-cyan-200">Einsteiger zuerst</Badge>
              <Badge className="text-emerald-200">keine API-Sprache</Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{data.greeting}</h2>
            <p className="mt-3 max-w-3xl text-sm text-[var(--muted-foreground)]">
              Home soll in Sekunden verständlich machen, was du tun kannst: Ziel eingeben, Status sehen, weitermachen oder eine Lösung starten.
            </p>
            <div className="mt-5">
              <SmartInputBar placeholder={data.smartInputPlaceholder} />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <SystemStatusWidget status={data.systemStatus} />
            <ContinueWorking items={data.continueWorking} />
          </section>

          <AIDigestBanner />

          <QuickActions items={data.quickActions} />
          <RecommendedSolutions items={data.recommendedSolutions} />
        </main>
      </div>
    </div>
  );
}
