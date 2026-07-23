import { defineConfig, devices } from "@playwright/test";

// Local runs read .env.local (dev-user credentials, Supabase local values);
// CI provides the same variables through the environment instead.
try {
  process.loadEnvFile(".env.local");
} catch {
  // absent in CI — fine
}

// E2e runs against a production build (`next build && next start`), never the
// dev server: production mode is faster in CI and catches build-only issues.
export default defineConfig({
  testDir: "./tests/e2e",
  // Mutation round-trips (server action + RSC refresh) need headroom on the
  // 2-core CI runner; interactive polls still pass as fast as the app does.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // html report feeds the CI failure artifact (playwright-report/, gitignored).
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Runtime stdout+stderr teed to a file so CI can upload the server output
    // (action name, step, error type/message via the structured logger —
    // no user content, no secret) — the GitHub log API truncates it.
    command: "pnpm build && pnpm start 2>&1 | tee playwright-webserver.log",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
