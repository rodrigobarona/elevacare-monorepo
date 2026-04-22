# Calendar Creation Idempotency

> **Added**: January 2026  
> **Related**: Stripe webhook handlers, Google Calendar integration

## Overview

When a payment succeeds via Stripe webhooks, we create a Google Calendar event for the expert. However, Stripe may retry webhooks multiple times, and network issues can cause duplicate processing. This document explains the idempotency mechanism that prevents duplicate calendar events.

## Problem Statement

Before this implementation:
1. Stripe sends `payment_intent.succeeded` webhook
2. Handler creates Google Calendar event
3. If webhook times out or Stripe retries, the same event could be created multiple times
4. Experts would see duplicate appointments on their calendars

## Solution: Database-Level Idempotency

We use a `calendarCreationClaimed` boolean field in the `meetings` table to implement a claim-based idempotency pattern.

### Schema Change

```typescript
// drizzle/schema.ts - MeetingsTable
calendarCreationClaimed: boolean('calendar_creation_claimed')
  .default(false)
  .notNull(),
```

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Webhook Request #1                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Receive payment_intent.succeeded                         │
│ 2. Query meeting WHERE calendarCreationClaimed = false      │
│ 3. UPDATE meeting SET calendarCreationClaimed = true        │
│    (Atomic claim - returns updated row)                     │
│ 4. If claim successful → Create calendar event              │
│ 5. If calendar creation fails → Release claim               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Webhook Request #2 (Retry)               │
├─────────────────────────────────────────────────────────────┤
│ 1. Receive payment_intent.succeeded (same event)            │
│ 2. Query meeting WHERE calendarCreationClaimed = false      │
│ 3. Returns empty (already claimed)                          │
│ 4. Skip calendar creation → Return success                  │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

Location: `src/app/api/webhooks/stripe/handlers/payment.ts`

```typescript
// Claim the meeting for calendar creation (atomic operation)
const [claimedMeeting] = await db
  .update(MeetingsTable)
  .set({ calendarCreationClaimed: true })
  .where(
    and(
      eq(MeetingsTable.stripePaymentIntentId, paymentIntentId),
      eq(MeetingsTable.calendarCreationClaimed, false) // Only if not already claimed
    )
  )
  .returning();

if (!claimedMeeting) {
  // Already processed by another webhook instance
  console.log('Calendar event already created for this meeting');
  return;
}

try {
  // Create Google Calendar event
  await createCalendarEvent(claimedMeeting);
} catch (error) {
  // Release claim on failure so retry can attempt again
  await releaseClaim(claimedMeeting.id);
  throw error;
}
```

### Release Claim Function

If calendar creation fails, we release the claim to allow retries:

```typescript
async function releaseClaim(meetingId: string): Promise<void> {
  await db
    .update(MeetingsTable)
    .set({ calendarCreationClaimed: false })
    .where(eq(MeetingsTable.id, meetingId));
}
```

## Key Benefits

1. **No Duplicate Events**: Only one webhook instance can claim and create the calendar event
2. **Retry-Safe**: Failed attempts release the claim, allowing future retries
3. **Race Condition Proof**: Database-level atomicity prevents concurrent claims
4. **Auditable**: The `calendarCreationClaimed` field provides visibility into processing state

## Migration

```sql
-- Migration: 0019_calendar_creation_idempotency.sql
ALTER TABLE "meetings" ADD COLUMN "calendar_creation_claimed" boolean DEFAULT false NOT NULL;
```

## Related Files

- `src/app/api/webhooks/stripe/handlers/payment.ts` - Main implementation
- `drizzle/schema.ts` - Schema definition
- `src/lib/google-calendar.ts` - Calendar event creation

## Troubleshooting

### Calendar Event Not Created
1. Check if `calendarCreationClaimed` is `true` for the meeting
2. If `true` but no event exists, manually reset to `false` and reprocess

### Duplicate Events Still Appearing
1. Verify the migration was applied
2. Check for race conditions in the webhook handler
3. Review Stripe webhook retry settings

## See Also

- [Stripe Webhook Integration](./02-stripe-integration.md)
- [Payment Flow Analysis](./01-payment-flow-analysis.md)
