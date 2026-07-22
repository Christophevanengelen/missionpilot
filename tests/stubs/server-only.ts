// Vitest alias target for the "server-only" package: the real module throws
// outside a React Server context. Tests run in node and exercise server code
// directly; the runtime boundary is still enforced in the app build.
export {};
