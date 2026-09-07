# Eleva.care v3 Contribution Workflow

Status: Living

## Purpose

This document defines how the team should contribute changes to Eleva v3 in a way that stays aligned with the handbook.

## Principles

- Major changes should start from the handbook and ADRs, not from isolated code decisions.
- Contributors should keep docs and implementation aligned.
- Changes should be scoped, reviewable, and verifiable.

## Expected Workflow

1. identify the relevant handbook docs
2. confirm whether an ADR or doc update is needed
3. implement in the correct app/package boundary
4. verify with the right level of testing
5. update docs if the decision or behavior changed

## Before Starting A Change

- read the relevant Eleva v3 docs
- identify impacted workstreams
- identify dependency risks
- check whether a new ADR is required

## During Implementation

- keep changes scoped
- prefer package reuse over app duplication
- maintain contract boundaries
- avoid undocumented one-off behavior

## Before Merging

- verify tests/checks relevant to the change
- update docs if needed
- confirm no handbook assumptions were silently broken

## Pull-Request Review Policy

- **Every PR requires at least one CodeRabbit AI review.** The review
  runs automatically against `main` — config lives in
  [`.coderabbit.yaml`](../../.coderabbit.yaml) at repo root.
- **Author must acknowledge or address every CodeRabbit comment before
  merge.** Reply with a fix, a follow-up issue link, or an explicit
  "not actionable because …" on each comment. Unacknowledged comments
  block merge.
- The `coderabbit` GitHub status check must be green. It is a required
  check on the `main` branch-protection rule.
- CI gates (`lint`, `typecheck`, `build`, `lockfile-guard`, plus the
  per-sprint checks that come online later) are also required checks.
- For the monorepo rules applied to every PR — boundary lint, RLS
  isolation, audit-row coverage, no vendor-SDK leakage, no
  `bun install`, no hardcoded `payment_method_types`,
  no `process.env.ENCRYPTION_KEY` — see
  [`implementation-sprints.md`](./implementation-sprints.md) "Global
  Rules Applied Every Sprint" and "Definition of Done (Per Sprint)".

### PR size (CodeRabbit 100-file cap) and review allowance

CodeRabbit skips review when a PR changes more than **100 files** (observed on
PR #20: "Review skipped: 109 files exceed the limit of 100"). Keep PRs under
this limit — the execution plan targets <= 30 files / 400 lines per PR:

- Reduce counted files via `.coderabbit.yaml` → `reviews.path_filters`
  (excludes lockfiles, `.next/`, `dist/`, `coverage/`, `.turbo/`,
  generated types, Husky shims, Cursor state, `_context/`, the PoC demo
  app `apps/poc/`, and PoC specs `_context/PoCs/`).
- `apps/poc` is also excluded from CI lint, typecheck, and build
  (`turbo --filter=!@eleva/poc`) and from pre-commit eslint — it is an
  internal playground, not a production app.
- If a sprint's scope genuinely exceeds 100 reviewable files, **split
  the PR** along sub-step boundaries (S1.1, S1.2 … ) so each land
  gets its own review. Track the split in the sprint's plan.
- The S0 foundation-migration PR was the known exception — 158 files
  (scaffolding 4 apps + 16 empty packages in one go). Post-S0 sprint
  PRs should not repeat this.

### CodeRabbit CLI loop (local gate before the PR gate)

The GitHub App review above is the **PR gate**. Before a PR exists,
every branch also runs CodeRabbit from the **CLI** so that findings are
fixed before anyone else sees them. The loop is defined in
[`execution-plan/README.md`](./execution-plan/README.md) section 4 and
operated through the
[`coderabbit-review` skill](../../.cursor/skills/coderabbit-review/SKILL.md).

| Script               | Command                                               | When                                                                        |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm review`        | `coderabbit review --uncommitted --include-untracked` | Before every commit                                                         |
| `pnpm review:branch` | `coderabbit review --committed --base main`           | Before `git push` / `gh pr create`, and after every fix batch on an open PR |
| `pnpm review:agent`  | `coderabbit review --agent --base main`               | When an agent needs structured findings (JSON lines)                        |

Plain-text output is the CLI default (CodeRabbit CLI >= 0.7). Keep the CLI current with
`coderabbit update`; flags changed between 0.4 and 0.7 (`--plain`/`--type` were removed).

Rules:

1. One phase (or feature) = one branch `phase-NN/<slug>` from an
   up-to-date `main` = one PR.
2. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build`
   before `pnpm review`; the CLI should review working code.
3. Fix every CLI finding, or record it as declined with a reason in the
   PR body ("CodeRabbit CLI" section of the template in
   `execution-plan/README.md` section 8). Never weaken a rule to silence
   a finding. Security, RLS, audit, vendor-boundary and PHI-in-logs
   findings are never declined.
4. On the PR, loop until **zero unresolved CodeRabbit comments and all
   CI checks green**, then request one human approval and merge with
   `gh pr merge --squash --delete-branch`.
5. The CLI needs `coderabbit auth login` once per machine (CI does not
   run it; the GitHub App remains the required status check).

### Branch-protection summary

On `main`:

- require PR before merge
- require at least 1 human review plus the `coderabbit` check
- require all CI status checks green (at minimum: `lint`, `typecheck`,
  `build`, `lockfile-guard`, `coderabbit`)
- dismiss stale approvals on new commits
- include administrators in the above rules

## Related Docs

- [`README.md`](./README.md)
- [`execution-plan/README.md`](./execution-plan/README.md) — phase sequencing SSOT and review loop
- [`implementation-sprints.md`](./implementation-sprints.md)
- [`testing-strategy.md`](./testing-strategy.md)
- [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)
- [`adrs/README.md`](./adrs/README.md)
