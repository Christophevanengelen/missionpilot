import { describe, expect, it } from "vitest";
import {
  normaliseRecruiteeDate,
  toAd,
} from "@/lib/discovery/recruitee-normalise";
import { activeTenants } from "@/lib/discovery/recruitee-tenants";

/**
 * Every case here pins a trap OBSERVED in a real Recruitee response, not one
 * imagined from documentation. The endpoint is documented as "still a work in
 * progress", so the connector's job is to survive what it did not expect.
 */

const OFFER = {
  title: "Legal Counsel",
  company_name: "HG International b.v.",
  highlight: "<p>Rejoignez-nous</p>",
  description: "<p>Un poste au sein du service juridique.</p>",
  requirements: "<p>Vous avez 5 ans d'expérience en droit des contrats.</p>",
  location: "Gent, Vlaams Gewest, Belgie",
  country_code: "BE",
  careers_url: "https://hginternational.recruitee.com/o/legal-counsel",
  employment_type_code: "fulltime_permanent",
  salary: { min: "3600", max: "4600", currency: "EUR", period: "month" },
  published_at: "2026-07-16 10:39:05 UTC",
};

describe("normaliseRecruiteeDate", () => {
  it("transcribes their non-ISO stamp without inferring anything", () => {
    // "2026-07-16 10:39:05 UTC" — a space instead of T, a literal suffix. The
    // timezone is STATED, so this is transcription, not guesswork.
    expect(normaliseRecruiteeDate("2026-07-16 10:39:05 UTC")).toBe(
      "2026-07-16T10:39:05Z",
    );
  });

  it("accepts the already-ISO form too", () => {
    expect(normaliseRecruiteeDate("2026-07-16T10:39:05Z")).toBe(
      "2026-07-16T10:39:05Z",
    );
  });

  it.each([null, undefined, "", "   ", "hier", "16/07/2026"])(
    "returns null for %s rather than a fabricated date",
    (raw) => {
      expect(normaliseRecruiteeDate(raw as string | null)).toBeNull();
    },
  );

  it("refuses a stamp in an unstated timezone", () => {
    // Without an explicit UTC marker we would be CHOOSING a timezone, and a
    // freshness signal off by hours is worse than no freshness signal.
    expect(normaliseRecruiteeDate("2026-07-16 10:39:05 CEST")).toBeNull();
  });
});

describe("toAd", () => {
  it("reads the whole ad body, not just `description`", () => {
    // The substance lives in `requirements`: mapping `description` alone
    // truncated a real posting to about a tenth of its text.
    const { ad } = toAd(OFFER);
    expect(ad.description).toContain("droit des contrats");
    expect(ad.description).toContain("service juridique");
  });

  it("uses the careers URL and NEVER the apply URL", () => {
    const { ad } = toAd({
      ...OFFER,
      ...{ careers_apply_url: "https://x.recruitee.com/o/x/c/new" },
    });
    expect(ad.sourceUrl).toBe(
      "https://hginternational.recruitee.com/o/legal-counsel",
    );
    expect(ad.rawText).not.toContain("/c/new");
  });

  it("drops a non-https provenance rather than linking to it", () => {
    const { ad } = toAd({ ...OFFER, careers_url: "javascript:alert(1)" });
    expect(ad.sourceUrl).toBeNull();
  });

  it("keeps the salary only when amount, currency and period are all stated", () => {
    const { ad } = toAd(OFFER);
    expect(ad.compensationMin).toBe(3600);
    expect(ad.compensationMax).toBe(4600);
    expect(ad.compensationCurrency).toBe("EUR");
    expect(ad.compensationPeriod).toBe("month");
  });

  it("drops a half-stated salary whole", () => {
    // `salary` is ALWAYS an object with null sub-keys, so its presence proves
    // nothing. A currency with no amount would render as a bare symbol.
    const { ad } = toAd({
      ...OFFER,
      salary: { min: null, max: null, currency: "EUR", period: "month" },
    });
    expect(ad.compensationCurrency).toBeNull();
    expect(ad.compensationMin).toBeNull();
  });

  it("parses their string amounts", () => {
    const { ad } = toAd(OFFER);
    expect(typeof ad.compensationMin).toBe("number");
  });

  describe("employment type", () => {
    it("maps a permanent post", () => {
      expect(toAd(OFFER).ad.engagementType).toBe("permanent");
    });

    it("refuses to call a fixed-term contract interim work", () => {
      // Legally distinct. Someone filtering for interim work would be shown
      // posts they cannot take.
      const { ad, unknownEngagement } = toAd({
        ...OFFER,
        employment_type_code: "fulltime_fixed_term",
      });
      expect(ad.engagementType).toBeNull();
      expect(unknownEngagement).toBeNull();
    });

    it("reports an unseen code instead of guessing at it", () => {
      const { ad, unknownEngagement } = toAd({
        ...OFFER,
        employment_type_code: "freelance_gig",
      });
      expect(ad.engagementType).toBeNull();
      expect(unknownEngagement).toBe("freelance_gig");
    });
  });

  it("survives an offer that states almost nothing", () => {
    const { ad } = toAd({
      title: null,
      careers_url: "https://t.recruitee.com/o/x",
    });
    expect(ad.title).toBeNull();
    expect(ad.description).toBeNull();
    expect(ad.compensationMin).toBeNull();
    expect(ad.postedAt).toBeNull();
  });
});

describe("activeTenants", () => {
  it("honours an employer's opt-out", () => {
    // Recruitee's own support article tells employers to ask to be taken
    // offline. A product with no such door makes that impossible to follow.
    expect(activeTenants(["acme", "beta"], ["beta"])).toEqual(["acme"]);
  });

  it("matches an opt-out regardless of case and spacing", () => {
    expect(activeTenants([" ACME "], ["acme"])).toEqual([]);
  });

  it("de-duplicates", () => {
    expect(activeTenants(["acme", "ACME"], [])).toEqual(["acme"]);
  });

  it("drops anything that is not a plain hostname label", () => {
    // A slug becomes a hostname: `evil.com/x` or `a.b` would send the request
    // somewhere else entirely.
    expect(
      activeTenants(["evil.com", "a/b", "..", "-lead", "ok1"], []),
    ).toEqual(["ok1"]);
  });
});

describe("against a REAL recorded payload", () => {
  // A fixture captured from a live tenant on 2026-07-26, kept verbatim at 56
  // keys per offer — including the ones the connector ignores. A mapping that
  // is only ever tested against a hand-written object is a mapping tested
  // against the developer's assumptions.
  //
  // The recruiter mailbox was redacted before the file entered the repo: the
  // connector refuses to keep that address, and test data must not leak what
  // the code declines to store.
  it("normalises every offer without losing the essentials", async () => {
    const { offers } =
      (await import("../fixtures/recruitee-offers.json")) as unknown as {
        offers: unknown[];
      };
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      const { ad } = toAd(offer as never);
      expect(ad.title).not.toBeNull();
      // NOT anchored to recruitee.com, and the recorded payload is exactly why:
      // an employer can map their careers site to their OWN domain
      // (werkenbij.nl.bauhaus). That is the better outcome for the product —
      // the outbound link lands on the employer's own site — and a connector
      // that assumed the vendor's domain would have silently dropped those ads.
      expect(ad.sourceUrl).toMatch(/^https:\/\/[^/]+\/.+/);
      expect(ad.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(ad.rawText.length).toBeGreaterThan(20);
    }
  });

  it("never carries the recruiter mailbox into the normalised ad", async () => {
    const { offers } =
      (await import("../fixtures/recruitee-offers.json")) as unknown as {
        offers: unknown[];
      };
    for (const offer of offers) {
      const { ad } = toAd(offer as never);
      expect(JSON.stringify(ad)).not.toContain("@");
    }
  });
});
