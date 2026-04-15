import { OrbitHeader } from "@/components/orbit/orbit-header";
import { OrbitSidebar } from "@/components/orbit/orbit-sidebar";
import { StatCard } from "@/components/orbit/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appConfig, orbitRuntimeConfig } from "@/lib/config";

const stats = [
  { label: "Foundation Sprint", value: "F1a", hint: "Designsystem, Shell, Navigation und Error States." },
  { label: "Identity Sprint", value: "F1b", hint: "Auth.js, Role Guards, Mock Auth und Tenant-Kontext." },
  { label: "Ready for", value: "F2", hint: "Mission Control kann jetzt auf echte Sessions und Rollen aufsetzen." },
];

export async function AppShell() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(52,116,255,0.25),transparent_32%),linear-gradient(180deg,#08101f,#04060c)] p-4 text-[var(--foreground)] xl:p-6">
      <div className="mx-auto flex max-w-[1680px] gap-4 xl:gap-6">
        <OrbitSidebar />
        <main className="min-w-0 flex-1 space-y-4 xl:space-y-6">
          <OrbitHeader />

          <section className="grid gap-4 md:grid-cols-3">
            {stats.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader>
                <Badge>Authentication & Identity</Badge>
                <CardTitle className="text-2xl">Was in Sprint F1b jetzt steht</CardTitle>
                <CardDescription>
                  Sessions, Rollen und Tenant-Kontext sind jetzt kein späterer Anbau mehr, sondern Teil des Orbit-Grundgerüsts.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {[
                  "Auth.js v5 Struktur mit auth.ts und Route Handlern",
                  "Credentials-basierter Mock Auth für Local Demo Mode",
                  "geschützte App-Routen via middleware.ts",
                  "Role Guard Komponente für Sicht- und Modulsteuerung",
                  "Tenant Switcher + Session-/Tenant-Anzeige im Header",
                  "Login / Logout als saubere Produktoberfläche",
                  "Adapter Layer Startpunkt für tenant-, governance- und workspace-nahe APIs",
                  `Betriebsmodus: ${orbitRuntimeConfig.mode}`,
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/8 bg-white/3 p-4 text-sm text-[var(--muted-foreground)]">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Badge>Adapter-ready</Badge>
                <CardTitle className="text-2xl">Semantische Anbindung statt Fetch-Wildwuchs</CardTitle>
                <CardDescription>
                  F1/F1b verlangen bereits einen klaren Adapter Layer. Deshalb steht die Struktur für Workspace, Governance, Routing, Tenant und mehr schon ab jetzt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted-foreground)]">
                <div className="rounded-[20px] border border-white/8 bg-white/3 p-4">API URL: {appConfig.apiUrl}</div>
                <div className="rounded-[20px] border border-white/8 bg-white/3 p-4">Mock Auth: {orbitRuntimeConfig.auth.mockEnabled ? "aktiv" : "deaktiviert"}</div>
                <div className="rounded-[20px] border border-white/8 bg-white/3 p-4">Tenant Scope: {orbitRuntimeConfig.tenants.join(", ")}</div>
                <div className="pt-2">
                  <Button><a href="/login" style={{ color: "inherit", textDecoration: "none" }}>Zum Login</a></Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
