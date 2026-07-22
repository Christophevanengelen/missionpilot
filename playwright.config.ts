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
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
