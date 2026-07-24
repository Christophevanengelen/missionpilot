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
};

export default nextConfig;
