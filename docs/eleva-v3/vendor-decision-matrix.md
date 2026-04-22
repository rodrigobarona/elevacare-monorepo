# Eleva.care v3 Vendor Decision Matrix

Status: Living

## Purpose

This document captures the current vendor choices, why they are being considered, what they should own, and which risks or validation items remain open.

It should be used by:

- engineering
- product
- operations
- compliance/legal review

This is not a procurement file. It is a technical decision matrix for implementation planning.

## Decision Principles

- Prefer vendors that fit the EU-first compliance posture.
- Keep vendor responsibilities explicit.
- Avoid using one vendor outside its natural boundary just because it is available.
- Record open risks before implementation hardens around assumptions.

## Matrix

## Authentication, organizations, and secure identity

### WorkOS

Decision status:

- preferred

Expected role:

- authentication
- organizations
- session model
- RBAC support
- secure identity primitives
- Vault for sensitive/encrypted fields

Why it fits:

- aligns with B2B and organization-aware product needs
- supports the identity model Eleva already leans toward
- provides a better path for org-aware auth than many B2C-first tools

Open validations:

- exact EU data residency posture
- final permission-model boundary between WorkOS and Eleva
- confirmation that feature flags and calendar sync should not be assumed to belong here

## Database and core persistence

### Neon

Decision status:

- preferred

Expected role:

- primary Postgres database

Why it fits:

- strong fit with Drizzle
- serverless-friendly operational model
- good default for modern TypeScript platform work

Open validations:

- final compliance/data residency posture
- backup and disaster-recovery expectations

### Drizzle

Decision status:

- preferred

Expected role:

- ORM
- schema definition
- migrations
- typed data access layer

Why it fits:

- explicit schema ownership
- strong TypeScript ergonomics
- good fit for package-based monorepo architecture

## Payments and payouts

### Stripe

Decision status:

- preferred

Expected role:

- checkout/payment collection
- recurring billing
- payouts rails where applicable
- billing primitives

Why it fits:

- best alignment with marketplace, packs, and subscriptions
- mature payout and billing ecosystem

Open validations:

- exact seat-sync model
- exact invoice/tax requirements for Portugal/EU flows
- final fee and payout architecture

## Video and transcripts

### Daily

Decision status:

- preferred

Expected role:

- video sessions
- room/session infrastructure
- transcript source

Why it fits:

- strong video SDK fit
- transcript support is strategically valuable for Eleva workflows

Open validations:

- exact data handling and residency posture
- transcript retention expectations
- operational costs and pipeline shape for transcript-heavy usage

## Email and lifecycle messaging

### Resend

Decision status:

- preferred

Expected role:

- transactional email
- email templates
- audiences
- email-oriented automation

Why it fits:

- clean fit for product email
- good template/developer ergonomics

Open validations:

- how far lifecycle automation should go here versus inside Eleva
- whether SMS remains external to this stack

## Product analytics

### PostHog

Decision status:

- preferred

Expected role:

- product analytics
- event instrumentation
- behavior insight

Why it fits:

- strong product analytics fit for platform and workflow analysis

Open validations:

- exact event taxonomy
- final privacy posture and self-hosting/region considerations if needed

## Web analytics

### Google Analytics

Decision status:

- conditional

Expected role:

- marketing/web analytics only if privacy posture remains acceptable

Why it may fit:

- familiar marketing reporting

Risks:

- weaker privacy perception than some alternatives
- may not align with the desired EU-first posture unless implemented carefully

Decision note:

- do not assume GA is mandatory; PostHog or a privacy-first alternative may be preferable

## Error monitoring

### Sentry

Decision status:

- preferred

Expected role:

- error tracking
- performance tracing where useful

Why it fits:

- strong debugging and observability value

Open validations:

- exact privacy configuration
- safe metadata policy

## Logging and uptime

### BetterStack

Decision status:

- preferred

Expected role:

- log aggregation
- uptime monitoring
- alerting

Why it fits:

- operationally useful complement to Sentry

Open validations:

- final structured logging architecture
- log retention and sensitive-data filtering policy

## Rate limiting, Redis, and scheduling helpers

### Upstash

Decision status:

- preferred for supporting infrastructure

Expected role:

- Redis-backed rate limiting and ephemeral coordination
- queue/scheduling support where needed

Why it fits:

- good fit for serverless-friendly support services

Open validations:

- exact split between Upstash and durable workflow orchestration
- what must be durable versus ephemeral

## AI abstraction

### Vercel AI Gateway

Decision status:

- preferred

Expected role:

- model routing abstraction
- provider flexibility
- centralized AI access layer

Why it fits:

- reduces direct lock-in to one model provider
- aligns with the plan for `packages/ai`

Open validations:

- exact provider policy for sensitive workloads
- cost and fallback design

## Internationalization

### next-intl

Decision status:

- preferred

Expected role:

- localization routing and message handling

Why it fits:

- good Next.js App Router fit

Open validations:

- exact content/editorial localization workflow

## Content and docs

### Fumadocs

Decision status:

- preferred

Expected role:

- docs/help/content system

Why it fits:

- markdown-first workflow
- good docs/product handbook direction

Open validations:

- exact split between docs and marketing content
- whether a stronger CMS layer is needed later

## Summary

Current preferred stack:

- WorkOS
- Neon
- Drizzle
- Stripe
- Daily
- Resend
- PostHog
- Sentry
- BetterStack
- Upstash
- Vercel AI Gateway
- next-intl
- Fumadocs

Conditional/under review:

- Google Analytics

## Required Follow-Up Decisions

- final vendor-by-vendor residency and DPA review
- feature-flag ownership
- calendar OAuth ownership
- workflow orchestration ownership
- exact logging and redaction policy

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`compliance-data-governance.md`](./compliance-data-governance.md)
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
