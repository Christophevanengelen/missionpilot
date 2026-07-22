# Domain Model

## CandidateProfile

Represents a user's current professional positioning and constraints.

Key fields:

- id
- userId
- displayName
- headline
- summary
- yearsExperience
- languages
- targetRoleFamilies
- preferredEngagementTypes
- targetDayRate
- minimumDayRate
- baseCurrency
- remotePolicy
- allowedWorkRegions
- timezoneOverlap
- travelTolerance
- hardExclusions
- status: draft | published | archived
- version
- createdAt
- publishedAt

## EvidenceItem

An atomic, reusable and verifiable professional fact.

Key fields:

- id
- profileVersionId
- type: achievement | responsibility | skill | domain | metric | testimonial | credential | portfolio_case
- title
- statement
- organization
- startDate
- endDate
- metrics
- tags
- sourceType
- sourceReference
- verificationStatus: imported | user_confirmed | externally_verified
- visibility

## Opportunity

Canonical representation of a role or mission.

Key fields:

- id
- canonicalFingerprint
- title
- organization
- engagementType
- seniority
- description
- responsibilities
- requirements
- niceToHaves
- domains
- skills
- locationText
- remoteType
- allowedCountries
- timezoneRequirements
- travelRequirements
- compensationMin
- compensationMax
- compensationCurrency
- compensationPeriod
- sourceUrl
- sourceName
- firstSeenAt
- lastSeenAt
- status

## OpportunitySnapshot

Immutable source capture used for provenance and reprocessing.

Key fields:

- id
- opportunityId
- retrievalMethod
- retrievedAt
- contentHash
- rawText
- rawHtmlStoragePath
- parserVersion
- sourcePolicyDecision

## MatchAnalysis

Versioned recommendation derived from one profile version and one opportunity snapshot.

Key fields:

- id
- opportunityId
- snapshotId
- profileVersionId
- scoringVersion
- hardConstraintStatus
- componentScores
- weightedScore
- confidence
- verdict
- summary
- strengths
- gaps
- risks
- unknowns
- nextAction
- runId
- createdAt

## MatchEvidenceLink

Links a match claim to profile evidence and source passages.

Key fields:

- id
- matchAnalysisId
- claimKey
- evidenceItemId
- sourceExcerptReference
- supportStrength

## AgentRun

Top-level execution trace.

Key fields:

- id
- workflowName
- workflowVersion
- status
- userId
- entityType
- entityId
- correlationId
- startedAt
- finishedAt
- estimatedCost
- errorCode
- errorSummary

## AgentStep

Key fields:

- id
- runId
- stepName
- attempt
- provider
- model
- promptVersion
- inputHash
- outputHash
- schemaValid
- tokenUsage
- latencyMs
- status
- error

## FeedbackEvent

Append-only user feedback.

Key fields:

- id
- userId
- entityType
- entityId
- eventType
- reasonCode
- note
- metadata
- createdAt

## State rules

- snapshots are immutable;
- analyses are immutable and superseded by new versions;
- feedback is append-only;
- a published profile version cannot be edited;
- application output retains the profile and analysis versions used;
- deletion uses a documented privacy workflow rather than ad hoc cascading.
