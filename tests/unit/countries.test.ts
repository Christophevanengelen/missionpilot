import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    ADZUNA_APP_ID: "id",
    ADZUNA_APP_KEY: "key",
    ADZUNA_COUNTRY: "fr",
    LOG_LEVEL: "error",
    APP_ENV: "local",
  },
}));

import {
  MAX_COUNTRIES_PER_SEARCH,
  SEARCH_COUNTRIES,
  isCountryCode,
  labelOf,
} from "@/domain/countries";
import { configuredSources } from "@/lib/discovery/sources";

describe("country vocabulary", () => {
  it("accepts only codes it can actually query", () => {
    expect(isCountryCode("be")).toBe(true);
    expect(isCountryCode("fr")).toBe(true);
    // An unknown segment would 404 the source and make a whole country
    // silently return nothing — worse than not offering it.
    expect(isCountryCode("xx")).toBe(false);
    expect(isCountryCode("BE")).toBe(false);
  });

  it("names every code it offers", () => {
    for (const c of SEARCH_COUNTRIES) expect(labelOf(c.code)).not.toBe(c.code);
    expect(labelOf("zz")).toBe("zz");
  });

  it("offers Belgium — the gap this exists to close", () => {
    // The deployment was pinned to one country, so a Belgian owner could not
    // search their own market at all.
    expect(SEARCH_COUNTRIES.map((c) => c.code)).toContain("be");
  });
});

describe("configuredSources with countries", () => {
  it("creates one country-partitioned source per country", () => {
    const sources = configuredSources(["be", "fr"]);
    const adzuna = sources.filter((s) => s.name === "Adzuna");
    expect(adzuna).toHaveLength(2);
    // All keep the SAME name: that is what their attribution terms require,
    // and it lets the cross-source merge collapse an offer published in two
    // markets by the same company.
    expect(new Set(adzuna.map((s) => s.name)).size).toBe(1);
  });

  it("falls back to a single deployment-default source when none chosen", () => {
    expect(
      configuredSources([]).filter((s) => s.name === "Adzuna"),
    ).toHaveLength(1);
  });

  it("caps how many countries one search may cost", () => {
    // Cost is countries × métiers against a rate-limited API.
    expect(MAX_COUNTRIES_PER_SEARCH).toBeLessThanOrEqual(3);
  });
});
