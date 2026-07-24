import { describe, expect, it } from "vitest";
import {
  buildTestimonialEvidence,
  recommendationInputSchema,
} from "@/lib/profile/recommendation";

describe("buildTestimonialEvidence", () => {
  it("always produces a testimonial with honest provenance", () => {
    const ev = buildTestimonialEvidence({
      recommender: "Jane Doe",
      relationship: "ex-manager",
      organization: "Globex",
      text: "Excellent engineer — shipped X on time.",
      sourceUrl: "https://www.linkedin.com/in/janedoe/",
    });
    expect(ev.type).toBe("testimonial");
    expect(ev.title).toBe("Jane Doe");
    expect(ev.statement).toContain("Excellent engineer");
    expect(ev.organization).toBe("Globex");
    expect(ev.rolePlayed).toBe("ex-manager");
    expect(ev.verificationStatus).toBe("user_confirmed");
    // A verification link ⇒ url provenance + the reference kept.
    expect(ev.sourceType).toBe("url");
    expect(ev.sourceReference).toBe("https://www.linkedin.com/in/janedoe/");
  });

  it("is user_stated (no reference) when there is no verification link", () => {
    const ev = buildTestimonialEvidence({
      recommender: "John",
      text: "Great to work with.",
    });
    expect(ev.type).toBe("testimonial");
    expect(ev.sourceType).toBe("user_stated");
    expect(ev.sourceReference).toBeUndefined();
  });
});

describe("recommendationInputSchema", () => {
  it("requires a recommender and text", () => {
    expect(
      recommendationInputSchema.safeParse({ recommender: "A" }).success,
    ).toBe(false);
    expect(recommendationInputSchema.safeParse({ text: "B" }).success).toBe(
      false,
    );
    expect(
      recommendationInputSchema.safeParse({ recommender: "A", text: "B" })
        .success,
    ).toBe(true);
  });

  it("accepts an http(s) verification link and rejects anything else", () => {
    const base = { recommender: "A", text: "B" };
    expect(
      recommendationInputSchema.safeParse({
        ...base,
        sourceUrl: "https://linkedin.com/in/x",
      }).success,
    ).toBe(true);
    for (const bad of [
      "javascript:alert(1)",
      "ftp://x",
      "notaurl",
      "/relative",
    ]) {
      expect(
        recommendationInputSchema.safeParse({ ...base, sourceUrl: bad })
          .success,
        bad,
      ).toBe(false);
    }
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      recommendationInputSchema.safeParse({
        recommender: "A",
        text: "B",
        evil: 1,
      }).success,
    ).toBe(false);
  });
});
