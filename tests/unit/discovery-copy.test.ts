import { describe, expect, it } from "vitest";
import { t, type Locale } from "@/lib/copy";

/**
 * Honesty guards on the discovery status line. These are not wording
 * preferences: each one locks a statement the product must NOT make, because
 * it would present as a fact something the run did not observe.
 *
 * Both locales are held to the same contract — a mirror that drifts is how an
 * honesty rule quietly stops applying to half the users.
 */
const LOCALES: Locale[] = ["fr", "en"];

describe.each(LOCALES)("discovery copy — %s", (locale) => {
  const copy = t(locale).opportunities.discover;

  it("says a fully-failed source returned NOTHING, not that it lost some searches", () => {
    const dead = copy.partial([
      { name: "France Travail", failed: 3, total: 3 },
    ]);
    const partial = copy.partial([{ name: "Adzuna", failed: 1, total: 3 }]);

    // The two situations must not render the same way: one source is absent
    // from the results entirely, the other merely thinner.
    expect(dead).not.toBe(partial);
    expect(dead).toContain("France Travail");
    // The partial case must carry the denominator, else "1 failed" is
    // unreadable — 1 out of 3 and 1 out of 1 mean opposite things.
    expect(partial).toContain("3");
  });

  it("never promises that retrying later will help", () => {
    // A wrong credential, or an API the account is not subscribed to, fails
    // identically forever — and the token log is precisely what reveals that we
    // cannot tell which. Telling the user to "try again later" would assert a
    // transience we did not measure.
    const message = copy
      .partial([{ name: "France Travail", failed: 3, total: 3 }])
      .toLowerCase();
    expect(message).not.toContain("réessayez");
    expect(message).not.toContain("try again");
    expect(message).not.toContain("plus tard");
    expect(message).not.toContain("later");
  });

  it("does not blame the profile when a source never answered", () => {
    const complete = copy.result(0, 0, 0, false);
    const incomplete = copy.result(0, 0, 0, true);
    // With every source reached, "nothing matched your profile" is a fair
    // reading. With a source down, it is an inference we cannot make.
    expect(incomplete).not.toBe(complete);
    expect(incomplete.toLowerCase()).not.toContain("profil");
    expect(incomplete.toLowerCase()).not.toContain("profile");
  });

  it("distinguishes an ad that failed to import from a search that never ran", () => {
    // Both used to read "en échec" on the same line, which conflated an offer
    // we could not store with a query that never reached the source.
    const withFailedImports = copy.result(3, 1, 1, false);
    const searchFailure = copy.partial([
      { name: "Adzuna", failed: 1, total: 3 },
    ]);
    const shared = ["en échec", "failed"].filter(
      (term) =>
        withFailedImports.toLowerCase().includes(term) &&
        searchFailure.toLowerCase().includes(term),
    );
    expect(shared).toEqual([]);
  });

  it("keeps singular and plural correct on both sides of the count", () => {
    const one = copy.partial([{ name: "Adzuna", failed: 1, total: 3 }]);
    const many = copy.partial([{ name: "Adzuna", failed: 2, total: 3 }]);
    expect(one).not.toBe(many);
    if (locale === "fr") {
      expect(one).toContain("1 recherche en échec");
      expect(many).toContain("2 recherches en échec");
    } else {
      expect(one).toContain("1 of 3 searches failed");
      expect(many).toContain("2 of 3 searches failed");
    }
  });

  it("names every failing source when several come up short", () => {
    const message = copy.partial([
      { name: "Adzuna", failed: 1, total: 3 },
      { name: "France Travail", failed: 3, total: 3 },
    ]);
    expect(message).toContain("Adzuna");
    expect(message).toContain("France Travail");
  });
});
