import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Deterministic check for the Loop Engineering record contract
// (schemas/loop-run.schema.json). Zod mirrors the contract per the Phase 0
// decision (no ajv); the JSON Schema file remains the published reference,
// this test keeps the two in lockstep and validates example records.

const BRIEFING_FIELDS = [
  "taskId",
  "goal",
  "status",
  "acceptanceCriteria",
  "constraints",
  "attempt",
  "maxAttempts",
  "actions",
  "evidence",
  "checks",
  "reviewFindings",
  "nextAction",
  "requiresHumanApproval",
  "stopReason",
  "startedAt",
  "completedAt",
] as const;

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: "must be an ISO 8601 date-time",
});

const loopRunObject = z
  .object({
    schemaVersion: z.literal("1.0"),
    taskId: z.string().min(1),
    goal: z.string().min(1),
    status: z.enum(["in_progress", "completed", "failed", "escalated"]),
    acceptanceCriteria: z.array(z.string()).min(1),
    constraints: z.array(z.string()),
    attempt: z.number().int().min(1),
    maxAttempts: z.number().int().min(1),
    actions: z.array(z.string()),
    evidence: z.array(z.string()),
    checks: z.array(
      z.strictObject({
        name: z.string(),
        command: z.string().optional(),
        result: z.enum(["passed", "failed", "skipped"]),
      }),
    ),
    reviewFindings: z.array(
      z.strictObject({
        reviewer: z.string(),
        severity: z.enum(["blocker", "major", "minor", "info"]),
        finding: z.string(),
        resolution: z.enum(["fixed", "accepted", "escalated", "open"]),
      }),
    ),
    nextAction: z.string(),
    requiresHumanApproval: z.boolean(),
    stopReason: z.string().nullable(),
    startedAt: isoDateTime,
    completedAt: isoDateTime.nullable(),
  })
  .strict();

// Terminal records must carry a non-empty stopReason and a completedAt
// (mirrors the schema's if/else constraint and STOP_CONDITIONS.md).
const loopRunZod = loopRunObject.refine(
  (r) =>
    r.status === "in_progress" ||
    (typeof r.stopReason === "string" &&
      r.stopReason.length > 0 &&
      r.completedAt !== null),
  {
    message: "terminal records require a non-empty stopReason and completedAt",
  },
);

function loadSchema(): Record<string, unknown> {
  const raw = readFileSync(
    join(__dirname, "../../schemas/loop-run.schema.json"),
    "utf8",
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

const completedRecord = {
  schemaVersion: "1.0",
  taskId: "J0",
  goal: "Create the Loop Engineering foundation",
  status: "completed",
  acceptanceCriteria: ["docs, agents, template and schema exist"],
  constraints: ["no runtime code", "no new dependencies"],
  attempt: 2,
  maxAttempts: 3,
  actions: ["created docs/loop-engineering/*"],
  evidence: ["schema validated against Draft 2020-12"],
  checks: [{ name: "schema parse", command: "python3", result: "passed" }],
  reviewFindings: [
    {
      reviewer: "implementation-reviewer",
      severity: "major",
      finding: "nonexistent test asserted as fact",
      resolution: "fixed",
    },
  ],
  nextAction: "await approval for J1",
  requiresHumanApproval: true,
  stopReason: "acceptance criteria met and verified",
  startedAt: "2026-07-22T17:15:00+02:00",
  completedAt: "2026-07-22T17:35:00+02:00",
} satisfies z.input<typeof loopRunZod>;

describe("loop-run.schema.json contract", () => {
  it("parses and targets JSON Schema draft 2020-12", () => {
    const schema = loadSchema();
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.title).toBe("LoopRun");
    expect(schema.additionalProperties).toBe(false);
  });

  it("requires every field from the Loop Engineering briefing", () => {
    const schema = loadSchema();
    const required = schema.required as string[];
    const properties = Object.keys(
      schema.properties as Record<string, unknown>,
    );
    for (const field of BRIEFING_FIELDS) {
      expect(required, `${field} must be required`).toContain(field);
      expect(properties, `${field} must be declared`).toContain(field);
    }
  });

  it("stays in lockstep with the Zod mirror (same field set)", () => {
    const schema = loadSchema();
    const schemaFields = Object.keys(
      schema.properties as Record<string, unknown>,
    ).sort();
    const zodFields = Object.keys(loopRunObject.shape).sort();
    expect(zodFields).toEqual(schemaFields);
  });

  it("accepts a valid completed record", () => {
    expect(loopRunZod.safeParse(completedRecord).success).toBe(true);
  });

  it("accepts an in-progress record without stopReason/completedAt", () => {
    const record = {
      ...completedRecord,
      status: "in_progress",
      stopReason: null,
      completedAt: null,
    };
    expect(loopRunZod.safeParse(record).success).toBe(true);
  });

  it("rejects terminal records with a null or empty stopReason", () => {
    for (const stopReason of [null, ""]) {
      const record = { ...completedRecord, stopReason };
      expect(
        loopRunZod.safeParse(record).success,
        `stopReason=${JSON.stringify(stopReason)} must be rejected`,
      ).toBe(false);
    }
  });

  it("rejects terminal records without a completedAt", () => {
    const record = { ...completedRecord, completedAt: null };
    expect(loopRunZod.safeParse(record).success).toBe(false);
  });

  it("rejects invalid enum values and constraint violations", () => {
    const invalidRecords = [
      { ...completedRecord, status: "done" },
      { ...completedRecord, attempt: 0 },
      { ...completedRecord, acceptanceCriteria: [] },
      {
        ...completedRecord,
        checks: [{ name: "x", result: "maybe" }],
      },
      {
        ...completedRecord,
        reviewFindings: [
          {
            reviewer: "r",
            severity: "catastrophic",
            finding: "f",
            resolution: "fixed",
          },
        ],
      },
    ];
    for (const record of invalidRecords) {
      expect(loopRunZod.safeParse(record).success).toBe(false);
    }
  });

  it("rejects records with unknown fields", () => {
    const record = { ...completedRecord, transcript: "forbidden" };
    expect(loopRunZod.safeParse(record).success).toBe(false);
  });
});
