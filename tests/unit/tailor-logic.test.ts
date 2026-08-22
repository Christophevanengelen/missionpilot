import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ApplicationDraft } from "@/lib/matching/ai-tailor";
import { resolveChosenVariant, upsertDraft } from "@/lib/matching/tailor-logic";

// The selection contract: the model may only echo an offered name; anything
// else — null, unknown, wrong case — resolves to "no choice", never a guess.

const VARIANTS = [
  { id: "a", name: "Design Lead" },
  { id: "b", name: "Product Lead" },
];

describe("resolveChosenVariant", () => {
  it("null means no choice", () => {
    expect(resolveChosenVariant(VARIANTS, null)).toBeNull();
  });

  it("an exact name resolves to its variant", () => {
    expect(resolveChosenVariant(VARIANTS, "Product Lead")?.id).toBe("b");
  });

  it("an unknown name is treated as no choice, never a guess", () => {
    expect(resolveChosenVariant(VARIANTS, "General")).toBeNull();
  });

  it("the match is exact, not fuzzy — case matters", () => {
    expect(resolveChosenVariant(VARIANTS, "design lead")).toBeNull();
  });

  it("an empty offer list resolves everything to null", () => {
    expect(resolveChosenVariant([], "Design Lead")).toBeNull();
  });
});

const DRAFT: ApplicationDraft = {
  subject: "Candidature — Data Engineer",
  coverLetter: "Madame, Monsieur, …",
  highlights: ["Pipelines Spark en production"],
  cvVariantName: null,
  cvVariantRationale: null,
  needsReview: false,
  model: "mock-v1",
  promptVersion: "application-tailor-3",
  usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.001 },
};

/** A minimal stub exposing only the `.from(table).upsert(payload, options)`
 *  surface upsertDraft actually calls — enough to prove the WRITTEN SHAPE
 *  without a real database (the RLS/versioning invariants themselves are
 *  proven by the pgTAP suite and the integration test). */
function fakeClient(captured: { payload?: unknown; options?: unknown }) {
  return {
    from: () => ({
      upsert: async (payload: unknown, options: unknown) => {
        captured.payload = payload;
        captured.options = options;
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("upsertDraft — Apply Pack L3 backward compatibility", () => {
  it("defaults language to fr and tone_contract_id to null when omitted (zero regression)", async () => {
    const captured: { payload?: unknown } = {};
    await upsertDraft(
      fakeClient(captured),
      "profile-1",
      "opp-1",
      DRAFT,
      "a".repeat(64),
    );
    expect(captured.payload).toMatchObject({
      language: "fr",
      tone_contract_id: null,
      subject: "Candidature — Data Engineer",
    });
  });

  it("records the exact language and tone_contract_id it is given", async () => {
    const captured: { payload?: unknown } = {};
    await upsertDraft(
      fakeClient(captured),
      "profile-1",
      "opp-1",
      DRAFT,
      "b".repeat(64),
      null,
      "en",
      "tone-contract-v1",
    );
    expect(captured.payload).toMatchObject({
      language: "en",
      tone_contract_id: "tone-contract-v1",
    });
  });
});
