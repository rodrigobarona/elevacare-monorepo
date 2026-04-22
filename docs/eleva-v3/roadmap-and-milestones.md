# Eleva.care v3 Roadmap And Milestones

Status: Living

## Purpose

This document translates the Eleva v3 architecture and product strategy into milestone-based delivery planning.

It should help the team answer:

- what comes first
- what can run in parallel
- what must be complete before the next phase starts
- what each milestone should prove

## Planning Principles

- Sequence by dependency, not by enthusiasm.
- Land foundational contracts before large feature surfaces.
- Use milestones to prove risk reduction, not just feature count.
- Keep phases outcome-based and testable.

## Milestone 0: Architecture Baseline

Goal:

- establish the shared source of truth for product, platform, and delivery

Should include:

- handbook docs
- ADR baseline
- vendor decision matrix
- domain model
- workstream ownership

Exit criteria:

- core architecture docs exist
- major early decisions are written down
- the team agrees on initial topology and scope

## Milestone 1: Monorepo Foundation

Goal:

- create the production-ready repo foundation

Should include:

- `pnpm` workspace
- Turborepo
- `apps/web`
- `apps/app`
- `apps/api`
- `apps/docs`
- `apps/email`
- core packages
- CI baseline

Exit criteria:

- repo boots cleanly
- packages compile and link correctly
- auth/db/config/ui package boundaries exist
- dev onboarding is documented

## Milestone 2: Identity, Tenancy, And Compliance Core

Goal:

- establish secure product access and workspace boundaries

Should include:

- WorkOS integration
- organizations and memberships
- RBAC baseline
- consent/audit boundaries
- sensitive-data access rules

Exit criteria:

- users can authenticate
- workspace context works
- route and server-side authorization are enforced
- high-risk access paths are auditable

## Milestone 3: Public Web And Marketplace Discovery

Goal:

- launch the public discovery surface

Should include:

- marketing site
- category pages
- expert public profiles
- search and filter basics
- trust/legal pages
- metadata and SEO foundation

Exit criteria:

- marketplace browsing works
- profile pages convert to booking entry
- SEO primitives are in place

## Milestone 4: Scheduling, Booking, And Payments

Goal:

- make the marketplace operational

Should include:

- event types
- schedules and availability
- calendar connections
- slot reservation
- booking flow
- payment flow
- pack/subscription baseline

Exit criteria:

- a user can search, book, and pay
- scheduling conflicts are handled correctly
- booking/payment flows are observable

## Milestone 5: Patient Portal, CRM, And Reports

Goal:

- make Eleva useful beyond a single booking

Should include:

- patient dashboard
- session history
- document/report access
- expert CRM basics
- follow-up reminders

Exit criteria:

- patient and expert longitudinal workflows work
- customer relationship state is visible to the expert

## Milestone 6: Video, Transcripts, And AI Drafting

Goal:

- accelerate expert workflows with session infrastructure

Should include:

- Daily sessions
- transcript ingestion
- AI draft reporting
- expert review/approval flow

Exit criteria:

- transcript pipeline is stable
- AI draft lifecycle is controlled and auditable

## Milestone 7: Mobile Integration

Goal:

- connect `Eleva Diary` into the shared platform

Should include:

- monorepo integration for mobile
- shared auth/contracts
- diary sync/share model
- patient visibility controls

Exit criteria:

- mobile and web share the same user/account model
- expert visibility obeys share rules

## Milestone 8: Hardening And Launch

Goal:

- move from functional platform to reliable launch candidate

Should include:

- operational runbooks
- security hardening
- support playbooks
- launch readiness verification

Exit criteria:

- launch checklist passes
- critical observability and runbooks exist
- rollback path is defined

## Parallelization Guidance

Workstreams that can often overlap:

- public web and docs
- design system and product app shell
- CRM planning and notification planning
- observability setup and workflow orchestration

Work that should stay sequential or tightly coordinated:

- schema changes
- auth and RBAC foundations
- booking/payment state design
- diary visibility model

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`dependency-map.md`](./dependency-map.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
