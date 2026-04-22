# ADR-006: Notifications — Two-Lane Architecture

## Status

Accepted

## Date

2026-04-22

## Context

Eleva needs reliable transactional notifications (booking confirmed, payment failed, payout sent, report available) AND marketing/lifecycle communication (welcome series, re-engagement, pack-expiry nurture). These two workloads have different:

- PHI exposure (transactional can carry patient/session context by secure link; marketing must not)
- orchestration needs (transactional is state-coupled + retries; marketing is drip + wait)
- editor audience (engineers ship transactional code; marketing tweaks drip copy)
- cost structure (transactional volume is bounded; marketing can blast large cohorts)

The MVP uses Novu. Novu is complex to manage without prior experience, couples the inbox UI to their SDK, and forces multi-channel orchestration through their DSL when we already have Vercel Workflows DevKit.

Knock is a cleaner SaaS alternative but would duplicate orchestration we already own and add a new subprocessor for PHI.

Resend now ships **Resend Automations** (triggers, delays, conditions, wait-for-event, send-email steps) which is a strong fit for marketing-only drip campaigns without leaving the Resend product.

## Decision

**Two lanes, both owned by `packages/notifications`, Novu retired.**

### Lane 1 — Transactional (code-driven, multi-channel)

- Orchestrated by **Vercel Workflows DevKit**
- Sends through **Resend** (email) + **Twilio EU** (SMS) + **Neon-backed in-app inbox** + Expo push (mobile later)
- Single entrypoint `sendNotification({ kind, userId, ctx, idempotencyKey })`
- PHI-aware; uses secure signed links for sensitive content; templates reviewed for PHI exposure

### Lane 2 — Marketing lifecycle (Resend Automations, email-only)

- Orchestrated inside **Resend Automations**
- Triggered via `resend.events.send` from the app
- Single entrypoint `triggerAutomation({ event, userId, marketingPayload })`
- **PHI-free payloads** enforced by schema (allowlist: first_name, locale, plan_tier, generic_booking_count)
- Consent-gated: checks `marketing_consent = true` before calling Resend
- Neon → Resend one-way contact sync

### Boundaries

- CI rule: no direct `resend` / `twilio` / `expo-server-sdk` imports outside `packages/notifications`
- Novu is retired — all trigger sites migrated

## Alternatives Considered

### Option A — Keep Novu

- Pros: already in MVP; handles orchestration
- Cons: user-reported complexity; inbox UI lock-in; EU residency weak on cheap tiers; orchestration duplicates Vercel Workflows

### Option B — Switch to Knock

- Pros: better DX than Novu
- Cons: pays twice for orchestration already in Workflows; new subprocessor for PHI (DPA + data-flow complexity); free tier (10k/mo) insufficient once reminders ramp up

### Option C — Resend only (no in-app, no SMS)

- Pros: simplest
- Cons: inbox is a first-class product feature; SMS required for 24h reminder; diary-based engagement needs push later

### Option D — Two-lane with Vercel Workflows + Resend + Twilio + Neon + Resend Automations (chosen)

- Pros: no duplicate orchestration; clean PHI boundary; free data ownership (Neon inbox); marketing editable by non-engineers in Resend UI; no new DPA subprocessor
- Cons: requires careful discipline — both lanes in one package with CI enforcement

## Consequences

- `packages/notifications` exports two entrypoints (`sendNotification`, `triggerAutomation`) plus mocking helpers
- Transactional flows use `idempotencyKey` keyed on domain IDs (`booking_id`, `event_id`, `stripe_event_id`)
- Marketing payloads strictly schema-validated; any attempt to leak PHI fails build
- Marketing consent revocation auto-deletes Resend contact
- Lane 1 Reminder workflows use Vercel Workflows `waitFor` for 24h/1h; Lane 2 uses Resend Automation delays
- Novu infrastructure is decommissioned after migration
