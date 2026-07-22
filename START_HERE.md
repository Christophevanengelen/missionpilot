# Start Here

## 1. Put the folder on your Mac

Unzip `missionpilot-starter.zip` wherever you keep development projects, for example:

```bash
mkdir -p ~/Projects
cd ~/Projects
```

Move the extracted `missionpilot-starter` folder into `~/Projects`.

## 2. Open a terminal in the folder

```bash
cd ~/Projects/missionpilot-starter
```

## 3. Choose your coding agent

### Claude Code

```bash
claude
```

Then paste the contents of `prompts/BOOTSTRAP_CLAUDE_CODE.md`.

### Codex CLI

```bash
codex
```

Enter plan mode if needed, then paste the contents of `prompts/BOOTSTRAP_CODEX.md`.

## 4. Approve the plan, not the entire product

Ask the agent to implement **Phase 0 only** after you review:

- commands;
- dependencies;
- data/security approach;
- local setup;
- test strategy;
- deployment strategy.

## 5. GitHub and Vercel

Let the coding agent initialize Git only after the scaffold is clean and the first quality gate passes. Do not let it deploy until:

- no secrets are committed;
- authentication and RLS are verified;
- tests and production build pass;
- you have reviewed the generated environment-variable list.

The intended order is:

```text
local folder -> approved Phase 0 scaffold -> tests -> git init -> first commit -> GitHub -> Vercel preview -> production
```
