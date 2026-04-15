import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// __dirname-Äquivalent für ES-Module (Node 22 / Next.js 15)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// → absoluter Pfad zu frontend/orbit-control/, unabhängig vom npm-CWD

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // outputFileTracingRoot nur beim Production-Build (next build), NICHT im Dev-Modus.
  // Turbopack 15.5.x auf Windows crasht mit CWD-relativem path.resolve() → leerer Filesystem-Root.
  // __dirname (absolut, dateirelativ) ist sicher; NEXT_PHASE schützt zusätzlich den Dev-Start.
  ...(process.env.NEXT_PHASE === "phase-production-build" && {
    outputFileTracingRoot: path.resolve(__dirname, "../../"),
  }),

  turbopack: {
    // Absoluter Workspace-Root (dateirelativ, nicht CWD-relativ) → kein Turbopack-Crash auf Windows
    root: path.resolve(__dirname, "../../"),
  },

  experimental: {
    // Tree-shaking für große Icon-/Chart-/Animation-Libs → weniger zu kompilieren
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "date-fns",
      "@tanstack/react-query",
      "reactflow",
    ],
  },

  // TypeScript & ESLint beim Dev-Start nicht nochmal prüfen → spart CPU
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
