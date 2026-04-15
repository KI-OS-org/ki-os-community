import Link from "next/link";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuickAction } from "@/lib/adapters/mission-control";

export function QuickActions({ items }: { items: QuickAction[] }) {
  return (
    <Card>
      <CardHeader>
        <Badge>Schnellaktionen</Badge>
        <CardTitle className="text-xl">Mit einem Schritt loslegen</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="rounded-[22px] border border-white/8 bg-white/3 p-4 transition hover:border-cyan-400/30 hover:bg-white/5">
            <div className="mb-3 inline-flex rounded-full border border-cyan-400/25 bg-cyan-400/10 p-2 text-cyan-200">
              <Zap className="size-4" />
            </div>
            <div className="font-medium">{item.title}</div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.description}</p>
            <div className="mt-3 text-xs text-cyan-200/80">{item.hint}</div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
