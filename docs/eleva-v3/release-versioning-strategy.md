# Eleva.care v3 Release And Versioning Strategy

Status: Living

## Purpose

This document defines how Eleva v3 should think about release cadence, rollout discipline, and versioning.

## Principles

- Release often, but with clear rollout control.
- Tie releases to documented milestone outcomes where possible.
- Use semantic clarity in changelogs and release notes.
- Prefer safe staged rollout over big-bang launches.

## Release Types

### Foundation releases

Used for:

- monorepo setup
- shared package stabilization
- internal-only platform changes

### Feature releases

Used for:

- user-facing capabilities
- new flows
- new integrations

### Hardening releases

Used for:

- stability
- observability
- security
- performance improvements

## Versioning Guidance

The exact release mechanics can evolve, but the team should keep:

- a changelog or release notes habit
- clear release boundaries
- explicit communication for breaking operational changes

## Recommended Discipline

- every release should have a known owner
- risky releases should have rollback expectations
- flag-controlled features should state whether they are active in the release

## Related Docs

- [`feature-flag-rollout-plan.md`](./feature-flag-rollout-plan.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
