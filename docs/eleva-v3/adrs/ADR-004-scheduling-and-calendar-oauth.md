# ADR-004: Scheduling Model + Calendar OAuth via WorkOS Pipes

## Status

Amended (2026-05)

## Date

2026-04-22 (original), 2026-05-05 (amended)

## Context

Eleva needs a scheduling engine inspired by cal.com's mental model (multiple calendar connections per expert, busy vs destination calendar split, per-event buffers, booking windows, notice, modes) plus a first-class in-person / phone / online distinction that cal.com doesn't strongly model.

We also need Google and Microsoft calendar OAuth. The original decision rejected WorkOS Pipes, characterizing it as a "higher-level sync abstraction." This was incorrect — Pipes is an OAuth credential management service that handles connect flows, token storage, and automatic token refresh, returning fresh access tokens on demand. It does not sync data, make API calls, or abstract provider APIs.

## Decision

**Scheduling engine** (unchanged):

- `packages/scheduling` owns event types, schedules, availability rules, blocked dates, slot computation, reservation logic (Redis-backed atomic `reserveSlot`).
- Session modes: `online`, `in_person` (with explicit address/location object and localized display text), `phone`.
- Per-event language, per-event country-license scope, optional worldwide-mode flag for coaching/chat sessions that aren't clinic-bound.
- Multiple calendar connections per expert, separate "busy" vs "destination" calendar selection.

**Calendar OAuth** (amended — now uses WorkOS Pipes for credential management):

- **WorkOS Pipes** manages the OAuth connect flow, token storage, token refresh, and token revocation for Google Calendar and Microsoft Outlook Calendar. Experts connect via the Pipes widget in the Eleva UI.
- **`packages/calendar`** owns the `CalendarAdapter` interface for direct Google Calendar and Microsoft Graph API calls (listCalendars, getFreeBusy, createEvent, updateEvent, deleteEvent). These adapters receive an access token from Pipes and make API calls directly — they do not use any Pipes sync or abstraction layer.
- `getCalendarToken(workosUserId, provider)` wraps `workos.pipes.getAccessToken()` and is the single entry point for obtaining calendar tokens.
- The `calendarTokenRefresh` background workflow is deleted — Pipes handles refresh automatically.

**Separation of concerns: AuthKit vs Pipes**:

- **AuthKit** (social login connectors): All users authenticate via WorkOS AuthKit. Google social login is available for all users (patients and experts). This is identity-level authentication.
- **Pipes** (calendar OAuth): Only experts who choose to connect their calendar use Pipes. This is an opt-in integration for scheduling features. The two systems are independent.

## Amendment Rationale (2026-05)

The original rejection of Pipes was based on six concerns. Re-evaluation shows all six are about **API usage patterns** that Pipes does not touch:

1. **Idempotent event creation**: Still call Graph/Google directly with client-supplied IDs and 409 fallback. Pipes only provides the token.
2. **Multi-calendar per expert**: Still call `listCalendars`, manage busy/destination selection in Eleva's database. Pipes doesn't model calendar selection.
3. **Real-time freebusy**: Still call `getSchedule`/`freebusy` directly with the Pipes-provided token. No sync interval involved.
4. **Token-expiry surfacing**: Pipes returns `{ error: "needs_reauthorization" }` — a clean, actionable signal that Eleva catches and surfaces to the expert.
5. **Pub/Sub webhooks**: Still set up directly with the Pipes-provided token. Pipes doesn't abstract webhooks.
6. **Vendor dependency**: WorkOS Vault was already on the critical path for every token operation. Pipes reduces vendor surface (one API call vs. encrypt/decrypt/refresh logic).

Additionally, the original Eleva-owned OAuth implementation was **incomplete**:

- `completeCalendarOAuth` was defined but never called — no callback route existed.
- `startCalendarOAuth` discarded the CSRF state token.
- The callback routes (`api.eleva.care/calendar/oauth/*/callback`) were not implemented.
- `calendarTokenRefresh` workflow had no cron/scheduler wired up.

Pipes replaces all of this unfinished plumbing with a production-ready, managed solution.

## Alternatives Considered

### Option A — Eleva-owned OAuth (original decision, now superseded)

- Pros: full control over token refresh, direct debugging
- Cons: significant implementation effort (~3-4 days estimated, actual implementation was incomplete after sprint 3), ongoing maintenance of OAuth plumbing, CSRF protection, callback routes, and token refresh scheduling

### Option B — WorkOS Pipes for credential management (current decision)

- Pros: production-ready OAuth flows with zero custom plumbing, automatic token refresh, secure token storage, connect/disconnect widget, Eleva retains full control over API calls via CalendarAdapter interface
- Cons: vendor dependency for token management (acceptable — WorkOS is already on the identity critical path)

## Scope Note

- **Pipes scope**: OAuth credential management only (connect, store, refresh, revoke tokens for Google Calendar and Microsoft Outlook Calendar).
- **Eleva scope**: CalendarAdapter interface, direct API calls, busy/destination calendar model, idempotent event creation, webhook handling, freebusy queries.
- WorkOS Pipes may also be used for future integrations (SCIM provisioning, directory sync) but those are separate decisions.

## Calendar-Optional Mode (2026-05-06)

Calendar connection is **optional**. Experts can use Eleva scheduling without connecting any external calendar:

- **Schedule management**: Experts define availability via `schedules`, `availability_rules`, and `date_overrides` in Eleva's database. This works identically with or without a connected calendar.
- **Slot computation**: `packages/scheduling` computes available slots from internal data (schedule rules + existing bookings). External busy times from connected calendars are additive — zero `calendar_busy_sources` rows is a valid state.
- **Post-booking behavior**:
  - If a `calendar_destinations` row exists: write event to the provider calendar via `CalendarAdapter` (existing flow).
  - If no destination is configured: send an email with an `.ics` attachment (RFC 5545 `METHOD:REQUEST` or `METHOD:CANCEL`) plus schema.org `EventReservation` JSON-LD for Gmail rich cards.
- **Lifecycle coverage**: The `.ics` fallback applies to all booking lifecycle events — creation, reschedule (updated `.ics` with incremented `SEQUENCE`), and cancellation (`METHOD:CANCEL`).
- **Detection**: Implicit. No explicit toggle is needed; the absence of `calendar_destinations` rows triggers the email fallback. Experts see a status message in the calendars settings page.

This allows experts who prefer not to manage OAuth connections to still receive structured calendar invites they can manually add to any calendar app.

## Consequences

- Booking flow guarantees no double-write to destination calendar (idempotent event creation with client-supplied ID + 409 fallback) — this is an adapter-level concern, unaffected by Pipes.
- Expert experience: connects calendar via Pipes widget, then picks busy sources and destination calendar in Eleva's post-connect setup flow. If they skip this step, they receive `.ics` emails instead.
- Token expiration self-heals via Pipes' automatic refresh. If refresh fails, `getCalendarToken` throws `CalendarTokenError("needs_reauthorization")` which is surfaced to the expert.
- No cron/scheduler needed for token refresh — Pipes handles this automatically.
- Supports round-robin / collective / clinic scheduling in phase 2 without rewrite.
- Calendar-optional mode requires no DB schema changes — the existing schema supports it implicitly.
