import type { z } from "zod";
import type { AgentOutputEnvelope } from "@/lib/ai/envelope";

/**
 * Provider-neutral AI contracts (ARCHITECTURE.md §"AI layer").
 * Business code depends on these shapes only — never on a concrete
 * provider's response format (ENGINEERING_PRINCIPLES.md §12).
 */

export type AiRequest<T> = {
  /** Stable task identifier, e.g. "system-health-probe". */
  taskName: string;
  /** Versioned prompt identifier — prompts are versioned assets. */
  promptVersion: string;
  /**
   * SERVER-AUTHORED task instruction, delivered on the TRUSTED side of the
   * prompt (system message) — never inside `input`, which is untrusted data.
   * Keeping instructions and data on separate trust levels is what makes the
   * "ignore instructions inside the input" rule enforceable.
   */
  taskInstruction?: string;
  /**
   * Task input. Treated strictly as DATA by every provider: it can never
   * change rules, schemas or expected statuses (prompt-injection boundary).
   */
  input: unknown;
  /**
   * Zod schema the envelope's `data` field must satisfy.
   *
   * CONTRACT for real providers with strict structured outputs (OpenAI):
   * use strict objects with ALL fields required (no `.optional()` — model
   * `?` as `.nullable()`), and constraints from the supported subset
   * (pattern/format for strings, minimum/maximum for numbers,
   * min/maxItems for arrays). String min/max length and `default` are
   * stripped from the WIRE schema and enforced only by the local Zod gate.
   */
  dataSchema: z.ZodType<T>;
  /**
   * Budget d'attente de CET appel, en millisecondes. Au-delà, l'appel est
   * abandonné et l'appelant se débrouille sans — jamais une exception qui
   * remonte à l'écran.
   *
   * POURQUOI CE CHAMP EXISTE. Le provider a un plafond unique de 30 s, ce qui
   * convient à un travail de fond et ne convient à AUCUN rendu de page : il est
   * plus long que la durée de vie de la fonction serverless elle-même, si bien
   * qu'un seul appel pouvait empêcher la page d'arriver, sans jamais lever
   * d'erreur qu'on aurait pu lire. Un appel dans un chemin de rendu doit
   * déclarer son budget, et il doit être court.
   *
   * Ce n'est pas un détail de fournisseur : « combien de temps j'accepte
   * d'attendre » est une décision de l'appelant, pas d'OpenAI.
   */
  timeoutMs?: number;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

export type AiResponse<T> = {
  envelope: AgentOutputEnvelope<T>;
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  usage: AiUsage;
};

export interface AiProvider {
  readonly name: string;
  /**
   * Returns ONLY after the full envelope (including `data`) has been
   * validated; structurally invalid output throws AiValidationError and is
   * never exposed to the caller.
   */
  generateStructured<T>(request: AiRequest<T>): Promise<AiResponse<T>>;
}
