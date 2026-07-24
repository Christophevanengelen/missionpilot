import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { REMOTIVE_ENABLED: true, LOG_LEVEL: "error", APP_ENV: "local" },
}));

const { RemotiveError, remotiveConfigured, searchRemotive } =
  await import("@/lib/discovery/remotive");

const FIXTURE = {
  jobs: [
    {
      title: "Senior Backend Engineer",
      company_name: "Globex",
      candidate_required_location: "Europe",
      job_type: "freelance",
      description:
        "<p>Build <strong>Go</strong> services.</p><ul><li>Postgres</li></ul>" +
        "<p>Salaire &amp; avantages &#39;négociables&#39;</p>",
      url: "https://remotive.com/remote-jobs/1",
    },
    {
      title: "Part-time SRE",
      company_name: null,
      job_type: "part_time",
      description: "Ops.",
      url: "javascript:alert(1)", // no usable link-back ⇒ dropped entirely
    },
    {
      title: "Mystery role",
      job_type: "something_else", // unknown ⇒ null, never guessed
      description: "…",
      url: "https://remotive.com/remote-jobs/3",
    },
  ],
};

describe("searchRemotive", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is configured when the source is explicitly enabled", () => {
    expect(remotiveConfigured()).toBe(true);
  });

  it("maps jobs honestly and strips the HTML description", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => FIXTURE,
    } as Response);

    const ads = await searchRemotive(["backend"]);
    // The middle job has no usable link-back (javascript:) ⇒ dropped: ToS
    // requires attribution, so an unlinkable ad is not imported at all.
    expect(ads).toHaveLength(2);

    const first = ads[0];
    expect(first.title).toBe("Senior Backend Engineer");
    expect(first.organization).toBe("Globex");
    expect(first.engagementType).toBe("freelance");
    expect(first.sourceUrl).toBe("https://remotive.com/remote-jobs/1");
    // HTML stripped, entities decoded, no markup reaches the snapshot.
    expect(first.description).not.toMatch(/<[a-z]/i);
    expect(first.description).toContain("Build Go services.");
    expect(first.description).toContain("Salaire & avantages 'négociables'");
    // Remote is stated in the snapshot; salary is never fabricated.
    expect(first.rawText).toContain("télétravail");
    expect(first.compensationMin).toBeNull();
    expect(first.compensationCurrency).toBeNull();

    expect(ads.every((a) => a.sourceUrl !== null)).toBe(true); // attribution
    expect(ads[1].engagementType).toBeNull(); // unknown type ⇒ never guessed
  });

  it("removes never-rendered content so it can never become a stated fact", async () => {
    // The heart of the honesty guarantee: text a human never sees (script /
    // style bodies, display:none) must NOT reach the description, because the
    // deterministic extractor would read "TJM 2000 EUR" from it and store a
    // day rate + engagement type nobody ever advertised.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jobs: [
          {
            title: "Backend",
            job_type: "full_time",
            url: "https://remotive.com/remote-jobs/9",
            description:
              "<p>Visible role text.</p>" +
              "<script>var tjm = 2000; alert('x');</script>" +
              "<style>.a{color:red}</style>" +
              '<div style="display:none">TJM : 2000 EUR</div>' +
              '<img alt="a > b" src="x.png"><p>After the image.</p>',
          },
        ],
      }),
    } as Response);
    const [ad] = await searchRemotive(["backend"]);
    expect(ad.description).toContain("Visible role text.");
    expect(ad.description).toContain("After the image."); // attr `>` tolerated
    expect(ad.description).not.toContain("tjm");
    expect(ad.description).not.toContain("TJM");
    expect(ad.description).not.toContain("alert");
    expect(ad.description).not.toContain("color:red");
    expect(ad.rawText).not.toContain("2000");
  });

  it("is inert without the opt-in flag", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: { REMOTIVE_ENABLED: false, LOG_LEVEL: "error", APP_ENV: "local" },
    }));
    const off = await import("@/lib/discovery/remotive");
    expect(off.remotiveConfigured()).toBe(false);
    await expect(off.searchRemotive(["x"])).rejects.toBeInstanceOf(
      off.RemotiveError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  it("caps keywords and requests the search endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jobs: [] }),
    } as Response);
    await searchRemotive(["a", "b", "c", "d", "e", "f"]);
    const [calledUrl] = fetchMock.mock.calls[0];
    const parsed = new URL(String(calledUrl));
    expect(parsed.hostname).toBe("remotive.com");
    expect(parsed.searchParams.get("search")).toBe("a b c d e");
  });

  it("throws a typed error on HTTP failure and on an invalid shape", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);
    await expect(searchRemotive(["x"])).rejects.toBeInstanceOf(RemotiveError);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ jobs: "nope" }),
    } as Response);
    await expect(searchRemotive(["x"])).rejects.toBeInstanceOf(RemotiveError);
  });

  it("rejects an empty keyword set before any network call", async () => {
    await expect(searchRemotive(["  ", ""])).rejects.toBeInstanceOf(
      RemotiveError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
