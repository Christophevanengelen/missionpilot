import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Mutable env state rather than a per-test `vi.doMock`: a doMock leaks into
// every later test in the file, which would make the "typed error" cases pass
// because the source is DISABLED rather than because the error path works.
const { envState } = vi.hoisted(() => ({
  envState: { JOBICY_ENABLED: true, LOG_LEVEL: "error", APP_ENV: "local" },
}));
vi.mock("@/lib/env", () => ({ env: envState }));

type Mod = typeof import("@/lib/discovery/jobicy");
let mod: Mod;
const fetchMock = vi.fn();

beforeEach(async () => {
  envState.JOBICY_ENABLED = true;
  vi.resetModules();
  mod = await import("@/lib/discovery/jobicy");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const JOB = {
  jobTitle: "Senior Product Designer",
  companyName: "Mews",
  jobDescription: "<p>Shape the product.</p>",
  jobType: ["Freelance"],
  jobGeo: "France,  Ireland,  UK",
  jobLevel: "Senior",
  url: "https://jobicy.com/jobs/147618-senior",
  salaryMin: 90000,
  salaryMax: 120000,
  salaryCurrency: "EUR",
  salaryPeriod: "yearly",
};

describe("searchJobicy", () => {
  it("maps a freelance role honestly and tidies the eligibility list", async () => {
    fetchMock.mockResolvedValueOnce(ok({ jobs: [JOB] }));
    const [ad] = await mod.searchJobicy(["product designer"]);

    expect(ad.title).toBe("Senior Product Designer");
    expect(ad.engagementType).toBe("freelance");
    expect(ad.compensationMin).toBe(90000);
    expect(ad.compensationCurrency).toBe("EUR");
    // "yearly" here, "annual" at Himalayas — mapping by assumption is how a
    // yearly figure silently becomes a day rate.
    expect(ad.compensationPeriod).toBe("year");
    expect(ad.locationText).toBe("France, Ireland, UK");
    expect(ad.sourceUrl).toBe("https://jobicy.com/jobs/147618-senior");
  });

  it("prefers freelance over full-time when an ad claims both", async () => {
    // Calling such an ad "permanent" would misfile the very thing this user
    // is looking for.
    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, jobType: ["Full-Time", "Freelance"] }] }),
    );
    const [ad] = await mod.searchJobicy(["x"]);
    expect(ad.engagementType).toBe("freelance");
  });

  it("treats a 0 salary as 'not stated', never as unpaid", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, salaryMin: 0, salaryMax: 0 }] }),
    );
    const [ad] = await mod.searchJobicy(["x"]);
    expect(ad.compensationMin).toBeNull();
    expect(ad.compensationMax).toBeNull();
    expect(ad.compensationCurrency).toBeNull();
  });

  it("accepts salaries sent as numeric strings, rejects non-numeric ones", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, salaryMin: "90000", salaryMax: "120000" }] }),
    );
    const [asString] = await mod.searchJobicy(["x"]);
    expect(asString.compensationMin).toBe(90000);

    fetchMock.mockResolvedValueOnce(
      ok({ jobs: [{ ...JOB, salaryMin: "négociable", salaryMax: null }] }),
    );
    const [prose] = await mod.searchJobicy(["x"]);
    expect(prose.compensationMin).toBeNull();
    expect(prose.compensationCurrency).toBeNull();
  });

  it("never lets never-displayed HTML become a stated fact", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        jobs: [
          {
            ...JOB,
            jobDescription:
              '<p>Vrai texte.</p><span hidden>TJM : 2000 EUR</span><style>.x{content:"TJM : 3000 EUR"}</style>',
          },
        ],
      }),
    );
    const [ad] = await mod.searchJobicy(["x"]);
    expect(ad.rawText).toContain("Vrai texte.");
    expect(ad.rawText).not.toContain("2000");
    expect(ad.rawText).not.toContain("3000");
  });

  it("treats a rejected filter as a failure, not as an empty result", async () => {
    // Jobicy answers a bad filter with HTTP 200 + {success:false}. Reading
    // that as "no match" would tell the user their profile found nothing,
    // which is a different and false statement.
    fetchMock.mockResolvedValueOnce(
      ok({ success: false, error: "Invalid 'industry' value." }),
    );
    await expect(mod.searchJobicy(["x"])).rejects.toBeInstanceOf(
      mod.JobicyError,
    );
  });

  it("drops an ad it cannot link back to (ToS attribution)", async () => {
    fetchMock.mockResolvedValueOnce(ok({ jobs: [{ ...JOB, url: null }, JOB] }));
    const ads = await mod.searchJobicy(["x"]);
    expect(ads).toHaveLength(1);
  });

  it("is inert without the opt-in flag", async () => {
    envState.JOBICY_ENABLED = false;
    vi.resetModules();
    const off = await import("@/lib/discovery/jobicy");
    expect(off.jobicyConfigured()).toBe(false);
    await expect(off.searchJobicy(["x"])).rejects.toBeInstanceOf(
      off.JobicyError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the European scope with the keyword tag", async () => {
    fetchMock.mockResolvedValueOnce(ok({ jobs: [] }));
    await mod.searchJobicy(["a", "b", "c", "d", "e", "f"]);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("geo")).toBe("europe");
    expect(url.searchParams.get("tag")).toBe("a b c d e"); // capped at 5
  });
});
