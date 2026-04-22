# Eleva.care v3 Schema And Migration Rules

Status: Living

## Purpose

This document defines the rules for database schema evolution and migrations in Eleva.care v3.

It should guide:

- `packages/db`
- Drizzle schema changes
- migration sequencing
- environment promotion

## Principles

- The domain model should lead schema design.
- Schema changes should be explicit, reviewable, and reversible where practical.
- Migrations should be treated as production changes, not incidental code edits.
- Avoid hidden schema drift between environments.

## Ownership

`packages/db` should be the single home for:

- schema definitions
- migrations
- seed helpers where used
- database conventions

Apps should not define competing schema sources.

## Migration Rules

- Every meaningful schema change should result in an explicit migration.
- Migration intent should be understandable from the PR and docs context.
- Risky data migrations should be documented separately if they are non-trivial.
- Do not mix unrelated schema changes into one migration casually.

## Review Expectations

Schema changes should be reviewed for:

- domain correctness
- authorization/data-boundary impact
- performance/index implications
- migration safety
- effect on mobile/API/search/reporting flows

## Sensitive Data Considerations

Changes touching these areas require extra review:

- transcripts
- reports
- documents
- diary data
- consent records
- payout/payment state
- permission/membership state

## Backward Compatibility

Where practical, prefer migration sequences that reduce deploy risk.

Examples:

- add nullable column -> backfill -> enforce later
- add new structure before removing old structure

Do not rely on perfect lockstep deploy assumptions for risky changes.

## Environment Flow

The team should explicitly define and follow:

- local migration workflow
- staging migration workflow
- production promotion workflow

## Data Migrations

If a change needs data backfill or transformation, document:

- what changes
- how it is executed
- how it is verified
- rollback or mitigation approach

## Seeding And Fixtures

If seed data exists, it should support:

- local development
- staging smoke tests where useful

Seed logic should not become a substitute for real migration discipline.

## Related Docs

- [`domain-model.md`](./domain-model.md)
- [`api-contract-spec.md`](./api-contract-spec.md)
- [`testing-strategy.md`](./testing-strategy.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
