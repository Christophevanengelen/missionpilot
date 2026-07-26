import type { NextConfig } from "next";

// Fail the build immediately when a required environment variable is missing
// or a production invariant is violated.
import { assertProductionEnvInvariants } from "./src/lib/env-guards";

assertProductionEnvInvariants();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Match the CV-upload cap in src/lib/profile/cv-pdf.ts — the framework
      // default (1 MB) would reject normal CV PDFs before the action runs.
      bodySizeLimit: "10mb",
    },
  },
  /**
   * The routes the one-screen rewrite removed.
   *
   * Deleting them was right — /opportunities and /applications STORED offers,
   * which contradicted the product's own promise. Leaving them to 404 was not:
   * the owner opened a bookmark the morning after and landed on a dead end,
   * which is the version of "your effort disappeared" that this whole rewrite
   * was meant to eliminate.
   *
   * Permanent, because they are never coming back under these names, and a
   * browser that remembers that spares the next request entirely.
   */
  async redirects() {
    return [
      { source: "/opportunities", destination: "/dashboard", permanent: true },
      {
        source: "/opportunities/:id",
        destination: "/dashboard",
        permanent: true,
      },
      { source: "/applications", destination: "/dashboard", permanent: true },
      { source: "/recherche", destination: "/dashboard", permanent: true },
      { source: "/ux-preview", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
