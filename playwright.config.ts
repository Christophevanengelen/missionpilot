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
  // ONE worker, deliberately.
  //
  // These specs mutate a profile and then assert on what the screen shows, and
  // `revalidatePath` invalidates a cache shared by the whole Next process. Run
  // in parallel against the single server this config starts, one spec's
  // invalidation interleaves with another's in-flight render, and a mutation
  // occasionally reads back stale — on an 8-core machine roughly one run in
  // three, on a 2-core CI runner almost never, which is exactly the kind of
  // difference that gets miscalled "flaky" and left alone.
  //
  // This makes the SUITE deterministic. It is not a proof that the application
  // has no such race under real concurrent traffic; what protects it there is
  // the layout-scoped revalidation plus the client refresh, and that is a
  // separate question from making the tests trustworthy.
  workers: 1,
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
