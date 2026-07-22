import { describe, expect, it } from "vitest";
import {
  assertRunTransition,
  assertStepTransition,
  canTransitionRun,
  canTransitionStep,
  isTerminalRunStatus,
  RUN_STATUSES,
  STEP_STATUSES,
} from "@/domain/run-state";

describe("agent run/step state machines", () => {
  it("allows running → completed | failed | cancelled for runs", () => {
    expect(canTransitionRun("running", "completed")).toBe(true);
    expect(canTransitionRun("running", "failed")).toBe(true);
    expect(canTransitionRun("running", "cancelled")).toBe(true);
  });

  it("treats completed/failed/cancelled as terminal run states", () => {
    for (const from of ["completed", "failed", "cancelled"] as const) {
      expect(isTerminalRunStatus(from)).toBe(true);
      for (const to of RUN_STATUSES) {
        expect(canTransitionRun(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
    expect(isTerminalRunStatus("running")).toBe(false);
  });

  it("forbids self-transition and resurrection of runs", () => {
    expect(canTransitionRun("running", "running")).toBe(false);
    expect(canTransitionRun("completed", "running")).toBe(false);
    expect(() => assertRunTransition("failed", "completed")).toThrow(
      "Illegal run transition: failed -> completed",
    );
  });

  it("allows running → completed | failed | skipped for steps, all terminal", () => {
    expect(canTransitionStep("running", "completed")).toBe(true);
    expect(canTransitionStep("running", "failed")).toBe(true);
    expect(canTransitionStep("running", "skipped")).toBe(true);
    for (const from of ["completed", "failed", "skipped"] as const) {
      for (const to of STEP_STATUSES) {
        expect(canTransitionStep(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
    expect(() => assertStepTransition("completed", "failed")).toThrow(
      "Illegal step transition",
    );
  });
});
