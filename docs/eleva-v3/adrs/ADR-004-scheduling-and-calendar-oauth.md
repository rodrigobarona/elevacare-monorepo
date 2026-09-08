# ADR-004: Scheduling Model + Calendar OAuth

> **Superseded in part by [ADR-017](ADR-017-better-auth-identity.md) / [ADR-018](ADR-018-daily-video-only.md) / [ADR-020](ADR-020-envelope-encryption.md) (2026-09-07).**
> The cal.com-inspired scheduling model (event types, schedules, busy vs destination, online /
> in-person / phone) stands. Credential transport is Better Auth
> `account` rows (`auth.api.getAccessToken` via `@eleva/auth`). Google Meet as an online
> session destination is dropped (Daily only). Token encryption is Better Auth's
> `account.encryptOAuthTokens`. WorkOS Pipes / Vault / AuthKit (removed, see ADR-017).

## Status

Amended (2026-05); superseded in part (2026-09-07)

## Date

2026-04-22 (original), 2026-05-05 (amended), 2026-09-07 (credential transport)

## Context

Eleva needs a scheduling engine inspired by cal.com's mental model (multiple calendar connections per expert, busy vs destination calendar split, per-event buffers, booking windows, notice, modes) plus a first-class in-person / phone / online distinction that cal.com doesn't strongly model.

We also need Google and Microsoft calendar OAuth. A 2026-05 amendment briefly chose WorkOS Pipes for credential transport. That vendor path is retired (removed, see ADR-017). Tokens now live on Better Auth `account` rows.

## Decision

**Scheduling engine** (unchanged):

- `packages/scheduling` owns event types, schedules, availability rules, blocked dates, slot computation, reservation logic (Redis-backed atomic `reserveSlot`).
- Session modes: `online`, `in_person` (with explicit address/location object and localized display text), `phone`.
- Per-event language, per-event country-license scope, optional worldwide-mode flag for coaching/chat sessions that aren't clinic-bound.
- Multiple calendar connections per expert, separate "busy" vs "destination" calendar selection.

**Calendar OAuth** (current — Better Auth `account` rows, ADR-017):

- Experts connect Google Calendar and Microsoft Outlook Calendar through Better Auth `linkSocial` with calendar scopes. Tokens are stored on `auth.account` with `encryptOAuthTokens: true`.
- **`packages/calendar`** owns the `CalendarAdapter` interface for direct Google Calendar and Microsoft Graph API calls (listCalendars, getFreeBusy, createEvent, updateEvent, deleteEvent). Adapters receive an access token from `@eleva/auth` (`auth.api.getAccessToken` / `getProviderAccessToken`) and make API calls directly.
- `getCalendarToken({ userId, accountId })` is the single entry point. `accountId` is the Better Auth `account.id` persisted on the calendar connection (required when an expert has more than one Google or Microsoft account). A `needs_reauthorization` error is surfaced to the expert when refresh fails.
- Online session destination is Daily only (ADR-018). Google Meet is not a destination.

**Identity vs calendar OAuth**:

- **Identity** (all users): Better Auth social login / magic link / passkey. Google social login is available for members and experts.
- **Calendar OAuth** (experts, opt-in): the same Better Auth `account` table with extra calendar scopes. Connecting a calendar is independent of how the expert signed in.

## Historical note (2026-05 WorkOS Pipes amendment)

The 2026-05 amendment replaced an unfinished Eleva-owned OAuth callback stack with WorkOS Pipes (removed, see ADR-017). That choice is no longer current. The six API-usage concerns it listed still apply to Better Auth tokens: Eleva still calls Graph/Google directly for idempotent event creation, multi-calendar selection, freebusy, Pub/Sub webhooks, and `needs_reauthorization` surfacing.

## Alternatives Considered

### Option A — Eleva-owned standalone OAuth (original, incomplete)

- Pros: full control over token refresh, direct debugging
- Cons: custom CSRF, callback routes, and refresh scheduling; the original implementation never shipped a callback

### Option B — WorkOS Pipes (2026-05 amendment, retired)

- Pros: managed connect widget and refresh
- Cons: vendor on the identity critical path; incompatible with ADR-017. Removed, see ADR-017.

### Option C — Better Auth `account` rows (current)

- Pros: one identity store, EU Neon residency, `encryptOAuthTokens`, `getAccessToken` refresh, no second OAuth product
- Cons: Eleva owns connect UX and reauthorization messaging (accepted)

## Scope Note

- **Better Auth scope**: OAuth connect, store, refresh, revoke for Google Calendar and Microsoft Outlook Calendar on `account` rows.
- **Eleva scope**: CalendarAdapter interface, direct API calls, busy/destination calendar model, idempotent event creation, webhook handling, freebusy queries.
- Directory sync / SCIM are separate decisions and are not calendar OAuth.

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

- Booking flow guarantees no double-write to destination calendar (idempotent event creation with client-supplied ID + 409 fallback) — this is an adapter-level concern.
- Expert experience: connects calendar via Better Auth, then picks busy sources and destination calendar in Eleva's post-connect setup flow. If they skip this step, they receive `.ics` emails instead.
- Token expiration self-heals via Better Auth refresh. If refresh fails, `getCalendarToken` throws `CalendarTokenError("needs_reauthorization")` which is surfaced to the expert.
- Disconnect must revoke the provider grant through Better Auth (`auth.api.unlinkAccount` or equivalent) and delete Eleva `calendar_*` rows — see tech-debt item 12.
- Supports round-robin / collective / clinic scheduling in later phases without rewrite.
- Calendar-optional mode requires no DB schema changes — the existing schema supports it implicitly.
