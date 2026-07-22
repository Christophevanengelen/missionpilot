# Engineering Principles

## 1. Spec before code

A task must identify its user outcome, acceptance criteria, affected contracts and verification commands before implementation.

## 2. Small reversible changes

Prefer narrow vertical slices and explicit migrations. Avoid broad rewrites without measured need.

## 3. Deterministic before probabilistic

Use normal code for validation, filtering, arithmetic, permissions and state transitions. Use models for ambiguous extraction, synthesis and judgment.

## 4. Typed boundaries

All external inputs and model outputs cross a runtime-validated schema boundary.

## 5. Truthful generation

Generated application content may use only verified evidence. Unsupported claims are a release-blocking defect.

## 6. Explainability is a feature

A score without evidence, risks and unknowns is incomplete.

## 7. Tests describe the contract

Critical domain behavior must be tested before or with implementation. A UI snapshot alone is not sufficient.

## 8. Failure is a product state

Every workflow needs retry, timeout, cancellation, partial-result and human-recovery behavior.

## 9. Idempotency by design

Repeated imports, events and retries must not create duplicate business effects.

## 10. Security by default

Use least privilege, server-side secrets, RLS, private storage and sanitized untrusted content.

## 11. Accessibility and performance

Keyboard navigation, semantic markup and understandable loading/error states are part of done.

## 12. Provider portability

Business logic must not depend directly on one AI provider's response shape.

## 13. Cost is observable

Record token usage, model, latency and estimated cost for every model call.

## 14. No silent learning

Feedback-driven changes to ranking or prompts must be inspectable, versioned and reversible.

## 15. Human approval for external action

No email, application, message or external mutation occurs without explicit confirmation.

---

How these principles are enforced during development is defined in `docs/loop-engineering/LOOP_CONTRACT.md` (development loop, independent review, stop conditions).
