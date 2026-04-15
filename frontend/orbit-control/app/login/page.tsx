import { LoginForm } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(52,116,255,0.25),transparent_32%),linear-gradient(180deg,#08101f,#04060c)] p-6 text-white">
      <div className="grid w-full max-w-6xl gap-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
        <div className="space-y-4">
          <Badge>Orbit Login / F1b</Badge>
          <h1 className="text-5xl font-semibold tracking-tight">Rollen, Sessions und Tenant-Kontext werden jetzt sichtbar.</h1>
          <p className="max-w-2xl text-base text-[var(--muted-foreground)]">
            Dieser Login-Screen ist die erste echte Identity-Schicht für Orbit Control. Im Demo-Modus kannst du ohne produktive Provider mit Rollen und Tenants arbeiten.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
