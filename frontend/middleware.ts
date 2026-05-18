export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/",
    "/workspace/:path*",
    "/flows/:path*",
    "/integrations/:path*",
    "/control/:path*",
    "/solutions/:path*",
    "/runs/:path*",
    "/memory/:path*",
    "/providers/:path*",
    "/jobs/:path*",
    "/trust/:path*",
  ],
};
