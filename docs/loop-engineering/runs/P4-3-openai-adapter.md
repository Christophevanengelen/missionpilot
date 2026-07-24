# Task Loop Record — Phase 4 / PR 3 — OpenAI adapter + AI CV reading

- **schemaVersion**: 1.0
- **taskId**: P4-3-openai-adapter
- **goal**: First REAL AI provider (owner decision: owner has an OpenAI
  account and approved LLM usage "quand c'est nécessaire et relevant").
  An OpenAI adapter on the existing `AiProvider` abstraction + the first use
  case: **AI reading of the CV** to propose skills beyond the curated
  taxonomy — merged into the same confirm-chips flow. Graceful degradation:
  without a key, everything stays deterministic and free.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T11:30:00+02:00
- **startSha**: `9777f15` (main, after Phase 4 PR 2)
- **branch**: `feat/phase-4-openai-adapter`

## Owner decisions (recorded)

- Owner: "J'ai un compte OpenAI. On peut utiliser l'IA quand c'est nécessaire
  et relevant pour la qualité du projet." → OpenAI is the approved provider.
- Activation requires the OWNER to set `OPENAI_API_KEY` +
  `AI_DEFAULT_PROVIDER=openai` + `AI_DEFAULT_MODEL` (e.g. `gpt-4o-mini`) in
  Vercel — guided step; the key is never handled by the assistant.

## Scope

- **`src/lib/ai/openai-provider.ts`**: direct REST to `/v1/chat/completions`
  (no SDK dependency) with **structured outputs** — the envelope's JSON Schema
  (via Zod 4 `z.toJSONSchema`) is enforced server-side by OpenAI AND
  re-validated by the same Zod envelope gate as every provider. Fixed system
  prompt; request input serialized and labeled DATA (prompt-injection
  boundary). Typed errors (`AiConfigurationError` without key,
  `AiProviderError` on HTTP/network, `AiValidationError` on contract
  violations). 30s timeout, `max_completion_tokens` 2000, temperature 0.
  Cost estimate from a small price table (honest 0 for unknown models);
  **no secret and no response body ever logged** (status/error-type only).
- **Registry**: `openai` added to the allowlist; env enum extended
  (`AI_DEFAULT_PROVIDER: mock | openai`). `.env.example` documents activation.
- **`src/lib/profile/cv-ai.ts`**: `aiDetectSkills(text)` —
  `cv-skill-extraction` task, prompt `cv-skills-1`, input capped 30k chars
  (cost bound), returns `null` when unconfigured or failing (AI can NEVER
  break the import). Defensive de-dup/bounding of the model's list.
- **`cv-actions.ts`**: merges deterministic + AI skills (case-insensitive
  de-dup, deterministic casing wins), returns `aiUsed`.
- **UI**: an honest note when AI contributed ("vérifiez-les avant d'ajouter").
  Copy FR+EN.

## Key safety

- The envelope boundary is enforced twice (OpenAI strict schema + Zod). CV
  text remains DATA; hostile instructions inside it or in the model output are
  inert (unit-tested). No CV content is persisted or logged. Everything runs
  server-only; the key exists only in the Authorization header at call time.
- CI/e2e run WITHOUT a key: `aiUsed=false` path — deterministic behavior
  identical to PR 2 (full suite green).

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **167/167 unit** · build                                                                                                                                                     |
| unit        | **167** (+6: validated envelope + usage-based cost; out-of-contract ⇒ AiValidationError; non-JSON ⇒ AiValidationError; HTTP ⇒ AiProviderError, no body leak; injection inert; unconfigured gating ⇒ null, zero network) |
| integration | **34** (unchanged)                                                                                                                                                                                                      |
| e2e         | **35** (unchanged — keyless path identical to PR 2)                                                                                                                                                                     |
| reviews     | (to fill after independent passes)                                                                                                                                                                                      |
| CI          | (to fill after push)                                                                                                                                                                                                    |

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. Then guide the owner through setting the key in
  Vercel (their action). Next bricks: legal auto-discovery of offers +
  conversational onboarding.
- **stopReason**: —
