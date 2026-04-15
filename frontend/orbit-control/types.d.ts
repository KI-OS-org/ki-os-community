import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    tenant?: string;
  }

  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      tenant?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    tenant?: string;
  }
}
