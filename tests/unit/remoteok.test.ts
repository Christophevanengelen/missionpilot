import { describe, expect, it } from "vitest";
import { toAd } from "@/lib/discovery/remoteok";

/**
 * Every case pins something observed in the real feed, and the whole connector
 * exists because of a correction: it was nearly left out for publishing no
 * salary. An offer without a stated rate is still an offer, and the product
 * ends in a signed contract, not in a well-filtered list.
 */

const OFFER = {
  position: "Senior Product Designer",
  company: "Acme",
  description: "<p>Design end-to-end product experiences.</p>",
  location: "United States, ",
  url: "https://remoteOK.com/remote-jobs/remote-senior-product-designer-acme-1",
  date: "2026-07-25T21:32:27+00:00",
  tags: ["design", "figma"],
  salary_min: 0,
  salary_max: 0,
};

describe("toAd", () => {
  it("keeps an offer that states no salary at all", () => {
    // The correction that created this connector: 0 salaries out of 100 is not
    // a reason to drop a hundred real openings.
    const ad = toAd(OFFER);
    expect(ad?.title).toBe("Senior Product Designer");
    expect(ad?.compensationMin).toBeNull();
  });

  it("never renders their 0 as a salary of zero", () => {
    // Zero is their way of saying "unknown". Carried through as a figure it
    // would put "0 – 0" on a card and tell someone the job pays nothing.
    const ad = toAd({ ...OFFER, salary_min: 0, salary_max: 0 });
    expect(ad?.compensationMin).toBeNull();
    expect(ad?.compensationMax).toBeNull();
    expect(ad?.rawText).not.toContain("0 –");
  });

  it("drops a stated amount that has no currency and no period", () => {
    // Even when a number appears, the feed states neither unit. Rendering it
    // would mean inventing two thirds of a salary.
    const ad = toAd({ ...OFFER, salary_min: 120000, salary_max: 150000 });
    expect(ad?.compensationMin).toBeNull();
    expect(ad?.compensationCurrency).toBeNull();
    expect(ad?.compensationPeriod).toBeNull();
  });

  it("tidies their trailing comma without rewriting the place", () => {
    expect(toAd(OFFER)?.locationText).toBe("United States");
  });

  it("shows a mojibaked name exactly as published", () => {
    // Three offers in a hundred arrive as "SulAmÃ©rica" — broken upstream, not
    // by us. Re-decoding would be guesswork about what was meant, and a name
    // silently rewritten is worse than one shown as the source published it.
    const ad = toAd({ ...OFFER, company: "SulAmÃ©rica" });
    expect(ad?.organization).toBe("SulAmÃ©rica");
  });

  it("drops an ad it cannot link back to — their licence IS the link", () => {
    // "Please link back (with follow...) ... If you do not we'll have to
    // suspend API access." An ad shown unattributed would break that for every
    // other ad too.
    expect(toAd({ ...OFFER, url: null })).toBeNull();
    expect(toAd({ ...OFFER, url: "javascript:alert(1)" })).toBeNull();
  });

  it("leaves the engagement type unknown rather than reading it off a tag", () => {
    // A "contract" tag describes the work, not the contract. Someone filtering
    // for missions would be misled.
    expect(toAd({ ...OFFER, tags: ["contract"] })?.engagementType).toBeNull();
  });

  it("reads their publication date", () => {
    expect(toAd(OFFER)?.postedAt).toMatch(/^2026-07-25T/);
  });

  it("survives an offer that states almost nothing", () => {
    const ad = toAd({ position: "Dev", url: "https://remoteok.com/x/1" });
    expect(ad?.description).toBeNull();
    expect(ad?.locationText).toBeNull();
    expect(ad?.postedAt).toBeNull();
  });
});
