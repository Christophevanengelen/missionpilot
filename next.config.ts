import type { NextConfig } from "next";

// Fail the build immediately when a required environment variable is missing
// or a production invariant is violated.
import { assertProductionEnvInvariants } from "./src/lib/env-guards";

assertProductionEnvInvariants();

const nextConfig: NextConfig = {};

export default nextConfig;
