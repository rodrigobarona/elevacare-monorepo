# 07 — Scheduling, Booking & Calendar

> The booking funnel and Google Calendar integration are at the heart of the product. This chapter covers the slot algorithm, the Redis lock, race conditions hit in production, and the calendar-creation idempotency fix already validated on the `clerk-workos` branch.

## What we built

### Availability model

- Each expert has **one** `schedules` row with a `timezone`.
- `schedule_availabilities` rows define recurring weekly windows: `dayOfWeek` × `startTime` × `endTime`.
- `blocked_dates` rows define one-off vacation/holiday overrides.
- The expert's connected Google Calendar provides additional **busy** times.

### Slot algorithm — `getValidTimesFromSchedule`

Function: [server/getValidTimesFromSchedule.ts](../../server/getValidTimesFromSchedule.ts) (a.k.a. similar paths). Tested at [tests/api/getValidTimesFromSchedule.test.ts](../../tests/api/getValidTimesFromSchedule.test.ts).

Inputs:

- Event (duration, owner).
- Date range (typically next 30–60 days).
- Patient timezone.

Output:

- Array of valid slot start datetimes in the patient's timezone.

Algorithm sketch:

1. Translate the date range into the **expert's timezone**.
2. Expand the weekly schedule into concrete slot windows over the range.
3. Subtract `blocked_dates` ranges.
4. Subtract **existing meetings** (the meetings table is the source of truth for already-booked slots).
5. Subtract **Google Calendar busy times** for the expert's connected calendar.
6. Apply minimum-notice and maximum-lead-time policies.
7. Convert back to the patient's timezone for display.

### Slot reservation (Redis lock + DB row)

When the patient clicks "book" before completing payment, a short-lived **slot reservation** prevents a second patient from grabbing the same slot.

Two layers:

- **Redis `SET NX`** lock keyed `slot:{expertId}:{startISO}` with TTL ~10 minutes (extended to voucher TTL for Multibanco).
- **`slot_reservations`** DB row for visibility in queries and admin tools.

If the lock is acquired, the booking proceeds; otherwise return 409 Conflict.

**Known TOCTOU bug** documented in `AGENTS.md`: `FormCache` (Redis) has a race between `isProcessing` check and `set` — guard with atomic `SET NX` or a Lua script. Same pattern applies to slot reservations.

### Booking funnel

Public page → `MeetingForm` → `/api/create-payment-intent` → Stripe Checkout / PaymentIntent.

The canonical form is [components/features/forms/MeetingForm.tsx](../../components/features/forms/MeetingForm.tsx). A stale duplicate at `src/components/features/forms/MeetingForm.tsx` exists in some checkouts and **must not be edited** (per `AGENTS.md`).

### Google Calendar integration

Driver: [server/googleCalendar.ts](../../server/googleCalendar.ts). Token utilities: [server/utils/tokenUtils.ts](../../server/utils/tokenUtils.ts).

On payment success:

1. Decrypt the expert's Google refresh token (AES-256-GCM today; WorkOS Vault in v2).
2. Exchange for an access token.
3. Call `events.insert` with `conferenceData.createRequest` to auto-generate a Google Meet link.
4. Persist `meetings.calendarEventId` on the row.
5. Send confirmation emails (patient + expert) with the calendar invite attached.

### Pack redemption

When a patient buys a `session_pack`, a `pack_purchase` row is created. Each subsequent booking against the pack:

1. Checks `pack_purchase.remaining_sessions > 0`.
2. Skips Stripe payment (already paid at pack purchase).
3. Inserts a `meeting` row referencing the pack purchase.
4. Decrements `remaining_sessions`.

## Why

- **Per-expert single schedule + per-day availability rows** keeps the model trivially indexable.
- **Redis lock for slot holds** avoids double-booking without forcing optimistic-lock retries on every webhook.
- **Google Calendar as source of busy truth** lets experts use their existing personal/work calendar.
- **Auto-generated Meet link** avoids users having to set up conferencing.

## What worked

- The slot algorithm is well-tested (`tests/api/getValidTimesFromSchedule.test.ts`) and consistent.
- Redis lock prevents double-booking under typical concurrency.
- Pack redemption reuses 90% of the booking pipeline.
- Google Meet links eliminate "how do we connect?" support tickets.

## What didn't

| Issue                                           | Detail                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TOCTOU race on `FormCache`**                  | `isProcessing` check and `set` are not atomic. Documented in `AGENTS.md`. Same risk applies to slot reservation paths that don't use `SET NX`.     |
| **Duplicate Google Calendar events on retry**   | Stripe webhook retries triggered duplicate `events.insert` calls → patients got two invites for the same booking. Branch documents the fix.        |
| **Stale `MeetingForm` duplicate**               | `src/components/features/forms/MeetingForm.tsx` was edited by mistake more than once. `AGENTS.md` records this as a trap.                          |
| **Token refresh failures silent**               | Expired Google refresh tokens caused calendar-create to fail silently; meeting persisted without `calendarEventId` and no recovery path.            |
| **No "which calendar" picker**                  | Experts with multiple calendars couldn't choose where to write events (defaulted to primary). Branch's CAL-COM pattern fixes this.                 |
| **Patient timezone defaults trip on travel**    | If a patient books from a different timezone than their account default, conversion was sometimes off by an hour at DST boundaries.                |
| **Meet link sometimes missing**                 | `conferenceData.createRequest` occasionally returned without the link populated; needed a follow-up `events.patch`.                                |
| **`neon-http` no transactions**                 | Booking persistence (insert meeting + delete reservation + insert payment_transfer) is not atomic.                                                 |

## v2 prescription

### 1. Atomic slot reservation (lock + row in one shot)

```ts
// packages/scheduling/reserveSlot.ts
export async function reserveSlot(args: { eventId; startISO; orgId; ttlMs }) {
  const key = `slot:${args.orgId}:${args.eventId}:${args.startISO}`;
  const ok = await redis.set(key, args.lockId, { nx: true, px: args.ttlMs });
  if (!ok) return { reserved: false };
  await db.transaction(async (tx) => {
    await tx.insert(slotReservations).values({ /* ... */ });
  });
  return { reserved: true };
}
```

`@neondatabase/serverless` supports `db.transaction` in v2 — no more partial state.

### 2. Calendar-creation idempotency

Branch reference: `_docs/02-core-systems/payments/11-calendar-creation-idempotency.md`. Adopt-as-is.

Pattern:

1. **Idempotency key** derived from `payment_intent.id + meeting.id`.
2. Pass it to Google as the `events.insert` `requestBody.id` (Google accepts client-supplied IDs that match `[a-v0-9]{5,1024}`).
3. If the call returns `409 Conflict`, **fetch the existing event** and persist its ID on the meeting row.
4. Wrap both in `processStripeEvent()` so retries are safe.

```ts
// packages/scheduling/createCalendarEvent.ts
export async function createCalendarEventIdempotent(args: { meeting; expertOrg }) {
  const eventId = deriveCalendarEventId(args.meeting); // ≤ 1024 chars, [a-v0-9]
  try {
    const created = await calendar.events.insert({ requestBody: { id: eventId, /* ... */ } });
    return created.data.id!;
  } catch (err) {
    if (isConflict409(err)) {
      const existing = await calendar.events.get({ eventId });
      return existing.data.id!;
    }
    throw err;
  }
}
```

### 3. Calendar selection (Cal.com pattern)

Branch reference: `_docs/_WorkOS Vault implemenation/CAL-COM-CALENDAR-SELECTION.md`. After connecting Google Calendar:

- Fetch the expert's calendar list.
- Show a picker.
- Persist the chosen `calendar_id` on the expert org metadata.
- Default to `primary` if not chosen.
- All `events.insert` calls go to the chosen calendar.

### 4. Token storage in WorkOS Vault

Refresh tokens **never** live in app DB columns. They live in WorkOS Vault (org-scoped). See [17-encryption-and-vault.md](17-encryption-and-vault.md). The `users` table loses `googleAccessToken` and `googleRefreshToken`.

### 5. Token refresh self-healing

When `events.insert` returns `invalid_grant`, fire a Resend Automation `expert_calendar_disconnected` event. The expert receives an email with a "Reconnect Calendar" link. The meeting is not blocked from being persisted — just the calendar invite is queued for retry once tokens are restored.

### 6. Slot algorithm package

Move to `packages/scheduling`:

- `getValidTimes(args)` — pure function on inputs.
- `reserveSlot(args)` — atomic lock + row.
- `releaseSlot(reservationId)`.
- `createCalendarEventIdempotent(args)`.
- `cancelCalendarEvent(meetingId)`.

### 7. Patient timezone hygiene

- Detect timezone from browser at booking time (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Persist on `meetings.patientTimezone`.
- Always convert via `date-fns-tz` (never DIY offset math).
- DST boundary tests included in the package's test suite.

### 8. Pack redemption

- Same `reserveSlot` + `createCalendarEventIdempotent` path.
- Skip Stripe but still go through `packages/payments` to record an internal `meetings.payment_method = 'pack'` plus a zero-amount `payment_transfers` (for accounting completeness).
- Decrement `pack_purchases.remaining_sessions` in the same transaction.

### 9. Google Meet link guarantee

- After `events.insert`, if `hangoutLink` is empty, immediately patch with `events.patch` to add `conferenceDataVersion: 1` and a `createRequest`.
- Retry on transient errors (max 3 retries, 200ms backoff).
- Surface persistent failures via Sentry tag `meet:link-missing`.

### 10. Tests

- Vitest: slot algorithm (covers DST, timezone conversions, blocked dates, pack redemption).
- Vitest: idempotent calendar creation (mocked Google API; verify 409 path).
- Vitest: atomic slot reservation under concurrent calls (use `redis-mock` or local Redis).
- Playwright: full booking funnel happy-path + Multibanco voucher path (mocked Stripe webhooks).

## Concrete checklist for the new repo

- [ ] `packages/scheduling/getValidTimes.ts` is a pure, tested function.
- [ ] `packages/scheduling/reserveSlot.ts` uses atomic Redis `SET NX` + DB transaction.
- [ ] `packages/scheduling/createCalendarEventIdempotent.ts` uses client-supplied IDs and handles `409 Conflict`.
- [ ] No `googleAccessToken` / `googleRefreshToken` columns; all tokens via WorkOS Vault.
- [ ] Calendar selection picker in expert setup; persists chosen calendar_id on org metadata.
- [ ] `events.insert` retries with exponential backoff for transient errors.
- [ ] `hangoutLink` guaranteed by post-insert `events.patch` if missing.
- [ ] Patient timezone persisted on `meetings.patientTimezone`.
- [ ] DST and timezone-conversion tests pass.
- [ ] Pack redemption goes through the same atomic reservation path; zero-amount `payment_transfers` row inserted for accounting.
- [ ] Calendar-disconnect failure mode emits `expert_calendar_disconnected` Resend Automation event.
- [ ] Stale `src/components/features/forms/MeetingForm.tsx` does NOT exist in the new repo (the v2 src/ tree is the only canonical location).
- [ ] Vitest + Playwright suites cover booking happy path + Multibanco voucher.
