"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { orbitRuntimeConfig } from "@/lib/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("admin@ki-os.local");
  const [password, setPassword] = useState("orbit-demo");
  const [role, setRole] = useState("admin");
  const [tenant, setTenant] = useState(orbitRuntimeConfig.defaultTenant);
  const [error, setError] = useState<string | null>(null);
  const callbackUrl = search.get("callbackUrl") ?? "/workspace";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      role,
      tenant,
      redirect: false,
      callbackUrl,
    });
    if (result?.error) {
      setError("Login fehlgeschlagen. Prüfe Zugang und Dev-Mock-Auth.");
      return;
    }
    await fetch("/api/tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push((result?.url ?? callbackUrl) as any);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-[520px]">
      <CardHeader>
        <Badge>F1b Authentication & Identity</Badge>
        <CardTitle className="text-3xl">Orbit Login</CardTitle>
        <CardDescription>
          Auth.js-basierter Einstieg mit Rollen, Sessions und Tenant-Kontext. Im Dev-Modus ist Mock Auth aktiv.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm">
            <span>E-Mail</span>
            <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span>Passwort</span>
            <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span>Rolle</span>
              <select className="rounded-2xl border border-white/10 bg-[#0e1526] px-4 py-3 outline-none" value={role} onChange={(e) => setRole(e.target.value)}>
                {orbitRuntimeConfig.roles.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span>Tenant</span>
              <select className="rounded-2xl border border-white/10 bg-[#0e1526] px-4 py-3 outline-none" value={tenant} onChange={(e) => setTenant(e.target.value)}>
                {orbitRuntimeConfig.tenants.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Login</Button>
            <Button type="button" variant="secondary" onClick={() => { setEmail("operator@ki-os.local"); setRole("operator"); setTenant("ops-tenant"); }}>Operator Demo</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
