import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Three projects:
//  - unit-node: pure logic tests (schema contracts, lib code) — `pnpm test`
//  - unit-dom:  component tests with jsdom + Testing Library — `pnpm test`
//  - integration: tests requiring the local Supabase stack — `pnpm test:integration` only
//
// "server-only" is aliased to an empty stub: the real package throws outside
// a React Server context, and tests legitimately exercise server modules.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit-node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "unit-dom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          setupFiles: ["./tests/integration/setup.ts"],
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
