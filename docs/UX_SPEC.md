# UX Specification

## Experience principles

- prioritize decisions over dashboards;
- show why before showing AI prose;
- make hard failures unmistakable;
- distinguish “bad fit” from “not enough information”;
- reveal detail progressively;
- keep the user in control of every external action.

## Navigation

Primary navigation:

- Dashboard
- Opportunities
- Applications
- Profile & Evidence
- Runs & Quality
- Settings

## Dashboard

Show:

- new qualified opportunities;
- items awaiting review;
- hard-fail count avoided;
- active application projects;
- recent workflow failures;
- cost and recommendation quality trend.

Avoid vanity metrics such as total listings collected without qualification context.

## Opportunity inbox

Each card or row shows:

- role and company;
- source and age;
- recommendation;
- weighted score and confidence as separate values;
- remote status;
- compensation status;
- top strength;
- main risk or unknown;
- current user decision.

Filters:

- recommendation;
- hard constraint status;
- role family;
- source;
- engagement type;
- remote eligibility;
- compensation confidence;
- date;
- user status.

## Opportunity detail

Order:

1. verdict and hard constraints;
2. next recommended action;
3. score breakdown;
4. evidence-backed strengths;
5. gaps and risks;
6. unknowns/questions for recruiter;
7. original listing and source provenance;
8. run history and model details.

## Application workspace

Use a split view:

- left: opportunity requirements and selected evidence;
- center: editable application asset;
- right: claim verification and warnings.

The approval control remains disabled while unsupported generated claims exist.

## Runs and quality

Provide an understandable operational view, not raw logs only:

- workflow state;
- completed and failed steps;
- retry action;
- prompt/model version;
- latency and cost;
- validation and evaluation results;
- sanitized error message.

## Accessibility

- all scores have text equivalents;
- do not rely on color alone;
- tables support keyboard navigation and responsive alternatives;
- loading and background processing states use live-region announcements when appropriate;
- focus returns predictably after dialogs and mutations.
