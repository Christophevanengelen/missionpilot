/**
 * Testable persistence + grouping for the application-tracking pipeline (CRM).
 * No "use server" here so the action stays a thin orchestrator and integration
 * tests exercise the exact production logic through a real session client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Client = SupabaseClient<Database>;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

/** The pipeline stages, in flow order (also the column order of the board). */
export const TRACKING_STAGES = [
  "saved",
  "prepared",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;

export type TrackingStage = (typeof TRACKING_STAGES)[number];

export function isTrackingStage(v: unknown): v is TrackingStage {
  return typeof v === "string" && TRACKING_STAGES.includes(v as TrackingStage);
}

export type Tracking = {
  opportunityId: string;
  stage: TrackingStage;
  note: string;
  followUpOn: string | null;
};

/** One tracked opportunity, joined with the fields the board needs to render. */
export type TrackedOpportunity = Tracking & {
  title: string | null;
  organization: string | null;
  updatedAt: string;
};

/** The tracking row of one opportunity, or null (RLS: own rows only). */
export async function loadTracking(
  client: Client,
  profileId: string,
  opportunityId: string,
): Promise<Tracking | null> {
  const { data, error } = await client
    .from("opportunity_tracking")
    .select("opportunity_id, stage, note, follow_up_on")
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();
  if (error) fail("tracking load", error.message);
  if (!data) return null;
  return {
    opportunityId: data.opportunity_id,
    stage: data.stage as TrackingStage,
    note: data.note,
    followUpOn: data.follow_up_on,
  };
}

/** Upsert the tracking row (create or move through the pipeline). */
export async function upsertTracking(
  client: Client,
  profileId: string,
  input: Tracking,
): Promise<void> {
  const { error } = await client.from("opportunity_tracking").upsert(
    {
      profile_id: profileId,
      opportunity_id: input.opportunityId,
      stage: input.stage,
      note: input.note,
      follow_up_on: input.followUpOn,
    },
    { onConflict: "profile_id,opportunity_id" },
  );
  if (error) fail("tracking upsert", error.message);
}

/** Remove an opportunity from the pipeline. */
export async function deleteTracking(
  client: Client,
  profileId: string,
  opportunityId: string,
): Promise<void> {
  const { error } = await client
    .from("opportunity_tracking")
    .delete()
    .eq("profile_id", profileId)
    .eq("opportunity_id", opportunityId);
  if (error) fail("tracking delete", error.message);
}

/** All tracked opportunities of the profile (RLS: own), newest-touched first. */
export async function listTracked(
  client: Client,
  profileId: string,
): Promise<TrackedOpportunity[]> {
  const { data, error } = await client
    .from("opportunity_tracking")
    .select(
      "opportunity_id, stage, note, follow_up_on, updated_at, opportunities(title, organization)",
    )
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (error) fail("tracking list", error.message);
  return data.map((row) => {
    const opp = row.opportunities as {
      title: string | null;
      organization: string | null;
    } | null;
    return {
      opportunityId: row.opportunity_id,
      stage: row.stage as TrackingStage,
      note: row.note,
      followUpOn: row.follow_up_on,
      title: opp?.title ?? null,
      organization: opp?.organization ?? null,
      updatedAt: row.updated_at,
    };
  });
}

/** Group tracked opportunities into the pipeline columns (stage order kept,
 *  every stage present even when empty). Pure — unit-tested. */
export function groupByStage(
  tracked: TrackedOpportunity[],
): Record<TrackingStage, TrackedOpportunity[]> {
  const groups = Object.fromEntries(
    TRACKING_STAGES.map((s) => [s, [] as TrackedOpportunity[]]),
  ) as Record<TrackingStage, TrackedOpportunity[]>;
  for (const item of tracked) groups[item.stage].push(item);
  return groups;
}

/** Follow-ups due on or before `today` (YYYY-MM-DD), soonest first — the
 *  "relances" surfaced at the top of the board. Pure — unit-tested. */
export function dueFollowUps(
  tracked: TrackedOpportunity[],
  today: string,
): TrackedOpportunity[] {
  return (
    tracked
      .filter((t) => t.followUpOn !== null && t.followUpOn <= today)
      // Total order (returns 0 on equal dates) so same-day follow-ups keep their
      // stable input order (updated_at desc) instead of an arbitrary one.
      .sort((a, b) => a.followUpOn!.localeCompare(b.followUpOn!))
  );
}
