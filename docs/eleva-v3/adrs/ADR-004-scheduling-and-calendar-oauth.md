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

### Option A — WorkOS Pipes for calendar

- Pros: less code
- Cons: unvalidated for Eleva's booking-critical flow; couples correctness to vendor; token refresh and webhook behavior not transparent

### Option B — Eleva-owned OAuth (chosen)

- Pros: full control over token refresh, idempotent event creation with client-supplied IDs, 409 fallback, explicit webhook handling
- Cons: more code, but well-understood patterns (cal.com pattern documented)

## Consequences

- Booking flow can guarantee no double-write to destination calendar (idempotent event creation with client-supplied ID + 409 fallback).
- Expert experience: can pick which calendars are "busy sources" vs the "destination calendar" where confirmed events land.
- Token expiration self-heals via `calendarTokenRefresh` workflow; if refresh fails the expert is notified (`calendar_disconnected` Lane 1 notification).
- Supports round-robin / collective / clinic scheduling in phase 2 without rewrite.
