# Eleva.care v3 Workflow Orchestration Spec

Status: Living

## Purpose

This document defines how Eleva.care v3 should think about workflows, jobs, retries, and durable orchestration.

It should guide:

- background job design
- webhook handling
- retries and idempotency
- scheduling of reminders and follow-ups
- operational ownership of async flows

## Workflow Principles

- Every important async flow must be explicitly modeled.
- Webhook intake and business processing should be separable.
- Idempotency is mandatory for financial, scheduling, and notification flows.
- Durable workflows should be used where retries and long-running coordination matter.
- The team should not depend on ad hoc cron endpoints for core product correctness.

## Workflow Categories

### Booking workflows

Examples:

- slot reservation expiry
- booking confirmation
- booking reminder sequence
- reschedule and cancellation side effects

### Payment workflows

Examples:

- payment success handling
- refund handling
- payout eligibility updates
- payout approval/transfer coordination

### Communication workflows

Examples:

- transactional email send
- reminder scheduling
- lifecycle follow-up messaging

### Media and AI workflows

Examples:

- transcript ready handling
- AI draft generation
- report publication side effects

### Admin/compliance workflows

Examples:

- export generation
- retention enforcement
- audit-sensitive operational jobs

## Recommended Workflow Shape

Use a layered model:

1. trigger ingestion
2. validation/authenticity checks
3. idempotent domain processing
4. fan-out to downstream actions
5. observability and retry handling

## Trigger Types

Supported trigger sources may include:

- internal product actions
- Stripe webhooks
- Daily/transcript events
- scheduled reminders
- admin actions
- mobile sync/share actions

## Idempotency Rules

The following flows must be idempotent:

- payment success processing
- booking confirmation creation
- reminder scheduling
- transcript ingestion
- AI generation triggers where retried
- payout transfer handling

## Retry Rules

Retries should be:

- automatic for transient failures
- bounded and observable
- safe under repeated execution

The system should distinguish between:

- retryable operational failures
- non-retryable validation/policy failures

## Scheduling Versus Durability

Use lightweight scheduling tools only where they are appropriate.

Examples of lightweight needs:

- short-lived slot reservation expiry
- small deferred notifications

Use durable orchestration for:

- payment-related sequencing
- multi-step reminder pipelines
- transcript -> AI -> review workflows
- export and retention flows

## Suggested High-Risk Workflows To Model First

- booking confirmation
- reminder scheduling
- payment success -> entitlement -> booking finalization
- payout eligibility -> approval -> transfer
- transcript ready -> AI draft -> review notification

## Operational Visibility

Each important workflow should expose:

- current status
- last failure
- retry count
- correlation ids
- linked domain objects

## Separation Of Concerns

Avoid mixing these in one handler:

- webhook verification
- domain mutation
- downstream notification fan-out
- analytics side effects

Instead, keep handlers thin and orchestrate through explicit workflow steps.

## Open Questions

- exact durable workflow runtime choice
- which workflows stay in `apps/api` versus move to `apps/jobs`
- first version of dead-letter/failure review tooling

## Related Docs

- [`notifications-spec.md`](./notifications-spec.md)
- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
