# Eleva.care v3 Monorepo Structure

Status: Living

## Purpose

This document defines the intended monorepo structure for Eleva.care v3.

It answers:

- which apps should exist
- which packages should exist
- which boundaries each app/package owns
- how the repo should evolve over time

## Principles

- Keep app count low until product boundaries are real.
- Keep package boundaries explicit from day one.
- Share contracts across web, API, jobs, and mobile.
- Avoid duplicating domain logic inside apps.
- Make future app splitting possible without forcing it now.

## Top-Level Layout

```text
.
├── apps/
│   ├── web/
│   ├── app/
│   ├── api/
│   ├── docs/
│   ├── email/
│   ├── jobs/                # later
│   ├── diary-mobile/        # later
│   └── storybook/           # later
├── packages/
│   ├── config/
│   ├── auth/
│   ├── db/
│   ├── ui/
│   ├── compliance/
│   ├── scheduling/
│   ├── billing/
│   ├── crm/
│   ├── notifications/
│   ├── ai/
│   ├── mobile/             # later
│   ├── analytics/          # later
│   ├── observability/      # later
│   ├── content/            # later
│   ├── eslint-config/
│   └── typescript-config/
└── docs/
    └── eleva-v3/
```

## Apps

### `apps/web`

Purpose:

- marketing
- SEO
- expert marketplace/discovery
- expert public profiles
- legal and trust content
- booking entry points

Owns:

- public information architecture
- metadata and search-facing content
- public conversion flows

Does not own:

- core business logic
- booking engine logic
- auth/session internals
- payment orchestration internals

### `apps/app`

Purpose:

- authenticated product for experts, patients, org admins, and Eleva operators

Expected route groups:

- `(expert)`
- `(patient)`
- `(org)`
- `(admin)`
- `(settings)`
- future `(academy)`

Owns:

- authenticated UX
- role-based navigation
- workspace layouts

Does not own:

- raw payment logic
- raw scheduling engine logic
- raw auth implementation details
- duplicated API/domain models

### `apps/api`

Purpose:

- webhook endpoints
- backend integration endpoints
- future stable contract for mobile and partners
- workflow triggers and backend-only orchestration

Owns:

- backend entry points
- webhook validation
- service-level API boundaries

Does not own:

- direct UI
- duplicated business rules that should live in packages

### `apps/docs`

Purpose:

- product docs
- help content
- guides
- implementation references for the team where public/internal split allows

### `apps/email`

Purpose:

- React Email templates
- preview flows
- shared lifecycle messaging artifacts

### `apps/jobs` later

Purpose:

- durable workflows
- retries
- exports
- heavy background orchestration

This should only be introduced when `apps/api` becomes too coupled to long-running or operationally heavy jobs.

### `apps/diary-mobile` later

Purpose:

- Expo / React Native patient companion app
- symptom and health-tracking data capture
- reminders and engagement
- consented sharing to Eleva dashboard/expert flows

It should join the monorepo after the shared contract layer is stable.

### `apps/storybook` later

Purpose:

- component documentation
- UI verification
- design-system collaboration

## Packages

### `packages/config`

Owns:

- environment validation
- feature/config constants
- URL helpers
- shared app/runtime config

### `packages/auth`

Owns:

- WorkOS integration
- session model
- organization resolution
- RBAC helpers
- auth-safe server/client contracts

### `packages/db`

Owns:

- Drizzle schema
- migrations
- seed helpers
- shared data-access boundaries

### `packages/ui`

Owns:

- design-system components
- tokens
- forms primitives
- app-agnostic shared components

### `packages/compliance`

Owns:

- consent model
- audit event model
- retention/export helpers
- data classification guidance

### `packages/scheduling`

Owns:

- event types
- schedules
- availabilities
- slot computation
- reservation logic
- calendar abstractions

### `packages/billing`

Owns:

- Stripe product and price mapping
- packs
- subscriptions
- commission logic
- payouts
- invoice/payment states

### `packages/crm`

Owns:

- customer/contact model
- lifecycle state
- segmentation
- expert-facing CRM helpers

### `packages/notifications`

Owns:

- notification domain model
- email/SMS/in-app contracts
- template payload schemas
- preference and channel rules

### `packages/ai`

Owns:

- Vercel AI Gateway integration
- prompt contracts
- transcript summarization
- AI report drafting flows

### `packages/mobile` later

Owns:

- mobile-safe client contracts
- shared validation schemas
- sync/share DTOs
- mobile API SDK helpers

### `packages/analytics` and `packages/observability` later

Owns:

- PostHog and analytics wrappers
- Sentry and BetterStack wrappers
- instrumentation helpers

### `packages/content` later

Owns:

- typed content loading
- markdown/docs helpers
- LLMs.txt and metadata helpers

## Ownership Rules

### Apps should orchestrate, packages should define

Apps should compose UI and flows.
Packages should hold the reusable domain and system logic.

### Shared logic belongs in packages

If two apps need the same:

- domain model
- validation
- service logic
- API client logic
- policy logic

it should move into a package.

### Do not let packages become random utility buckets

Each package must have:

- a clear purpose
- a stable boundary
- a small number of public entry points

## Evolution Path

### Initial state

- `apps/web`
- `apps/app`
- `apps/api`
- `apps/docs`
- `apps/email`
- core packages

### Near-term expansion

- `packages/mobile`
- `apps/diary-mobile`
- `packages/analytics`
- `packages/observability`

### Later expansion only if justified

- `apps/jobs`
- `apps/storybook`
- app split into `expert`, `patient`, or `admin`
- dedicated `academy` app

## When To Split The Product App Later

The team should consider splitting `apps/app` only if one or more become true:

- expert and patient products have materially different release cadence
- product teams become independent
- runtime or security isolation needs become distinct
- bundle and performance concerns become significant
- academy becomes a genuinely separate product surface

Until then, keep one authenticated product app.

## Dependencies And Direction

Use a dependency direction like:

```text
apps/* -> packages/*
packages/feature -> packages/foundation
packages/foundation -> no app dependency
```

Never let a package depend on an app.

## Required Companion Docs

- [`master-architecture.md`](./master-architecture.md)
- [`domain-model.md`](./domain-model.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
