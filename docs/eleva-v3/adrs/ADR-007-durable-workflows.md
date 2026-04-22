# ADR-007: Durable Workflow Orchestration — Vercel Workflows DevKit

## Status

Accepted

## Date

2026-04-22

## Context

Eleva has many async flows that must survive crashes, retries, and multi-hour waits: booking confirmation, pre-appointment reminders, payment→entitlement→finalize, payout approval, transcript→AI→review, platform-fee invoice issuance, expert-side invoice issuance, DSAR export, Vault crypto-shredding.

These are not cron jobs. They are durable step graphs with idempotency requirements, retry policy, and observability needs.

The MVP uses QStash + ad hoc cron routes. This works for simple flows but struggles with multi-step graphs that need to resume after partial failure.

## Decision

- **Vercel Workflows DevKit** is the durable orchestration runtime for all multi-step async flows.
- **Upstash QStash** is scoped to periodic cron only (drift checks, nightly digests, monthly reconciliation).
- **Upstash Redis** handles ephemeral coordination (slot reservation, rate-limit locks, short-lived caches).

`packages/workflows` provides shared step primitives, typed context, correlation-ID propagation, and common retry/idempotency helpers. Domain workflows (booking, payments, accounting, AI) define their step graphs in their owning domain package.

## Alternatives Considered

### Option A — QStash + cron routes for everything

- Pros: already in MVP
- Cons: no durable state machine; partial failure means manual intervention; idempotency is per-handler convention; retries are HTTP retries (blunt)

### Option B — Temporal

- Pros: best-in-class durable workflow engine
- Cons: self-host or Temporal Cloud = new infrastructure + skill set; overkill for Eleva scale

### Option C — Inngest

- Pros: TS-native, good DX
- Cons: another subprocessor; couples Eleva to a product category Vercel is actively building (risk of overlap / churn)

### Option D — Vercel Workflows DevKit (chosen)

- Pros: first-party on the platform we already deploy to; no new subprocessor; step-based model with retries, idempotency, waitFor, and observability; good TypeScript DX
- Cons: newer product; we'll be partially adopting as the product matures

## Consequences

- Every important async flow has an explicit workflow definition; no more bare cron handlers for correctness-critical flows
- Idempotency keys are first-class on each step (`booking_id`, `event_id`, `stripe_event_id`, `subscription_period`)
- Correlation IDs propagate via `AsyncLocalStorage` through steps to Sentry, BetterStack, audit rows, Resend/Twilio metadata
- Dead-letter path surfaces to `/admin/workflows` for admin review and manual retry
- QStash shrinks to a small set of true cron use cases
- Heartbeats from long-running workflows feed BetterStack uptime page
