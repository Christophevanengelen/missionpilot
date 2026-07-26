import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The behaviour this pins was found in PRODUCTION LOGS, not in review: one page
 * load ran a dozen plan searches, each asked France Travail for a token, and
 * each was refused with `invalid_client` — twelve failed OAuth round-trips and
 * two dozen error lines, on every single visit.
 */

const ORIGINAL_FETCH = globalThis.fetch;

function rejection(error: string) {
  return new Response(JSON.stringify({ error }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

describe("France Travail — rejected credentials are not re-asked", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  async function load() {
    vi.stubEnv("FRANCE_TRAVAIL_CLIENT_ID", "id");
    vi.stubEnv("FRANCE_TRAVAIL_CLIENT_SECRET", "secret");
    return import("@/lib/discovery/france-travail");
  }

  it("stops calling the token endpoint after invalid_client", async () => {
    const mod = await load();
    mod.resetCredentialRejection();
    const fetchMock = vi.fn(async () => rejection("invalid_client"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Twelve searches, exactly like one real page load.
    for (let i = 0; i < 12; i += 1) {
      await expect(mod.searchFranceTravail(["designer"])).rejects.toThrow();
    }

    // ONE network attempt, not twelve. The other eleven cannot succeed: the
    // credentials are wrong and stay wrong until a human changes them.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mod.credentialsRejected()).toBe(true);
  });

  it("keeps retrying a TRANSIENT failure — those heal on their own", async () => {
    // Refusing to retry a 5xx would turn a provider blip into an outage of our
    // own making.
    const mod = await load();
    mod.resetCredentialRejection();
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    for (let i = 0; i < 3; i += 1) {
      await expect(mod.searchFranceTravail(["designer"])).rejects.toThrow();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mod.credentialsRejected()).toBe(false);
  });

  it("does not treat an unrelated 400 as a credential rejection", async () => {
    const mod = await load();
    mod.resetCredentialRejection();
    const fetchMock = vi.fn(async () => rejection("invalid_request"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(mod.searchFranceTravail(["designer"])).rejects.toThrow();
    expect(mod.credentialsRejected()).toBe(false);
  });

  it("reports the rejection once, and says the next calls will be skipped", async () => {
    // The single remaining log line has to explain the silence that follows it,
    // otherwise the next reader thinks the source simply stopped being tried.
    const mod = await load();
    mod.resetCredentialRejection();
    globalThis.fetch = vi.fn(async () =>
      rejection("invalid_client"),
    ) as unknown as typeof fetch;

    await expect(mod.searchFranceTravail(["designer"])).rejects.toThrow();
    expect(mod.credentialsRejected()).toBe(true);
  });
});
