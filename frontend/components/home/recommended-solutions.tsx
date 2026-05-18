import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendedSolution } from "@/lib/adapters/mission-control";

export function RecommendedSolutions({ items }: { items: RecommendedSolution[] }) {
  return (
    <Card>
      <CardHeader>
        <Badge>Empfohlene Lösungen</Badge>
        <CardTitle className="text-xl">Passende Einstiege für dein Ziel</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="rounded-[24px] border border-white/8 bg-white/3 p-4 transition hover:border-cyan-400/30 hover:bg-white/5">
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-cyan-200">{item.tag}</div>
            <div className="font-medium">{item.title}</div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{item.summary}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
