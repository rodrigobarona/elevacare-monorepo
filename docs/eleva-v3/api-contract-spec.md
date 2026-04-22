# Eleva.care v3 API Contract Spec

Status: Living

## Purpose

This document defines how Eleva.care v3 should think about API boundaries and shared contracts across:

- `apps/web`
- `apps/app`
- `apps/api`
- `apps/diary-mobile`
- future jobs/workflows

The goal is to keep the system contract-driven even while the product starts as a monorepo with shared packages.

## API Principles

- The domain model is the source of truth; APIs expose that model safely.
- Contracts should be typed, versionable, and reusable across web and mobile.
- Public API surfaces should be narrower than internal package boundaries.
- Sensitive data access must be authorized before serialization, not after.
- Prefer stable DTOs over leaking raw ORM/database structures.

## API Surface Types

### Internal app-to-package contracts

These are not HTTP APIs.
They are shared TypeScript/domain contracts used inside the monorepo.

Examples:

- validation schemas
- service input/output types
- workflow payload types

### First-party product APIs

These are APIs used by Eleva-owned clients such as:

- authenticated web product
- public web flows where needed
- mobile app

Examples:

- booking creation
- dashboard data
- diary sync and sharing
- expert CRM actions

### External integration APIs

These are system-facing endpoints such as:

- Stripe webhooks
- Daily webhook intake
- inbound messaging hooks
- partner/admin integrations later

## Recommended Contract Layers

### Domain layer

Defines:

- entities
- policies
- service contracts

### Transport layer

Defines:

- request DTOs
- response DTOs
- webhook payload normalization
- mobile-safe payloads

### UI consumption layer

Defines:

- query shapes
- pagination/filter contracts
- mutation result contracts

## Boundary Rules

- Apps should not depend on raw database rows.
- Mobile should not depend on web-only component assumptions.
- Public endpoints should never expose internal admin/system fields by accident.
- Webhook endpoints should normalize provider payloads into internal event contracts quickly.

## Contract Ownership

Recommended package ownership:

- `packages/db`: persistence schema only
- `packages/auth`: auth/session claims and access helpers
- `packages/scheduling`: booking/schedule contracts
- `packages/billing`: billing/payout contracts
- `packages/crm`: CRM-oriented contracts
- `packages/mobile`: mobile-safe DTOs and sync payloads
- `packages/notifications`: notification event payloads
- `packages/ai`: AI generation and review payloads

## API Style Direction

The exact transport can evolve, but the system should behave as if it has a formal API contract layer even when some calls stay in-process.

This means:

- explicit input schemas
- explicit output schemas
- stable resource naming
- stable mutation semantics
- documented error shapes

## Contract Categories To Define

The team should explicitly define contracts for:

- auth/session bootstrap
- organization/workspace selection
- expert profile and listing data
- search and discovery queries
- scheduling and slot availability
- booking creation/update/cancel
- packs and subscriptions
- patient dashboard data
- CRM views and follow-up actions
- diary sync/share flows
- transcript/report flows
- admin/operator actions

## Error Model

The platform should standardize:

- validation errors
- authentication errors
- authorization errors
- conflict errors
- integration failure responses
- retryable workflow errors

Do not let each route invent its own shape casually.

## Pagination And Filtering

Search/list APIs should support explicit:

- pagination
- sort
- filter params
- stable cursors or page semantics

This is especially important for:

- marketplace discovery
- CRM lists
- admin queues
- notifications

## Mobile Considerations

The mobile API contract should be:

- explicit
- minimal
- offline-aware where needed later
- not tightly coupled to web navigation or server component assumptions

## Security Considerations

- authorize before serialization
- minimize fields by audience
- do not expose sensitive content in debug/error payloads
- validate all inbound provider webhooks separately from internal action calls

## Open Questions

- exact transport style for first-party APIs
- how much of the contract layer is package-only versus HTTP-first
- first pass of versioning policy for mobile-sensitive endpoints

## Related Docs

- [`domain-model.md`](./domain-model.md)
- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
