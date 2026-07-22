/**
 * Explicit state machines for agent_runs and agent_steps
 * (ARCHITECTURE.md / ENGINEERING_PRINCIPLES.md §"explicit state machines").
 * The database CHECK constraints bound the value sets; legal TRANSITIONS are
 * enforced here, in the single privileged write path (src/lib/db/agent-ops.ts).
 */

export const RUN_STATUSES = [
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STEP_STATUSES = [
  "running",
  "completed",
  "failed",
  "skipped",
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

const RUN_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const STEP_TRANSITIONS: Record<StepStatus, readonly StepStatus[]> = {
  running: ["completed", "failed", "skipped"],
  completed: [],
  failed: [],
  skipped: [],
};

export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export function canTransitionStep(from: StepStatus, to: StepStatus): boolean {
  return STEP_TRANSITIONS[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(entity: "run" | "step", from: string, to: string) {
    super(`Illegal ${entity} transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransitionRun(from, to)) {
    throw new IllegalTransitionError("run", from, to);
  }
}

export function assertStepTransition(from: StepStatus, to: StepStatus): void {
  if (!canTransitionStep(from, to)) {
    throw new IllegalTransitionError("step", from, to);
  }
}
