# Eleva.care v3 Academy Strategy Spec

Status: Living

## Purpose

This document defines how a future Eleva Academy should be thought about in the v3 architecture.

It should guide:

- product boundary decisions
- domain modeling
- monorepo planning
- identity and organization reuse

## Core Decision

Eleva Academy should begin as a domain and package boundary, not as a separate app from day one.

## Why

The future Academy may support:

- experts as teachers/professors
- structured learning or guidance flows
- organization-based educational experiences
- new content and community experiences

But today, the platform still has shared foundations:

- same users
- same organizations
- same memberships
- same payments/billing system
- same notification system
- same content/docs surface

Creating a separate Academy app too early would risk splitting the platform before the true domain boundaries are proven.

## Recommended Strategy

### Near term

- model Academy as a planned domain
- keep room for future route groups in `apps/app`
- design packages so academy logic can be isolated later

### Medium term

- add academy-specific domain models and permissions
- test whether Academy behaves like a module inside the product or a separate surface

### Later

Only create a dedicated `apps/academy` if Academy gains:

- materially different navigation
- materially different release cadence
- distinct team ownership
- distinct runtime or SEO needs

## Shared Foundations Academy Should Reuse

- identity
- organizations
- memberships
- RBAC
- content system
- billing
- notifications
- analytics/observability

## Potential Academy Domain Concepts

- program
- course
- lesson
- cohort
- instructor role
- learner role
- enrollment
- completion/progress state

These concepts should be designed later, but they should reuse the same core platform foundations.

## Marketplace Relationship

Academy may eventually intersect with marketplace discovery.

Examples:

- an expert offers both sessions and structured programs
- an organization offers education packages

The platform should not assume Academy must be isolated from marketplace concepts.

## Content Relationship

Academy will likely rely heavily on:

- docs/content systems
- structured learning content
- multilingual content support

This strengthens the case for shared content infrastructure rather than an isolated product stack.

## Open Questions

- whether Academy is customer-facing only or also organization-facing
- whether Academy includes live cohorts, async content, or both
- when Academy becomes important enough to justify dedicated app boundaries

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`organization-and-clinic-model.md`](./organization-and-clinic-model.md)
- [`monorepo-structure.md`](./monorepo-structure.md)
