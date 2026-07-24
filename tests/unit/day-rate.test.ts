import { describe, expect, it } from "vitest";
import {
  BILLABLE_DAYS,
  estimateDayRate,
  FREELANCE_UPLIFT_HIGH,
  FREELANCE_UPLIFT_LOW,
} from "@/lib/matching/day-rate";

const round10 = (n: number) => Math.round(n / 10) * 10;

describe("estimateDayRate", () => {
  it("derives a rounded freelance range from an annual min/max in EUR", () => {
    const r = estimateDayRate({
      compensationMin: 50000,
      compensationMax: 65000,
      compensationCurrency: "EUR",
      compensationPeriod: "year",
    });
    expect(r).toEqual({
      low: round10((50000 / BILLABLE_DAYS) * FREELANCE_UPLIFT_LOW),
      high: round10((65000 / BILLABLE_DAYS) * FREELANCE_UPLIFT_HIGH),
      currency: "EUR",
    });
    // Sanity: ~344 → 340, ~596 → 600.
    expect(r!.low).toBe(340);
    expect(r!.high).toBe(600);
  });

  it("anchors both ends on a single stated figure", () => {
    const r = estimateDayRate({
      compensationMin: 60000,
      compensationMax: null,
      compensationCurrency: "EUR",
      compensationPeriod: "year",
    });
    expect(r).toEqual({
      low: round10((60000 / BILLABLE_DAYS) * FREELANCE_UPLIFT_LOW),
      high: round10((60000 / BILLABLE_DAYS) * FREELANCE_UPLIFT_HIGH),
      currency: "EUR",
    });
  });

  it("returns null unless the figure is ANNUAL", () => {
    expect(
      estimateDayRate({
        compensationMin: 500,
        compensationMax: 700,
        compensationCurrency: "EUR",
        compensationPeriod: "day",
      }),
    ).toBeNull();
    expect(
      estimateDayRate({
        compensationMin: 50000,
        compensationMax: 65000,
        compensationCurrency: "EUR",
        compensationPeriod: null,
      }),
    ).toBeNull();
  });

  it("returns null without a currency or without any bound", () => {
    expect(
      estimateDayRate({
        compensationMin: 50000,
        compensationMax: 65000,
        compensationCurrency: null,
        compensationPeriod: "year",
      }),
    ).toBeNull();
    expect(
      estimateDayRate({
        compensationMin: null,
        compensationMax: null,
        compensationCurrency: "EUR",
        compensationPeriod: "year",
      }),
    ).toBeNull();
  });

  it("rejects non-positive figures (never a zero/negative rate)", () => {
    expect(
      estimateDayRate({
        compensationMin: 0,
        compensationMax: 0,
        compensationCurrency: "EUR",
        compensationPeriod: "year",
      }),
    ).toBeNull();
  });

  it("rejects an implausibly large annual figure (mis-extraction guard)", () => {
    // e.g. a decimal-strip bug turning 45000.00 into 4 500 000 must NOT surface
    // a confident ~30 960 €/jour rate.
    expect(
      estimateDayRate({
        compensationMin: 4_500_000,
        compensationMax: 4_500_000,
        compensationCurrency: "EUR",
        compensationPeriod: "year",
      }),
    ).toBeNull();
  });
});
