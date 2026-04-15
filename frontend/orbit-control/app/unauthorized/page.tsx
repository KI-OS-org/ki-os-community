import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(52,116,255,0.25),transparent_32%),linear-gradient(180deg,#08101f,#04060c)] p-6 text-white">
      <div className="max-w-xl space-y-4 rounded-[32px] border border-white/10 bg-black/20 p-8 backdrop-blur">
        <Badge>Zugriff eingeschränkt</Badge>
        <h1 className="text-3xl font-semibold">Diese Sicht ist mit deiner aktuellen Rolle nicht freigeschaltet.</h1>
        <p className="text-[var(--muted-foreground)]">Nutze eine Rolle mit höherer Freigabe oder gehe zurück in einen freigegebenen Bereich.</p>
        <Link href="/" className="text-[var(--accent)] underline underline-offset-4">Zur Startseite</Link>
      </div>
    </div>
  );
}
