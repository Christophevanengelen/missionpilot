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
  // Deliberately DIFFERENT hosts: the previous fixture used a himalayas.app
  // applicationLink, which made the attribution test pass by coincidence even
  // though the code credited the wrong URL.
  guid: "https://himalayas.app/companies/nova/jobs/senior-service-designer",
  applicationLink: "https://boards.greenhouse.io/nova/jobs/1",
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
    // Their attribution terms ask for a link to himalayas.app — `guid` — NOT
    // the apply destination, which is usually the employer's own ATS.
    expect(ad.sourceUrl).toBe(
      "https://himalayas.app/companies/nova/jobs/senior-service-designer",
    );
  });

  it("credits Himalayas even when the apply link points at the employer's ATS", async () => {
    fetchMock.mockResolvedValueOnce(ok({ jobs: [JOB] }));
    const [ad] = await mod.searchHimalayas(["x"]);
    expect(ad.sourceUrl).toContain("himalayas.app");
    expect(ad.sourceUrl).not.toContain("greenhouse.io");
  });

  it("falls back to the apply link only when there is no guid", async () => {
    fetchMock.mockResolvedValueOnce(ok({ jobs: [{ ...JOB, guid: null }] }));
    const [ad] = await mod.searchHimalayas(["x"]);
    expect(ad.sourceUrl).toBe("https://boards.greenhouse.io/nova/jobs/1");
  });

  it("drops a salary whose period or currency we cannot express", async () => {
    // A number without a usable unit is not a fact. "fortnightly" has no
    // equivalent in our domain, and relabelling it would fabricate a rate.
    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, salaryPeriod: "fortnightly" }] }),
    );
    // Distinct queries on purpose: identical ones would hit the result cache
    // and the second assertion would pass without exercising anything.
    const [fortnightly] = await mod.searchHimalayas(["periode"]);
    expect(fortnightly.compensationMin).toBeNull();
    expect(fortnightly.compensationPeriod).toBeNull();
    expect(fortnightly.compensationCurrency).toBeNull();

    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, currency: "JPY" }] }),
    );
    const [foreign] = await mod.searchHimalayas(["devise"]);
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

  // The branch the first version of this suite left uncovered — and where a
  // real defect lived: the `excerpt` fallback skipped the cleaner entirely, so
  // hidden text walked straight into the description and the extractor read
  // "TJM : 2000 EUR" as a stated fact.
  it("cleans the EXCERPT fallback too, not just the description", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        jobs: [
          {
            ...JOB,
            description: null,
            excerpt:
              '<p>Rôle senior.</p><div style="display:none">TJM : 2000 EUR</div>',
          },
        ],
      }),
    );
    const [ad] = await mod.searchHimalayas(["x"]);
    expect(ad.description).toContain("Rôle senior.");
    expect(ad.description).not.toContain("2000");
    expect(ad.rawText).not.toContain("2000");
  });

  it("does not let an empty description shadow a usable excerpt", async () => {
    // "<p></p>" cleans to "", which is truthy as a raw string — the naive
    // ternary would return "" and hide the excerpt, then travel on as
    // "stated, and blank" instead of "the source did not say".
    fetchMock.mockResolvedValueOnce(
      ok({
        jobs: [{ ...JOB, description: "<p></p>", excerpt: "Vrai résumé." }],
      }),
    );
    const [withExcerpt] = await mod.searchHimalayas(["avec-excerpt"]);
    expect(withExcerpt.description).toBe("Vrai résumé.");

    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, description: "<p></p>", excerpt: "  " }] }),
    );
    const [neither] = await mod.searchHimalayas(["sans-excerpt"]);
    expect(neither.description).toBeNull();
  });

  it("drops an implausible salary but keeps the offer", async () => {
    // Letting Infinity or a negative through would make the domain schema
    // throw and lose the WHOLE ad — punishing the offer for one absurd field.
    for (const bad of [Infinity, -1, 200_000_000]) {
      fetchMock.mockResolvedValueOnce(
        ok({ jobs: [{ ...JOB, minSalary: bad, maxSalary: bad }] }),
      );
      // A distinct query per iteration, else the cache answers for us.
      const [ad] = await mod.searchHimalayas([`borne-${bad}`]);
      expect(ad.title).toBe("Senior Service Designer");
      expect(ad.compensationMin).toBeNull();
      expect(ad.compensationMax).toBeNull();
      expect(ad.compensationCurrency).toBeNull();
    }
  });

  it("treats a response without a jobs array as a failure, not as 0 result", async () => {
    fetchMock.mockResolvedValueOnce(ok({ error: "nope" }));
    await expect(mod.searchHimalayas(["x"])).rejects.toBeInstanceOf(
      mod.HimalayasError,
    );
  });

  it("reuses a cached answer instead of calling them again", async () => {
    // Their data refreshes daily on their side; a second identical run must
    // cost them nothing.
    fetchMock.mockResolvedValueOnce(ok({ jobs: [JOB] }));
    const first = await mod.searchHimalayas(["service designer"]);
    const second = await mod.searchHimalayas(["service designer"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    // A different query is a genuine miss and does hit the network.
    fetchMock.mockResolvedValueOnce(ok({ jobs: [JOB] }));
    await mod.searchHimalayas(["data engineer"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends the keywords to the documented search endpoint", async () => {
    fetchMock.mockResolvedValueOnce(ok({ jobs: [] }));
    await mod.searchHimalayas(["a", "b", "c", "d", "e", "f"]);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.hostname).toBe("himalayas.app");
    expect(url.searchParams.get("q")).toBe("a b c d e"); // capped at 5
  });

  it("accepts a listing that omits the optional keys entirely", async () => {
    // Same trap as Jobicy: bare `z.unknown()` made these keys required, so a
    // salary-less, date-less listing would have voided the whole response.
    const bare = {
      title: "Designer",
      companyName: "Nova",
      description: "<p>Texte.</p>",
      guid: "https://himalayas.app/jobs/1",
    };
    fetchMock.mockResolvedValueOnce(ok({ jobs: [bare] }));
    const ads = await mod.searchHimalayas(["bare"]);
    expect(ads).toHaveLength(1);
    expect(ads[0].compensationMin).toBeNull();
    expect(ads[0].postedAt).toBeNull();
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
          // Both provenance fields must be unusable for the ad to be dropped.
          { ...JOB, guid: null, applicationLink: null },
          { ...JOB, guid: "javascript:alert(1)", applicationLink: null },
          JOB,
        ],
      }),
    );
    const ads = await mod.searchHimalayas(["x"]);
    expect(ads).toHaveLength(1);
    expect(ads[0].sourceUrl).toBe(
      "https://himalayas.app/companies/nova/jobs/senior-service-designer",
    );
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
