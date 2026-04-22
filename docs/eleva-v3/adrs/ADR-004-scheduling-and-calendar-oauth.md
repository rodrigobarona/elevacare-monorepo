# ADR-004: Scheduling Model + Eleva-Owned Calendar OAuth

## Status

Accepted

## Date

2026-04-22

## Context

Eleva needs a scheduling engine inspired by cal.com's mental model (multiple calendar connections per expert, busy vs destination calendar split, per-event buffers, booking windows, notice, modes) plus a first-class in-person / phone / online distinction that cal.com doesn't strongly model.

We also need Google and Microsoft calendar OAuth. WorkOS promotes "Pipes" for third-party data sync. Relying on WorkOS Pipes for calendar OAuth is tempting but couples Eleva's scheduling correctness to a vendor's sync product.

## Decision

**Scheduling engine**:

- `packages/scheduling` owns event types, schedules, availability rules, blocked dates, slot computation, reservation logic (Redis-backed atomic `reserveSlot`).
- Session modes: `online`, `in_person` (with explicit address/location object and localized display text), `phone`.
- Per-event language, per-event country-license scope, optional worldwide-mode flag for coaching/chat sessions that aren't clinic-bound.
- Multiple calendar connections per expert, separate "busy" vs "destination" calendar selection.

**Calendar OAuth**:

- `packages/calendar` owns Google + Microsoft OAuth flows, token refresh, event read/write, webhook/Pub-Sub subscription, external-change reconciliation.
- Tokens stored in WorkOS Vault via `packages/encryption`.
- **WorkOS Pipes is explicitly not used** for calendar sync.

## Alternatives Considered

### Option A — WorkOS Pipes for calendar sync

Tempting because WorkOS Pipes handles OAuth flows and token refresh, and we already use WorkOS for identity so the DPA is consolidated. Re-evaluated and rejected on these concrete grounds:

- **Idempotent event creation with client-supplied IDs + 409 fallback** — how cal.com and Eleva MVP prevent duplicate calendar events when a Stripe webhook retries. Needs direct Google Calendar / Microsoft Graph API access. Pipes presents a higher-level sync abstraction that we cannot guarantee exposes this.
- **Multi-calendar per expert is a product concept, not a sync concept** — cal.com pattern: expert picks which connected calendars are "busy sources" and which single calendar is the "destination". Pipes models generic sync, not this distinction. We would re-build it on top of Pipes anyway.
- **Real-time busy detection at slot-compute time** — when a patient opens the booking page, we query freebusy live with a short cache. Pipes runs on a sync interval — either over-queries (wasteful) or under-queries (shows slots that external calendars have already blocked).
- **Token-expiry surfacing** — on refresh failure we must fire a `calendar_disconnected` Lane 1 notification to the expert immediately. Pipes managing tokens opaquely breaks that signal chain.
- **Pub/Sub watch for external changes** — Google Calendar pushes change notifications when someone edits outside Eleva; we need these to invalidate our cache and re-notify the expert if the change affects a booking. Pipes abstracts this away.
- **Vendor dependency on the critical path** — if WorkOS changes Pipes behavior, Eleva's booking engine breaks. Owning the adapter means we absorb Google/Microsoft API churn ourselves, with debuggability.
- **Precedent** — cal.com and Eleva MVP both own calendar OAuth. Every scheduling competitor with OAuth owns the integration. It is the defensible, debuggable choice.

Trade-off accepted: ~3-4 days of OAuth plumbing + token-refresh code in Sprint 3, plus ongoing maintenance of the adapter. Pays back the first time a webhook retries or a token expires, because we can debug it and own the user-facing behavior.

### Option B — Eleva-owned OAuth (chosen)

- Pros: full control over token refresh, idempotent event creation with client-supplied IDs, 409 fallback, explicit webhook handling, real-time freebusy, first-class multi-calendar (busy vs destination) modeling, token-expiry events fire notifications, Pub/Sub cache invalidation
- Cons: more code, but well-understood patterns (cal.com pattern documented)

## Scope Note — Where WorkOS Pipes Is Still In Play

WorkOS Pipes remains a valid tool for Eleva on **identity-side integrations**:

- SCIM provisioning from enterprise clinics (phase 2)
- Directory sync for team-managed calendars (if ever needed)
- SSO federation

It is specifically rejected for the calendar data plane because calendar correctness is on the booking critical path and has product-shaped requirements a generic sync product does not model.

## Consequences

- Booking flow can guarantee no double-write to destination calendar (idempotent event creation with client-supplied ID + 409 fallback).
- Expert experience: can pick which calendars are "busy sources" vs the "destination calendar" where confirmed events land.
- Token expiration self-heals via `calendarTokenRefresh` workflow; if refresh fails the expert is notified (`calendar_disconnected` Lane 1 notification).
- Supports round-robin / collective / clinic scheduling in phase 2 without rewrite.
