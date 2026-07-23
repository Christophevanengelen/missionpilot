# Task Loop Record — Phase 2 / PR 2 — URL import + source-policy gate

- **schemaVersion**: 1.0
- **taskId**: P2-2-url-source-policy
- **goal**: Add a source URL to imports and gate it by a source policy —
  WITHOUT fetching third-party content server-side (owner decision). The URL
  is classified and recorded as provenance; the user still pastes the text.
- **status**: in_progress
- **attempt**: 1
- **startedAt**: 2026-07-24T02:00:00+02:00
- **startSha**: `e5d97e1` (main, after Phase 2 PR 1)
- **branch**: `feat/phase-2-url-source-policy`

## Owner decision (recorded)

Asked whether URL import should fetch content. Owner chose **"gate only, no
fetch"**: safest — no SSRF, no scraping of sites whose terms forbid it. Real
guarded fetching of a vetted allowlist is a later, explicitly-approved PR.

## Scope

- **No migration**: the PR A ingestion RPC already accepts
  `retrieval_method` and `source_policy_decision`, and the opportunity has
  `source_url`/`source_name` — the URL path reuses it exactly.
- **Source policy** (`src/lib/opportunity/source-policy.ts`, pure):
  `classifySource(url)` → discriminated result. `blocked` for invalid URL,
  non-http(s) scheme, private/internal host or bare IP literal (SSRF
  hygiene — the same guard the future fetch PR will rely on), and a
  terms-of-service blocklist (linkedin/indeed/glassdoor, incl. subdomains).
  `manual_only` for any other public http(s) URL. `allowed` reserved.
- **Logic** (`logic.ts`): a shared `runImport` provenance path;
  `importFromUrl` classifies then records URL + `retrieval_method='url'` +
  `source_policy_decision='manual_only'` (NO fetch); a blocked URL throws a
  typed reason.
- **Action** (`actions.ts`): `importFromUrlAction` returns a SPECIFIC honest
  blocked reason (not the generic error) for a blocked source.
- **UI**: optional URL field above the paste textarea, an explicit "we do
  not fetch — paste the text; the link is recorded as provenance" note, and
  per-reason blocked messages. The inspection screen shows the source URL as
  PLAIN TEXT (never a live link). Copy FR+EN.

## Key safety

Pasted text stays untrusted DATA (unchanged from PR 1). A submitted URL is
never fetched and never rendered as a clickable/navigable link. Private/
internal hosts and bare IPs are rejected outright (SSRF hygiene, even with no
fetch). ToS-hostile domains are refused as an import source (the user may
still paste text without a link).

## Checks (evidence)

| Check       | Result                                                                                                                                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify      | passed — format:check · lint · typecheck · **105/105 unit** · build                                                                                                                                                                                                                                   |
| unit        | **105** (+8 source-policy: public ⇒ manual_only; invalid/scheme/private-host/bare-IP/terms blocked with the right reason; +1 closing the IPv6-literal & trailing-dot SSRF bypasses; deterministic, never throws)                                                                                      |
| integration | **30** (+3: public URL recorded as provenance with retrieval_method=url + manual_only, content is the pasted text; blocked terms-forbid and private-host both refused before any write)                                                                                                               |
| e2e         | **33/33** — blocked source refused honestly (no navigation) + public URL recorded as provenance (shown as text, never a link)                                                                                                                                                                         |
| reviews     | Implementation **PASS** (2 LOW: dead type aliases → removed; SSRF guard note → fixed). Security **PASS** (no fetch; source_url is plain text) with **2 MAJOR** SSRF classifier bypasses — both **repaired** before merge (see below). Codex re-review deferred (quota) to ≥ 2026-07-29, non-blocking. |
| CI          | (to fill after push)                                                                                                                                                                                                                                                                                  |

## Review repairs (before merge)

- **MAJOR (security) — SSRF classifier bypass, IPv4-mapped IPv6.** `[::ffff:169.254.169.254]` / `[::ffff:127.0.0.1]` reached `manual_only`. Fixed: `isPrivateHost` now rejects ANY bracketed IPv6 literal (`host.startsWith("[")`) — one rule covering loopback, ULA, link-local, unspecified, IPv4-mapped and public IPv6.
- **MAJOR (security) — trailing-dot loopback + bracketed literals.** `localhost.` and `[::]` reached `manual_only`. Fixed: host is normalised (lowercase + single trailing dot stripped) before the loopback/IPv4 checks; all bracketed literals blocked as above.
- **LOW (impl) — dead exported aliases.** Unused `SourceDecision` / `SourceReason` exports removed; `SourceClassification` keeps its inline discriminated union; `SourceBlockedReason` (consumed by the action + form) retained.
- **Regression guard:** unit test "closes IPv6-literal and trailing-dot SSRF bypasses" asserts `[::ffff:169.254.169.254]`, `[::ffff:127.0.0.1]`, `[::]`, public IPv6, `localhost.`, `127.0.0.1.` → all `blocked/private_host`.
- **INFO (accepted):** `registrableRoot` is a naive last-2-labels heuristic (a `.co.uk` cousin of a blocklisted domain could slip through). Under-blocking only, and the plain paste flow always remains; a PSL-backed check is deferred to the future fetch PR that would actually rely on it.

## Stop

- **requiresHumanApproval**: standing "fusionne et continue en boucle" —
  merge on green CI + PASS reviews, then continue.
- **stopReason**: —
