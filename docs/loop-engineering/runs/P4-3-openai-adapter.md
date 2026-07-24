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

| Check       | Result                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **167/167 unit** · build                                                                                                                                                                                                                                                                                           |
| unit        | **167** (+6: validated envelope + usage-based cost; out-of-contract ⇒ AiValidationError; non-JSON ⇒ AiValidationError; HTTP ⇒ AiProviderError, no body leak; injection inert; unconfigured gating ⇒ null, zero network)                                                                                                                                       |
| integration | **34** (unchanged)                                                                                                                                                                                                                                                                                                                                            |
| e2e         | **35** (unchanged — keyless path identical to PR 2)                                                                                                                                                                                                                                                                                                           |
| reviews     | Security **PASS** (key only in the Authorization header — verified absent from logs/errors/body; CV egress bounded to the approved call; injection boundary holds; fake test key). Implementation **CHANGES_REQUESTED** → **1 CRITICAL + 5 minors confirmed and repaired** (below); re-gated green (169 unit). Codex re-review deferred (quota) ≥ 2026-07-29. |
| CI          | green on the first pushed commit; re-run after the repairs.                                                                                                                                                                                                                                                                                                   |

## Review repairs (before merge)

- **CONFIRMED CRITICAL — first real call would 400.** `z.toJSONSchema` emits
  `minLength`/`maxLength` for the skills strings, and OpenAI's STRICT
  structured-outputs mode rejects those keywords (strings: pattern/format
  only) → every real call → 400 → graceful degradation → `aiUsed:false`: the
  flagship feature shipped dead-on-arrival, silently, and mocked-fetch tests
  could never catch it (the verifier executed the repo's zod to prove the
  emitted payload). **Fixed:** the provider now sanitizes the WIRE schema
  (recursive strip of `minLength`/`maxLength`/`default`) while the full Zod
  constraints still gate locally; `toJSONSchema` failures map to
  `AiConfigurationError`. Regression test asserts the actual outgoing
  `response_format` payload (real cv-ai shape) contains none of the rejected
  keywords and keeps the supported ones.
- **Minor — merged list > add cap.** Deterministic (≤66) + AI (≤60) could
  exceed the 100-skill cap, breaking "add all". Fixed: cap 130 (bounded by
  construction).
- **Minor — health probe repointed at the paid API.** Flipping the default
  provider would have made the /diagnostics probe call OpenAI. Fixed: probe
  pinned to `getAiProvider("mock")` (it verifies the abstraction's wiring).
- **Minor — model never validated.** `openai` + leftover `mock-v1` would 404
  every call silently. Fixed twice: build-time cross-field guard in
  `env-guards.ts` (openai ⇒ key present + non-mock model) + a typed
  constructor guard (`AiConfigurationError`), both tested.
- **Minor — latent strict-mode hazards.** dataSchema contract documented at
  the `AiRequest` boundary (all fields required, `.nullable()` over
  `.optional()`, supported keyword subset).

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" — merge
  on green CI + PASS reviews. Then guide the owner through setting the key in
  Vercel (their action). Next bricks: legal auto-discovery of offers +
  conversational onboarding.
- **stopReason**: —
