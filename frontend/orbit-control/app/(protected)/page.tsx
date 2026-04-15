import { SmartInputBar } from "@/components/home/smart-input-bar";
import { SystemStatusWidget } from "@/components/home/system-status-widget";
import { ContinueWorking } from "@/components/home/continue-working";
import { QuickActions } from "@/components/home/quick-actions";
import { RecommendedSolutions } from "@/components/home/recommended-solutions";
import { getMissionControlData } from "@/lib/adapters/mission-control";
import { Badge } from "@/components/ui/badge";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await getMissionControlData();

  return (
    <>
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Mission Control</Badge>
          <Badge className="text-cyan-200">Einsteiger zuerst</Badge>
          <Badge className="text-emerald-200">keine API-Sprache</Badge>
        </div>
        <p className="mt-4 text-base font-medium text-[var(--muted-foreground)]">{data.greeting}</p>
        <p className="mt-3 max-w-3xl text-sm text-[var(--muted-foreground)]">
          Home soll in Sekunden verständlich machen, was du tun kannst: Ziel eingeben,
          Status sehen, weitermachen oder eine Lösung starten.
        </p>
        <div className="mt-5">
          <SmartInputBar placeholder={data.smartInputPlaceholder} />
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <SystemStatusWidget status={data.systemStatus} />
        <ContinueWorking items={data.continueWorking} />
      </section>
      <QuickActions items={data.quickActions} />
      <RecommendedSolutions items={data.recommendedSolutions} />
    </>
  );
}
