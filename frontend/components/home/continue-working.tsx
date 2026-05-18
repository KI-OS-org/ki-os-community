import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContinueItem } from "@/lib/adapters/mission-control";

export function ContinueWorking({ items }: { items: ContinueItem[] }) {
  return (
    <Card>
      <CardHeader>
        <Badge>Continue Working</Badge>
        <CardTitle className="text-xl">Nahtlos weitermachen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/3 p-4 transition hover:border-cyan-400/30 hover:bg-white/5">
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-sm text-[var(--muted-foreground)]">{item.subtitle}</div>
            </div>
            <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
              <span>{item.phase}</span>
              <ArrowUpRight className="size-4" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
