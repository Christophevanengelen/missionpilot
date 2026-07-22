// Loads the local stack configuration before test files import src modules
// (env.ts reads process.env at import time). CI provides the same variables
// through the environment instead.
try {
  process.loadEnvFile(".env.local");
} catch {
  // absent in CI — fine
}
