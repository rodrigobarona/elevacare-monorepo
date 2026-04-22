# Eleva.care v3 Decision Log

Status: Living

## Purpose

This document is the lightweight companion to the ADR system.

Use it to track:

- notable decisions that do not yet justify a full ADR
- temporary decisions that need later confirmation
- decision status changes that should stay visible to the team

## How To Use This Log

Each entry should include:

- date
- decision summary
- owner
- status
- related docs or ADRs
- next review date if the decision is provisional

## Status Values

- `proposed`
- `active`
- `needs-review`
- `superseded`

## Current Entries

### 2026-04-22: Start with one authenticated product app

- Owner: architecture/product
- Status: active
- Summary: Eleva v3 will begin with one authenticated `apps/app` using route groups and RBAC rather than splitting into separate expert/patient/admin apps on day one.
- Reference: [`adrs/ADR-001-app-topology.md`](./adrs/ADR-001-app-topology.md)

### 2026-04-22: Bring `Eleva Diary` into the same monorepo later

- Owner: architecture/product
- Status: active
- Summary: The Expo mobile app should join the Eleva monorepo after shared auth/API/domain contracts are stable.
- Reference: [`mobile-integration-spec.md`](./mobile-integration-spec.md)

### 2026-04-22: Multi-zone routing is progressive, not day-one

- Owner: architecture/platform
- Status: active
- Summary: Keep multi-zone as a future optimization once routing/SEO/team needs justify it.
- Reference: [`master-architecture.md`](./master-architecture.md)

## Related Docs

- [`adrs/README.md`](./adrs/README.md)
- [`master-architecture.md`](./master-architecture.md)
- [`contribution-workflow.md`](./contribution-workflow.md)
