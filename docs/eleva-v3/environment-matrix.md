# Eleva.care v3 Environment Matrix

Status: Living

## Purpose

This document defines the intended environment model for Eleva.care v3.

It should help the team answer:

- which environments exist
- what each one is for
- how integrations differ by environment
- what data safety assumptions apply

## Principles

- Production and staging must be clearly separated.
- Preview or ephemeral environments should not be treated as production equivalents.
- Integration callbacks and secrets must be environment-specific.
- Sensitive-data behavior should be explicit per environment.

## Core Environments

### Local development

Purpose:

- individual development
- package/app integration
- local schema and workflow iteration

Characteristics:

- developer-owned
- may use sandbox/test providers
- should not require production secrets

### Staging

Purpose:

- integration verification
- QA
- launch rehearsal
- safe pre-production validation

Characteristics:

- shared team environment
- production-like config as much as practical
- test/sandbox provider accounts where appropriate

### Production

Purpose:

- live customer and expert usage

Characteristics:

- strict access controls
- production integrations
- full observability and operational readiness

## Preview Environments

If used, preview environments should be treated as:

- useful for UI and scoped feature review
- not necessarily full-fidelity integration environments

The team should document which integrations:

- are safe in previews
- are disabled in previews
- point to staging or sandbox targets

## Environment Concerns To Track

Each environment should clearly define:

- app URLs
- API URLs
- webhook callback targets
- auth redirect URLs
- calendar callback URLs
- email sending mode
- payment mode
- transcript/video mode
- analytics mode
- error monitoring/project routing

## Secrets And Config

Rules:

- do not share secrets across environments unless explicitly intended
- do not document raw secrets in handbook files
- keep environment-variable ownership clear

## Recommended Matrix Areas To Fill In Later

The team should later extend this doc with exact values for:

- `apps/web`
- `apps/app`
- `apps/api`
- `apps/docs`
- `apps/email`
- future `apps/diary-mobile`

and each major integration:

- WorkOS
- Stripe
- Daily
- Resend
- calendar providers
- PostHog
- Sentry
- BetterStack
- Upstash

## Related Docs

- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
