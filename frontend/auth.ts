import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { orbitRuntimeConfig } from "@/lib/config";

const credentialSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
  role: z.string().optional(),
  tenant: z.string().optional(),
});

const mockUsers = [
  { id: "orbit-admin", email: "admin@ki-os.local", name: "Orbit Admin", password: "orbit-demo", role: "admin", tenant: "demo-tenant" },
  { id: "orbit-operator", email: "operator@ki-os.local", name: "Orbit Operator", password: "orbit-demo", role: "operator", tenant: "ops-tenant" },
  { id: "orbit-user", email: "user@ki-os.local", name: "Orbit User", password: "orbit-demo", role: "user", tenant: "demo-tenant" },
  { id: "orbit-auditor", email: "auditor@ki-os.local", name: "Orbit Auditor", password: "orbit-demo", role: "auditor", tenant: "audit-tenant" }
];

const fallbackUser = {
  id: "orbit-default",
  email: process.env.AUTH_DEFAULT_EMAIL ?? "demo@ki-os.local",
  name: process.env.AUTH_DEFAULT_NAME ?? "Orbit Demo User",
  password: "orbit-demo",
  role: process.env.AUTH_DEFAULT_ROLE ?? orbitRuntimeConfig.defaultRole,
  tenant: process.env.AUTH_DEFAULT_TENANT ?? orbitRuntimeConfig.defaultTenant,
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "KI-OS Auth",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
        role: { label: "Rolle", type: "text" },
        tenant: { label: "Tenant", type: "text" }
      },
      async authorize(rawCredentials) {
        const parsed = credentialSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const credentials = parsed.data;

        // Warn if mock is being used in production
        if (process.env.NODE_ENV === 'production' && orbitRuntimeConfig.auth.mockEnabled) {
          console.warn('[KI-OS Auth] WARNING: Mock authentication is enabled in production!');
        }

        const backendUrl =
          orbitRuntimeConfig.auth.backendUrl ??
          process.env.NEXTAUTH_BACKEND_URL ??
          process.env.NEXT_PUBLIC_API_URL ??
          "http://localhost:3000";

        const mockOnly = !backendUrl || process.env.AUTH_ENABLE_MOCK === "true" && process.env.NEXTAUTH_BACKEND_URL === undefined;

        // Try backend auth first (unless mock-only mode)
        if (!mockOnly) {
          let backendFailed = false;
          try {
            const response = await fetch(`${backendUrl}/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: credentials.email, password: credentials.password }),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.user) {
                return {
                  id: data.user.id,
                  email: data.user.email,
                  name: data.user.name,
                  role: credentials.role ?? data.user.role,
                  tenant: credentials.tenant ?? data.user.tenant,
                };
              }
            }
            // Backend responded but auth failed — only fall back if mock fallback is enabled
            if (!orbitRuntimeConfig.auth.mockFallback) return null;
          } catch (fetchErr) {
            // Backend unreachable
            backendFailed = true;
            if (process.env.NODE_ENV === 'production') {
              console.warn(`[KI-OS Auth] Backend unreachable at ${backendUrl}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
            }
            if (!orbitRuntimeConfig.auth.mockFallback) return null;
          }
          if (!backendFailed && !orbitRuntimeConfig.auth.mockFallback) return null;
        }

        // Mock fallback (or mock-only mode)
        if (!orbitRuntimeConfig.auth.mockEnabled) return null;
        console.log('[KI-OS Auth] Using mock authentication — ensure this is intentional in your environment.');
        const found = mockUsers.find((user) => user.email === credentials.email && user.password === credentials.password) ?? fallbackUser;
        if (credentials.email !== found.email && credentials.email !== fallbackUser.email) return null;
        return {
          id: found.id,
          email: found.email,
          name: found.name,
          role: credentials.role ?? found.role,
          tenant: credentials.tenant ?? found.tenant,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/api/auth");
      const isPublic = nextUrl.pathname === "/" || nextUrl.pathname.startsWith("/unauthorized");
      if (isAuthRoute || isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? orbitRuntimeConfig.defaultRole;
        token.tenant = (user as { tenant?: string }).tenant ?? orbitRuntimeConfig.defaultTenant;
      }
      if (trigger === "update" && session) {
        token.role = session.user?.role ?? token.role;
        token.tenant = session.user?.tenant ?? token.tenant;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = typeof token.role === "string" ? token.role : orbitRuntimeConfig.defaultRole;
      session.user.tenant = typeof token.tenant === "string" ? token.tenant : orbitRuntimeConfig.defaultTenant;
      return session;
    },
  },
});
