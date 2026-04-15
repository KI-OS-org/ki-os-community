import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center justify-between text-3xl">
          {value}
          <span className="rounded-full bg-emerald-500/10 p-2 text-emerald-300">
            <ArrowUpRight className="size-4" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--muted-foreground)]">{hint}</p>
      </CardContent>
    </Card>
  );
}
