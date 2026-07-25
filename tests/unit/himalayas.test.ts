import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Mutable env state rather than a per-test `vi.doMock`: a doMock leaks into
// every later test in the file, which would make the "typed error" cases pass
// because the source is DISABLED rather than because the error path works.
const { envState } = vi.hoisted(() => ({
  envState: { HIMALAYAS_ENABLED: true, LOG_LEVEL: "error", APP_ENV: "local" },
}));
vi.mock("@/lib/env", () => ({ env: envState }));

type Mod = typeof import("@/lib/discovery/himalayas");
let mod: Mod;
const fetchMock = vi.fn();

beforeEach(async () => {
  envState.HIMALAYAS_ENABLED = true;
  vi.resetModules();
  mod = await import("@/lib/discovery/himalayas");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const JOB = {
  title: "Senior Service Designer",
  companyName: "Nova",
  description: "<p>Design systems at scale.</p>",
  employmentType: "Contractor",
  minSalary: 90000,
  maxSalary: 120000,
  currency: "EUR",
  salaryPeriod: "annual",
  seniority: ["Senior"],
  locationRestrictions: ["France", "Belgium"],
  timezoneRestrictions: [1, 2],
  applicationLink: "https://himalayas.app/jobs/1",
};

describe("searchHimalayas", () => {
  it("maps a contractor role honestly, salary units included", async () => {
    fetchMock.mockResolvedValueOnce(ok({ jobs: [JOB] }));
    const [ad] = await mod.searchHimalayas(["service designer"]);

    expect(ad.title).toBe("Senior Service Designer");
    expect(ad.organization).toBe("Nova");
    // "Contractor" is the freelance signal this product exists to surface.
    expect(ad.engagementType).toBe("freelance");
    expect(ad.compensationMin).toBe(90000);
    expect(ad.compensationMax).toBe(120000);
    expect(ad.compensationCurrency).toBe("EUR");
    expect(ad.compensationPeriod).toBe("year");
    // The eligibility statement is preserved, not flattened into one city.
    expect(ad.locationText).toBe("France, Belgium");
    expect(ad.rawText).toContain("Fuseaux horaires : UTC+1, UTC+2");
    expect(ad.sourceUrl).toBe("https://himalayas.app/jobs/1");
  });

  it("drops a salary whose period or currency we cannot express", async () => {
    // A number without a usable unit is not a fact. "fortnightly" has no
    // equivalent in our domain, and relabelling it would fabricate a rate.
    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, salaryPeriod: "fortnightly" }] }),
    );
    const [fortnightly] = await mod.searchHimalayas(["x"]);
    expect(fortnightly.compensationMin).toBeNull();
    expect(fortnightly.compensationPeriod).toBeNull();
    expect(fortnightly.compensationCurrency).toBeNull();

    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, currency: "JPY" }] }),
    );
    const [foreign] = await mod.searchHimalayas(["x"]);
    expect(foreign.compensationMin).toBeNull();
    expect(foreign.compensationCurrency).toBeNull();
  });

  it("never lets never-displayed HTML become a stated fact", async () => {
    // The shared hardened cleaner must apply here too: a hostile listing can
    // smuggle a rate a human never sees, which the extractor would then store.
    fetchMock.mockResolvedValueOnce(
      ok({
        jobs: [
          {
            ...JOB,
            description:
              '<p>Vrai texte.</p><div style="display:none">TJM : 2000 EUR</div><script>var x="TJM : 3000 EUR"</script>',
          },
        ],
      }),
    );
    const [ad] = await mod.searchHimalayas(["x"]);
    expect(ad.rawText).toContain("Vrai texte.");
    expect(ad.rawText).not.toContain("2000");
    expect(ad.rawText).not.toContain("3000");
  });

  it("leaves an unknown employment type undetermined rather than guessing", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, employmentType: "Volunteer" }] }),
    );
    const [ad] = await mod.searchHimalayas(["x"]);
    expect(ad.engagementType).toBeNull();
  });

  it("drops an ad it cannot link back to (ToS attribution)", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        jobs: [
          { ...JOB, applicationLink: null },
          { ...JOB, applicationLink: "javascript:alert(1)" },
          JOB,
        ],
      }),
    );
    const ads = await mod.searchHimalayas(["x"]);
    expect(ads).toHaveLength(1);
    expect(ads[0].sourceUrl).toBe("https://himalayas.app/jobs/1");
  });

  it("is inert without the opt-in flag", async () => {
    envState.HIMALAYAS_ENABLED = false;
    vi.resetModules();
    const off = await import("@/lib/discovery/himalayas");
    expect(off.himalayasConfigured()).toBe(false);
    await expect(off.searchHimalayas(["x"])).rejects.toBeInstanceOf(
      off.HimalayasError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a typed error on HTTP failure and on an invalid shape", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429 } as Response);
    await expect(mod.searchHimalayas(["x"])).rejects.toBeInstanceOf(
      mod.HimalayasError,
    );

    fetchMock.mockResolvedValueOnce(ok({ jobs: "nope" }));
    await expect(mod.searchHimalayas(["x"])).rejects.toBeInstanceOf(
      mod.HimalayasError,
    );
  });

  it("rejects an empty keyword set before any network call", async () => {
    await expect(mod.searchHimalayas([" ", ""])).rejects.toBeInstanceOf(
      mod.HimalayasError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
