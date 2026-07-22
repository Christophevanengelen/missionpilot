import { beforeEach, describe, expect, it, vi } from "vitest";

// DAL enforcement test, independent of the proxy: proves that
// getSessionClaims() returns null (and verifySession() redirects) when
// Supabase reports no valid, signature-verified session — the defense-in-depth
// layer the e2e anonymous-redirect test cannot attribute (it is satisfied by
// the proxy's optimistic redirect first).

vi.mock("server-only", () => ({}));

const getClaimsMock = vi.fn();
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

import { getSessionClaims, verifySession } from "@/lib/auth/dal";

describe("auth DAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no session", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });
    expect(await getSessionClaims()).toBeNull();
  });

  it("returns null when claim verification errors", async () => {
    getClaimsMock.mockResolvedValue({
      data: null,
      error: { message: "invalid JWT" },
    });
    expect(await getSessionClaims()).toBeNull();
  });

  it("returns the session info for verified claims", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-123", email: "dev@missionpilot.local" } },
      error: null,
    });
    expect(await getSessionClaims()).toEqual({
      userId: "user-123",
      email: "dev@missionpilot.local",
    });
  });

  it("verifySession redirects to /login without a session", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });
    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
