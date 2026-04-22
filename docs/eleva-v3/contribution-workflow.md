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

## Related Docs

- [`README.md`](./README.md)
- [`testing-strategy.md`](./testing-strategy.md)
- [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)
- [`adrs/README.md`](./adrs/README.md)
