# Evaluation Framework

## Why evaluations are required

A workflow can be schema-valid and still be misleading. MissionPilot therefore evaluates correctness, evidence grounding, policy compliance, calibration and usefulness.

## Evaluation layers

### 1. Deterministic validation

- schema parses;
- required fields exist;
- scores are within range;
- weighted score calculation is correct;
- hard-fail cap is respected;
- evidence IDs exist and belong to the active profile version;
- no unsupported external action is requested.

### 2. Fixture-based regression

Maintain synthetic fixtures for:

- excellent match;
- wrong seniority;
- hybrid role disguised as remote;
- geographic restriction;
- compensation below floor;
- unknown compensation;
- strong transferable skills with weak domain match;
- malicious prompt injection inside a listing;
- duplicate listing from two sources;
- sparse listing with low confidence.

### 3. Model-assisted graders

Use an independent prompt and, when affordable, a different model/provider to grade:

- factual grounding;
- completeness;
- score calibration;
- contradiction handling;
- clarity;
- actionability.

Model graders never replace deterministic checks.

### 4. Human feedback

Capture:

- shortlist/reject decision;
- reason codes;
- score disagreement;
- missing evidence;
- application quality rating;
- interview and offer outcome.

## Initial thresholds

- schema validity: 100%;
- unsupported generated application claims: 0%;
- hard-constraint compliance: 100%;
- evidence citation coverage for strengths: >= 95%;
- top-10 recommendation precision: establish baseline, then target >= 80%;
- human-rated explanation usefulness: target >= 4/5.

## Release gate

A prompt, model or scoring change must be compared against the current baseline on the complete evaluation set. Regressions in safety, factual grounding or hard constraints block release even if average style scores improve.

## Experiment record

Every experiment stores:

- dataset version;
- prompt version;
- model/provider;
- scoring configuration;
- run date;
- aggregate metrics;
- per-fixture deltas;
- decision and rationale.
