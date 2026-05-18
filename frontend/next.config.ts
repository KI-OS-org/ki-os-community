import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Absoluter Pfad dieser Datei — unabhängig vom npm-CWD
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone-Bundle für Distribution — startet mit: node .next/standalone/server.js
  // Enthält minimales node_modules, kein separates npm install auf User-Systemen nötig.
  output: "standalone",

  turbopack: {
    // Nur für 'next dev --turbo' aktiv (Debugging). Verhindert Walk-up zur Enterprise-Root.
    root: __dirname,
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "date-fns",
      "@tanstack/react-query",
      "reactflow",
    ],
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
