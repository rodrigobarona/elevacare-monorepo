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
- [`implementation-sprints.md`](./implementation-sprints.md)
- [`testing-strategy.md`](./testing-strategy.md)
- [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)
- [`adrs/README.md`](./adrs/README.md)
