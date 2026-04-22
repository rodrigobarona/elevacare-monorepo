# Eleva.care v3 Handbook

This folder is the working documentation set for the Eleva.care v3 rebuild.

It should be treated as the team-facing source of truth for:

- product-to-engineering translation
- architecture and platform decisions
- monorepo structure
- domain modeling
- implementation sequencing
- compliance and data-governance constraints
- mobile and multi-surface strategy

This handbook is based on the master planning work captured in the Eleva v3 project plan and on the legacy product, blueprint, and vendor research already reviewed during planning.

## How To Use This Handbook

Read these documents in order when onboarding a developer, designer, PM, or agent to the project:

1. [`master-architecture.md`](./master-architecture.md)
2. [`monorepo-structure.md`](./monorepo-structure.md)
3. [`domain-model.md`](./domain-model.md)
4. [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)
5. [`payments-payouts-spec.md`](./payments-payouts-spec.md)
6. [`mobile-integration-spec.md`](./mobile-integration-spec.md)
7. [`adrs/README.md`](./adrs/README.md)

## Document Status

The docs in this folder use these meanings:

- `Authoritative`: approved direction the team should implement against
- `Draft`: working proposal that still needs a decision
- `Living`: approved, but expected to evolve as implementation reveals new constraints

Unless a document says otherwise, assume it is `Living` and should be updated when major decisions change.

## Current Canon

### Authoritative starting decisions

- Eleva v3 is an EU-first digital health platform with strong compliance and privacy boundaries.
- The first authenticated web product should be one app with strong RBAC and route-group separation.
- The public marketing/discovery surface and the authenticated product surface should be separate apps.
- The monorepo should be built with `pnpm` workspaces and Turborepo.
- `Eleva Diary` should join the same monorepo, but only after shared backend and contract layers are stable.

### Inputs this handbook is grounded in

- `/_context/blueprints/elevacare-mvp/*`
- `/_context/blueprints/multi-zone-monorepo.md`
- `/_context/clone-repo/next-forge/README.md`
- `/_context/clone-repo/eleva-care-app/*`
- `/_context/clone-repo/cal.diy/*`

## Handbook Structure

### Core architecture

- [`master-architecture.md`](./master-architecture.md): the high-level system view, major decisions, workstreams, and phased roadmap
- [`monorepo-structure.md`](./monorepo-structure.md): apps, packages, ownership boundaries, and evolution path
- [`domain-model.md`](./domain-model.md): the canonical product/data model for Eleva v3

### Core product systems

- [`scheduling-booking-spec.md`](./scheduling-booking-spec.md): booking, availability, calendars, sessions, and reminders
- [`payments-payouts-spec.md`](./payments-payouts-spec.md): marketplace billing, subscriptions, packs, payouts, and financial states
- [`mobile-integration-spec.md`](./mobile-integration-spec.md): Expo app placement, sync/share rules, and patient-companion strategy

### Decision records

- [`adrs/README.md`](./adrs/README.md): ADR index and writing guidance

## Required Follow-Up Docs

The team should add these next as implementation begins:

- `identity-rbac-spec.md`
- `notifications-spec.md`
- `crm-spec.md`
- `ai-reporting-spec.md`
- `compliance-data-governance.md`
- `content-seo-spec.md`
- `ops-observability-spec.md`

## Rules For Maintaining This Folder

- Do not silently change a foundational decision in code only.
- When a major decision changes, update the relevant spec and add or supersede an ADR.
- Keep phase sequencing aligned with reality.
- Prefer explicit tradeoffs over vague statements.
- Link related docs to each other so the team can navigate the system quickly.
