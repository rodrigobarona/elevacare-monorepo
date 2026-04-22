# Eleva.care v3 Workflow Orchestration Spec

Status: Authoritative

## Purpose

This document defines how Eleva.care v3 models workflows, jobs, retries, and durable orchestration.

It should guide:

- background job design
- webhook handling
- retries and idempotency
- scheduling of reminders and follow-ups
- operational ownership of async flows

## Runtime Decision

- **Durable orchestration**: **Vercel Workflows DevKit**
- **Periodic cron (drift checks, nightly digests, monthly reconciliation)**: **Upstash QStash**
- **Ephemeral coordination (slot reservation, rate-limit locks, short-lived caches)**: **Upstash Redis**

There is no ad hoc cron route for core product correctness. Anything that must survive crashes, retries, or multi-hour waits runs in Vercel Workflows DevKit.

## Workflow Principles

- Every important async flow is explicitly modeled as a workflow.
- Webhook intake and business processing are separable (thin webhook → workflow → domain logic).
- Idempotency is mandatory for financial, scheduling, notification, and invoicing flows.
- Each step has explicit idempotency keys, observability hooks, and retry policy.

## Workflow Categories

### Booking workflows

- `slotReservationExpiry` — Redis-backed reservation TTL; durable finalize step on timeout
- `bookingConfirmation` — post-payment: confirm booking + fan out Lane 1 notifications + create calendar events
- `preAppointmentReminders` — 24h + 1h reminder fan-out with quiet-hour + preference gating
- `postSessionFollowup` — session_completed → trigger report_available path + review request (after AI flow completes)
- `bookingRescheduleSideEffects`
- `bookingCancellationSideEffects`

### Payment workflows

- `paymentSucceeded` — `payment_intent.succeeded` → validate → booking finalize → entitlement write → fan-out notifications → audit
- `paymentFailed` — `payment_intent.payment_failed` → expire reservation → notify customer → mark booking `payment_failed`
- `refundIssued` — `charge.refunded` → reconcile booking state → notify + audit
- `disputeCreated` — `charge.dispute.created` → admin alert + freeze payout + audit
- `payoutEligibility` — booking `settled` → compute `application_fee_breakdown` → fan out:
  - `issuePlatformFeeInvoice` (TOConline Tier 1, solo experts only)
  - `issueExpertServiceInvoice` (Tier 2 adapter if connected)
- `payoutApproval` — policy gate + admin action → Stripe Transfer
- `payoutTransfer` — `transfer.created` → `payout.paid` → notify expert + audit

### Subscription workflows

- `expertTopExpertLifecycle` — `customer.subscription.*` → toggle commission tier via Stripe Entitlements
- `clinicSubscriptionLifecycle` — `customer.subscription.*` for clinic SaaS tiers → seat sync, overage enforcement, payment-failed grace
- `issueClinicSaasInvoice` — monthly trigger at subscription period boundary → TOConline `ELEVA-SAAS-{YYYY}` series

### Accounting workflows

- `issuePlatformFeeInvoice` — per-booking Tier 1 (solo expert commission)
- `issueClinicSaasInvoice` — per-period Tier 1 (clinic SaaS)
- `issueExpertServiceInvoice` — Tier 2 adapter invocation per booking
- `expertInvoiceRetry` — DLQ for Tier 2 failures
- `stripeToConlineReconciliation` — **QStash periodic (monthly)**: aggregate Stripe fees vs TOConline invoices per expert/clinic; flag mismatches to `/admin/accounting`

### Calendar workflows

- `calendarEventCreate` — idempotent Google/Microsoft event write with client-supplied ID + 409 fallback
- `calendarEventUpdate` / `calendarEventDelete`
- `calendarTokenRefresh` — on 401 from provider; re-auth expert if refresh fails
- `calendarSyncReconciliation` — Pub/Sub subscription for external changes; cache invalidation

### Communication workflows

- `sendNotification` (Lane 1 entrypoint)
- `sendScheduledReminder`
- `scheduledDigest` — **QStash periodic** for admin digest emails

### Media and AI workflows

- `transcriptReady` — Daily transcript webhook → store Eleva record (encrypted via Vault) → enqueue draft
- `aiReportDraft` — AI Gateway call → draft stored as `report.status = 'draft'` → notify expert for review
- `aiReportPublication` — expert approves → `report.status = 'published'` → `report_available` notification

### Admin / compliance workflows

- `dsarExport` — export all user data → upload to Vercel Blob → time-limited signed URL → notify admin
- `softDeleteScrubber` — 30-day retention enforcement
- `vaultCryptoShredder` — org deletion → crypto-shred all Vault references → verify via integration test
- `ersAuditExport` — periodic ERS-required export (if applicable)
- `rbacDriftCheck` — **QStash periodic**: verify WorkOS roles match `infra/workos/rbac-config.json`

### Mobile workflows (when mobile ships)

- `diaryShareCreate` — patient grants sharing permission → expert notification + visibility activation
- `diaryShareRevoke` — revoke visibility, audit
- `diaryDigestToExpert` — scheduled summary (opt-in)

## Recommended Workflow Shape

Each workflow follows this layered model:

1. **Trigger ingestion** — webhook route, internal event, or scheduled QStash poke
2. **Authenticity + replay check** — signature verify (Stripe/Daily), `stripe_event_log` idempotency check
3. **Idempotent domain processing** — compute state transitions
4. **Fan-out to downstream steps** — notifications, invoices, calendar, AI, etc.
5. **Observability** — Sentry tags, BetterStack heartbeat, audit row

## Trigger Sources

- internal product actions
- **Stripe webhooks** (single endpoint `/api/stripe/webhook`, dispatch by `event.type`)
- **Daily webhooks** (room ended, transcript ready)
- **Resend webhooks** (Lane 2 automation runs, delivery events)
- scheduled reminders (durable `waitFor` inside workflow)
- admin actions
- mobile sync/share actions
- QStash periodic cron

## Idempotency Rules

The following flows **must** be idempotent:

- all Stripe webhook events (keyed on `event.id` via `stripe_event_log`)
- booking confirmation creation
- reminder scheduling
- platform-fee invoice issuance (keyed on `booking_id`)
- clinic SaaS invoice issuance (keyed on `subscription_period`)
- expert service invoice issuance (keyed on `booking_id + expert_id`)
- transcript ingestion
- AI generation triggers
- payout transfer handling

## Retry Rules

- automatic retries for transient failures (HTTP 5xx, timeout, network)
- exponential backoff with jitter
- bounded attempt count per step
- non-retryable validation / policy errors surface to admin DLQ
- Stripe webhook retries are Stripe's responsibility (24h exponential); we only ACK idempotently

## Scheduling vs Durability

Use **Upstash Redis**:

- short-lived slot reservation (TTL-based)
- rate-limit windows (sliding/fixed)
- distributed locks (`withLock`)
- short-lived caches (Stripe Customer cache, WorkOS user cache)

Use **Upstash QStash**:

- `stripeToConlineReconciliation` (monthly)
- `rbacDriftCheck` (daily)
- `softDeleteScrubber` (daily)
- `scheduledDigest` (daily/weekly per audience)

Use **Vercel Workflows DevKit** for everything else.

## High-Risk Workflows To Model First

Priority order for M4–M5:

1. `paymentSucceeded` → booking finalize
2. `slotReservationExpiry` + `bookingConfirmation`
3. `preAppointmentReminders` (24h + 1h)
4. `payoutEligibility` → `issuePlatformFeeInvoice`
5. `transcriptReady` → `aiReportDraft`
6. `clinicSubscriptionLifecycle` → `issueClinicSaasInvoice`
7. `issueExpertServiceInvoice` (adapter dispatch)
8. `dsarExport`
9. `vaultCryptoShredder`

## Operational Visibility

Every important workflow exposes:

- current status (`running | completed | failed | cancelled | deadletter`)
- last failure (reason + timestamp)
- retry count per step
- correlation IDs
- linked domain objects (booking, invoice, payout, etc.)

Surfaced via `/admin/workflows` UI (dead-letter review, manual retry, cancel).

## Separation Of Concerns

Never mix in one handler:

- webhook signature verification
- domain mutation
- downstream notification fan-out
- analytics side effects

Instead:

- the webhook route only verifies + acks + writes `stripe_event_log` + dispatches the workflow
- the workflow owns domain mutation + fan-out + retries

## Correlation And Observability

- correlation ID generated at webhook intake (or internal action entry)
- propagated via `AsyncLocalStorage` through every step
- attached to Sentry tags, BetterStack logs, audit rows, Resend + Twilio metadata
- admin can filter `/admin/audit` and `/admin/workflows` by correlation ID

## Related Docs

- [`notifications-spec.md`](./notifications-spec.md)
- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`adrs/README.md`](./adrs/README.md) (ADR-007 Durable Workflows)
