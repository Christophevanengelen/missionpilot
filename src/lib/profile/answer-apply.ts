import type { ProfilePreferences } from "@/domain/profile";
import {
  ENGAGEMENT_TYPES,
  REMOTE_POLICIES,
  type EngagementType,
  type RemotePolicy,
} from "@/domain/profile";
import type { QuestionTarget } from "./next-question";

/**
 * Turning what someone typed into a fact we are willing to keep.
 *
 * Pure, so the one place where free text becomes profile data can be tested
 * exhaustively rather than trusted. Everything here refuses rather than
 * coerces: an answer we cannot read as the thing we asked for is REJECTED, and
 * the person is asked again. Storing a best-effort interpretation of "je ne
 * sais pas trop, ça dépend" as a seniority level would quietly poison every
 * search that follows, and they would never know why the results went wrong.
 *
 * The profile is the only thing this product stores. It does not get to hold
 * guesses.
 */

export type AppliedAnswer =
  | {
      to: "claim";
      kind: "role" | "seniority" | "years_experience";
      value: Record<string, string | number>;
    }
  | { to: "preferences"; patch: Partial<ProfilePreferences> }
  /** Nothing to write beyond the clarification row itself — the recorded
   *  answer is the fact, and the dossier reads it from there. */
  | { to: "dossier" };

export type ApplyResult =
  | { ok: true; applied: AppliedAnswer }
  | { ok: false; reason: "empty" | "unreadable" };

/** Splits a free-text list on commas and slashes, trimming and de-duplicating. */
function asList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;/]|\bet\b/)) {
    const value = part.trim();
    if (value === "") continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Years of experience from a human answer.
 *
 * Accepts "12", "12 ans", "environ 12". Refuses anything with no number, and
 * refuses implausible values rather than clamping them: someone who typed 300
 * made a mistake, and silently recording 80 would hide it from them.
 */
function asYears(raw: string): number | null {
  const match = raw.match(/\d{1,3}/);
  if (match === null) return null;
  const years = Number.parseInt(match[0], 10);
  if (!Number.isFinite(years) || years < 0 || years > 80) return null;
  return years;
}

function asEnum<T extends string>(
  raw: string,
  allowed: readonly T[],
): T | null {
  const folded = raw.trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === folded) ?? null;
}

export function applyAnswer(
  target: QuestionTarget,
  rawAnswer: string,
): ApplyResult {
  const answer = rawAnswer.trim();
  if (answer === "") return { ok: false, reason: "empty" };

  // A sentence about scope has no vocabulary to validate against, so there is
  // nothing here to refuse but emptiness. Trying to be cleverer — rejecting
  // answers that "don't look like" a team size — would throw away exactly the
  // nuance these questions were asked to capture.
  if (target.kind === "dossier") {
    return { ok: true, applied: { to: "dossier" } };
  }

  if (target.kind === "claim") {
    switch (target.claim) {
      case "role":
        return {
          ok: true,
          applied: { to: "claim", kind: "role", value: { title: answer } },
        };
      case "seniority":
        return {
          ok: true,
          applied: { to: "claim", kind: "seniority", value: { level: answer } },
        };
      case "years_experience": {
        const years = asYears(answer);
        if (years === null) return { ok: false, reason: "unreadable" };
        return {
          ok: true,
          applied: {
            to: "claim",
            kind: "years_experience",
            value: { years },
          },
        };
      }
    }
  }

  switch (target.field) {
    case "targetRoleFamilies": {
      const list = asList(answer);
      if (list.length === 0) return { ok: false, reason: "empty" };
      return {
        ok: true,
        applied: { to: "preferences", patch: { targetRoleFamilies: list } },
      };
    }
    case "allowedWorkRegions": {
      const list = asList(answer);
      if (list.length === 0) return { ok: false, reason: "empty" };
      return {
        ok: true,
        applied: { to: "preferences", patch: { allowedWorkRegions: list } },
      };
    }
    case "remotePolicy": {
      // A closed vocabulary, so free text that is not one of the four values is
      // refused rather than mapped by guesswork.
      const policy = asEnum<RemotePolicy>(answer, REMOTE_POLICIES);
      if (policy === null) return { ok: false, reason: "unreadable" };
      return {
        ok: true,
        applied: { to: "preferences", patch: { remotePolicy: policy } },
      };
    }
    case "preferredEngagementTypes": {
      const types = asList(answer)
        .map((v) => asEnum<EngagementType>(v, ENGAGEMENT_TYPES))
        .filter((v): v is EngagementType => v !== null);
      if (types.length === 0) return { ok: false, reason: "unreadable" };
      return {
        ok: true,
        applied: {
          to: "preferences",
          patch: { preferredEngagementTypes: types },
        },
      };
    }
  }
}
