import { auth } from "@/auth";
import { hasRequiredRole, type OrbitRole } from "@/lib/auth-guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function RoleGuard({
  allowedRoles,
  title,
  description,
  children,
}: {
  allowedRoles: OrbitRole[];
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const session = await auth();
  const currentRole = session?.user?.role;
  if (!hasRequiredRole(currentRole, allowedRoles)) {
    return (
      <Card>
        <CardHeader>
          <Badge>Zugriff begrenzt</Badge>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Diese Sicht erfordert eine der Rollen: {allowedRoles.join(", ")}. Aktuell aktiv: {currentRole ?? "keine Session"}.
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}
