import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TenantSwitcher } from "@/components/auth/tenant-switcher";
import { cookies } from "next/headers";

export async function AuthStatus() {
  const session = await auth();
  const cookieStore = await cookies();
  const activeTenant = cookieStore.get("orbit-active-tenant")?.value ?? session?.user?.tenant ?? "demo-tenant";

  if (!session?.user) {
    return <Badge className="text-amber-200">Gastmodus</Badge>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>{session.user.role ?? "user"}</Badge>
      <Badge>{session.user.email ?? "unknown"}</Badge>
      <TenantSwitcher currentTenant={activeTenant} />
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="secondary">Logout</Button>
      </form>
    </div>
  );
}
