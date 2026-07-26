import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Client = SupabaseClient<Database>;

/**
 * The record of what we asked, and what came back.
 *
 * Kept separate from claims on purpose. A claim is a fact about someone's
 * career; a clarification is a conversation turn — including the turns where
 * the answer was "I don't know". Collapsing the two would lose the distinction
 * between *not asked* and *asked and unanswerable*, and it is the second one
 * that must stop us from asking again.
 */

export type Clarification = {
  id: string;
  questionKey: string;
  question: string;
  origin: "gap" | "career";
  answer: string | null;
  skipped: boolean;
};

function fail(what: string, message: string): never {
  throw new Error(`${what}: ${message}`);
}

/**
 * Question keys that must never be asked again — answered AND skipped alike.
 *
 * A skip is as final as an answer. Re-asking something a person already
 * declined to answer reads as not listening, and it is the fastest way to make
 * an assistant feel like a form.
 */
export async function loadSettledKeys(
  client: Client,
  profileId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("profile_clarifications")
    .select("question_key")
    .eq("profile_id", profileId)
    .not("settled_at", "is", null);
  if (error) fail("clarifications read", error.message);
  return (data ?? []).map((row) => row.question_key as string);
}

/** Answers given, for the dossier. Skips are deliberately excluded: "I don't
 *  know" is not a fact about a career. */
export async function loadAnswers(
  client: Client,
  profileId: string,
): Promise<{ question: string; answer: string }[]> {
  const { data, error } = await client
    .from("profile_clarifications")
    .select("question, answer")
    .eq("profile_id", profileId)
    .not("answer", "is", null)
    .order("settled_at", { ascending: true });
  if (error) fail("clarifications read", error.message);
  return (data ?? []).map((row) => ({
    question: row.question as string,
    answer: row.answer as string,
  }));
}

/** Comparison form for a question's identity: accent- and punctuation-free.
 *  Two phrasings of the same thing collapse onto one row, which is what makes
 *  "never ask the same thing twice" a database guarantee rather than a hope. */
export function questionKey(
  origin: "gap" | "career",
  question: string,
): string {
  const folded = question
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 150);
  return `${origin}:${folded}`;
}

/** Career questions still owed an answer, oldest first. */
export async function loadPendingCareer(
  client: Client,
  profileId: string,
): Promise<{ questionKey: string; question: string }[]> {
  const { data, error } = await client
    .from("profile_clarifications")
    .select("question_key, question")
    .eq("profile_id", profileId)
    .eq("origin", "career")
    .is("settled_at", null)
    .order("asked_at", { ascending: true });
  if (error) fail("clarifications read", error.message);
  return (data ?? []).map((row) => ({
    questionKey: row.question_key as string,
    question: row.question as string,
  }));
}

/**
 * Record the questions the career reading could not answer from the dossier.
 *
 * `ignoreDuplicates` is the load-bearing option: a question already asked —
 * answered, skipped, or still pending — must keep its existing row. Upserting
 * would reset a settled question back to pending and re-ask something the
 * person already dealt with, which is the one behaviour this whole design
 * refuses.
 */
export async function recordCareerQuestions(
  client: Client,
  profileId: string,
  questions: readonly string[],
): Promise<void> {
  const rows = questions
    .map((q) => q.trim())
    .filter((q) => q !== "")
    .slice(0, 5)
    .map((question) => ({
      profile_id: profileId,
      question_key: questionKey("career", question),
      question: question.slice(0, 300),
      origin: "career" as const,
      answer: null,
      skipped: false,
      settled_at: null,
    }));
  if (rows.length === 0) return;
  const { error } = await client.from("profile_clarifications").upsert(rows, {
    onConflict: "profile_id,question_key",
    ignoreDuplicates: true,
  });
  if (error) fail("career questions record", error.message);
}

/**
 * Record a settled question — answered, or skipped.
 *
 * Upsert on (profile_id, question_key): asking twice is a bug, but answering
 * twice is a correction, and a correction must win rather than collide.
 */
export async function settleClarification(
  client: Client,
  profileId: string,
  input: {
    questionKey: string;
    question: string;
    origin: "gap" | "career";
    answer: string | null;
  },
): Promise<void> {
  const { error } = await client.from("profile_clarifications").upsert(
    {
      profile_id: profileId,
      question_key: input.questionKey,
      question: input.question,
      origin: input.origin,
      answer: input.answer,
      skipped: input.answer === null,
      settled_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,question_key" },
  );
  if (error) fail("clarification settle", error.message);
}
