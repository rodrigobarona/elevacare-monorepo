# Eleva.care v3 Notifications Spec

Status: Authoritative

## Purpose

This document defines the notification architecture for Eleva.care v3.

It should guide:

- email, SMS, in-app, and push messaging
- event-triggered lifecycle communication
- reminders and operational notifications
- marketing and CRM messaging
- preferences, consent, and channel ownership

## Notification Principles

- Notification intent must be modeled separately from channel delivery.
- Transactional (state-coupled, PHI-aware) and marketing (lifecycle, PHI-free) must be different lanes with different orchestration and different rules.
- All sends go through `packages/notifications` so vendor swaps are a single-file change.
- Sensitive data must never leak into vendor payloads that aren't strictly required for the send.
- Customer-facing and expert-facing notifications share a consistent event model.

## Two-Lane Architecture

```mermaid
flowchart TD
    domainEvent[DomainEvent booking session payment transcript] --> router[packages/notifications]

    subgraph lane1 [Lane 1 Transactional PHI-aware multi-channel]
      router --> vwf[Vercel Workflows DevKit]
      vwf --> resendTx[Resend transactional email]
      vwf --> twilio[Twilio EU SMS]
      vwf --> inbox[Neon in-app inbox]
      vwf --> expoPush[Expo push mobile later]
    end

    subgraph lane2 [Lane 2 Marketing lifecycle email only]
      router --> consent[marketing_consent gate]
      consent --> resendAuto[Resend Automations events.send]
      resendAuto --> resendAudience[Resend Audiences]
    end
```

### Lane 1 — Transactional (code-driven, multi-channel)

Orchestrated by Vercel Workflows DevKit. Sends through Resend email + Twilio EU SMS + Neon-backed in-app inbox + Expo push (mobile later).

**Entrypoint**:

```ts
sendNotification({
  kind,                 // typed event kind (see event catalog below)
  userId,               // Eleva user
  ctx,                  // typed per-kind context
  idempotencyKey        // e.g. `booking_confirmed:${booking_id}`
})
```

Responsibilities:

- resolve user preferences (`notification_preferences(user_id, kind, email, sms, in_app, push, quiet_hours_tz, quiet_hours)`)
- resolve locale + timezone
- render React Email template per channel
- fan out to enabled channels in order: in-app (always), email, SMS, push
- write inbox row in Neon
- propagate correlation ID to Sentry + audit log + Resend/Twilio metadata
- enforce idempotency: same `idempotencyKey` must not fan out twice

Workflow semantics:

- retries with exponential backoff
- dead-letter queue surfaced in `/admin/notifications`
- heartbeat to BetterStack for long-running reminder graphs

PHI rules (Lane 1):

- email/SMS bodies contain only minimum necessary context; session notes, transcripts, AI report bodies never appear
- links use session-aware signed URLs for sensitive resources
- templates reviewed for PHI exposure before shipping

### Lane 2 — Marketing lifecycle (Resend Automations, email-only)

Orchestrated inside Resend (dashboard or `resend.automations.create`); triggered by `resend.events.send({ event, contactId | email, payload })` from the app.

**Entrypoint**:

```ts
triggerAutomation({
  event,                // e.g. 'welcome.expert', 'pack.expiring'
  userId,               // Eleva user
  marketingPayload      // PHI-free: first_name, locale, plan_tier, generic_booking_count
})
```

Responsibilities:

- verify `marketing_consent = true` in Neon before calling Resend
- strip any PHI from the payload (schema-validated; strict whitelist)
- resolve Resend contact ID (upsert if needed via one-way sync)
- call `resend.events.send`
- log the trigger in audit stream

PHI rules (Lane 2):

- payload is **restricted to marketing-safe fields only**: first name, locale, product tier, generic booking count
- no patient data, no session data, no transcript content, no report content
- CI-enforced schema check on every `triggerAutomation` call

Managed Automations (seeded in Resend):

- `welcome.expert`
- `welcome.patient`
- `partner.approved`
- `pack.expiring` (14 days before pack expiry)
- `reengagement.90d` (no booking in 90 days)
- `abandoned_checkout`
- `newsletter.*` (broadcasts)

### Neon → Resend contact sync

One-way, consent-gated:

- trigger: `marketing_consent` toggles to `true` in Eleva
- action: upsert contact in Resend Audiences with marketing-safe fields
- no reverse sync — Neon is the source of truth
- on `marketing_consent = false`: delete contact from Resend and log the action

## Channel Strategy

### Email (Resend)

Lane 1:

- account activation
- booking confirmation + receipt
- reschedule/cancel confirmations
- reminders (24h, 1h)
- session completed + report available
- payment succeeded/failed
- payout eligible/approved/transferred
- calendar disconnected
- expert-side operational alerts

Lane 2:

- welcome series (expert, patient)
- Become-Partner onboarding sequence
- pack-expiry nurture
- re-engagement (90-day dormant)
- abandoned-checkout recovery
- newsletter/broadcast

### SMS (Twilio EU)

Lane 1 only, opt-in, quiet-hours respected:

- booking confirmation
- 24h pre-appointment reminder
- 1h pre-appointment reminder (optional per user)
- day-of session prompt
- cancellation
- payment failed (urgent)

Preference model requires explicit SMS consent per kind.

### In-app (Neon-backed inbox)

Lane 1 always fans out here (regardless of email/SMS preferences):

- all dashboard alerts
- expert follow-up tasks
- suggested appointments
- diary share notifications
- payout state changes
- admin action-required items

Schema: `notifications(id, user_id, org_id, kind, payload, link, read_at, created_at)`. Realtime via `pg_listen/notify` or short-poll.

### Push (Expo, mobile later)

Lane 1, when the Diary mobile app ships:

- appointment reminders
- diary completion reminders
- expert recommendation prompts
- report available

## Event Catalog (Lane 1)

Initial build supports at minimum:

- `account_activated`
- `booking_confirmed`
- `booking_payment_failed`
- `booking_rescheduled`
- `booking_cancelled`
- `reminder_24h`
- `reminder_1h`
- `session_completed`
- `report_available`
- `payout_eligible`
- `payout_approved`
- `payout_transferred`
- `payout_failed`
- `suggested_follow_up_created`
- `diary_share_visible_to_expert`
- `calendar_disconnected`
- `expert_kyc_required`
- `stripe_account_capability_changed`
- `clinic_seat_added`
- `clinic_seat_removed`
- `clinic_subscription_payment_failed`

**Not in Lane 1**: anything Multibanco-voucher-related (feature excluded).

## Preference Model

Table: `notification_preferences(user_id, kind, email, sms, in_app, push, quiet_hours_tz, quiet_hours_start, quiet_hours_end)`.

Rules:

- transactional notifications that are operationally required (payment_failed, stripe_account_capability_changed) cannot be turned off
- marketing preferences (`marketing_consent`) are a separate column on the user — not part of per-kind preferences
- SMS consent is explicit (opt-in) per-kind; default off
- quiet hours apply to SMS and push; email and in-app always deliver immediately
- preferences stored with timezone; quiet-hours evaluated in user's TZ

## Package Boundaries

Everything in `packages/notifications`. CI enforces:

- no direct `resend` imports outside this package
- no direct `twilio` imports outside this package
- no direct `expo-server-sdk` imports outside this package
- every call from the app goes through `sendNotification` or `triggerAutomation`

Testing:

- `packages/notifications/testing` exposes `mockSend`, `mockTrigger`, and recorded inbox helpers for integration tests
- Playwright tests assert inbox rows + Resend/Twilio mock calls match expectations

## Security And Compliance

- notifications never expose transcript content, session note bodies, AI report bodies, or uploaded documents by value — always by secure link
- links are signed, session-aware, expire on use or age
- logs redact body payloads where sensitive fields are present
- every send creates an audit row in `eleva_v3_audit` (actor, kind, channel, status)
- marketing sends logged separately with consent snapshot at send time

## Rollout And Feature Flags

- `ff.sms_enabled` — gate SMS channel globally (launch = on for PT)
- `ff.mbway_enabled` — payment-method cohort toggle (informs checkout copy, not notifications)
- `ff.ai_reports_beta` — gates `report_available` notifications for draft AI reports
- `ff.diary_share` — gates `diary_share_visible_to_expert`

## Open Questions

- whether experts can create custom reminder templates (likely phase 2 with moderation)
- Lane 2 broadcast cadence and segmentation — product call per launch campaign

## Related Docs

- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`crm-spec.md`](./crm-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`adrs/README.md`](./adrs/README.md) (ADR-006 Notifications Two-Lane)
