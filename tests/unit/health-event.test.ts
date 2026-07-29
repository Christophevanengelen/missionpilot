import { describe, expect, it } from "vitest";
import { correlationIdFor, healthEventSchema } from "@/workflows/health-logic";
import { functions } from "@/workflows";

// The Inngest handler rejects with NonRetriableError exactly when this schema
// rejects — these cases pin the handler's permanent-failure branch.
describe("system/health.requested payload contract", () => {
  // Zod 4's z.uuid() enforces the RFC 4122 version/variant bits.
  const valid = {
    userId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "ui-12345678",
  };

  it("accepts a valid payload, with or without the test hook", () => {
    expect(healthEventSchema.safeParse(valid).success).toBe(true);
    expect(
      healthEventSchema.safeParse({ ...valid, simulateAiFailure: true })
        .success,
    ).toBe(true);
  });

  it("rejects malformed payloads", () => {
    const invalid = [
      {},
      { ...valid, userId: "not-a-uuid" },
      { ...valid, idempotencyKey: "short" },
      { ...valid, idempotencyKey: "x".repeat(201) },
      { ...valid, unexpected: "field" },
      { ...valid, simulateAiFailure: "yes" },
    ];
    for (const payload of invalid) {
      expect(
        healthEventSchema.safeParse(payload).success,
        JSON.stringify(payload),
      ).toBe(false);
    }
  });

  it("derives a stable correlation id from the idempotency key", () => {
    expect(correlationIdFor("abc-123")).toBe("health-abc-123");
  });

  it("registers every function that must be served, by id", () => {
    /* Assertion par IDENTITÉ plutôt que par compte. Un `toHaveLength(n)` oblige
       à corriger un chiffre à chaque ajout — un geste qu'on fait sans réfléchir,
       et qui ne vérifie rien : il passerait aussi bien si la nouvelle fonction
       avait remplacé l'ancienne. Ce qui compte est que CHACUNE soit servie ;
       une fonction absente du registre n'est jamais appelée, et rien ne le
       signale — l'événement part et disparaît. */
    // InngestFunction is circular — use its id() accessor, not serialization.
    const ids = functions.map((f) =>
      (f as unknown as { id: (prefix?: string) => string }).id(),
    );
    for (const attendu of ["system-health", "profile-search-plan"]) {
      expect(ids.some((id) => id.includes(attendu))).toBe(true);
    }
  });
});
