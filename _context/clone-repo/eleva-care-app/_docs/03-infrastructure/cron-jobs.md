# Cron Jobs

> **Updated**: January 2026  
> **Scheduler**: Upstash QStash

## Overview

Eleva Care uses Upstash QStash for scheduled tasks. All cron jobs are serverless functions that run on Vercel with signature verification.

## Cron Job Registry

| Job | Schedule | Description |
|-----|----------|-------------|
| `appointment-reminders` | Every hour | 24-hour appointment reminders |
| `appointment-reminders-1hr` | Every 15 min | Urgent 1-hour reminders |
| `cleanup-expired-reservations` | Every 30 min | Clean up expired Multibanco reservations |
| `send-payment-reminders` | Every 6 hours | Multibanco payment reminders |

## File Structure

```
src/
├── app/api/cron/
│   ├── appointment-reminders/
│   │   └── route.ts
│   ├── appointment-reminders-1hr/
│   │   └── route.ts
│   ├── cleanup-expired-reservations/
│   │   └── route.ts
│   └── send-payment-reminders/
│       └── route.ts
└── lib/cron/
    ├── index.ts              # Barrel exports
    └── appointment-utils.ts  # Shared utilities
```

## Shared Utilities

Location: `src/lib/cron/appointment-utils.ts`

### `getUpcomingAppointments()`

Fetches appointments within a time window with all necessary data for notifications.

```typescript
interface AppointmentWithDetails {
  id: string;
  startTime: Date;
  endTime: Date;
  meetingUrl: string | null;
  appointmentType: string;
  
  // Expert info
  expertWorkosId: string;
  expertName: string;
  expertTimezone: string;
  expertLocale: string | null;
  
  // Customer info
  customerWorkosId: string;
  customerName: string;
  customerTimezone: string;
  customerLocale: string | null;
  guestEmail: string;
}

async function getUpcomingAppointments(
  windowStartMinutes: number,
  windowEndMinutes: number
): Promise<AppointmentWithDetails[]>
```

**Example:**
```typescript
// Get appointments starting in 60-75 minutes
const appointments = await getUpcomingAppointments(60, 75);
```

### `formatDateTime()`

Formats date/time for a specific timezone and locale.

```typescript
interface FormattedDateTime {
  datePart: string;  // "January 25, 2026" or "25 de janeiro de 2026"
  timePart: string;  // "2:00 PM" or "14:00"
}

function formatDateTime(
  date: Date,
  timezone: string,
  locale?: string | null
): FormattedDateTime
```

**Example:**
```typescript
const { datePart, timePart } = formatDateTime(
  appointment.startTime,
  'Europe/Lisbon',
  'pt'
);
// datePart: "25 de janeiro de 2026"
// timePart: "14:00"
```

### `getLocaleFromCountry()`

Maps country codes to supported locales.

```typescript
type SupportedLocale = 'en' | 'pt' | 'es';

function getLocaleFromCountry(country: string | null): SupportedLocale
```

**Mapping:**
- `PT`, `BR` → `pt`
- `ES`, `MX`, `AR`, `CO`, `CL` → `es`
- Everything else → `en`

## Cron Job Implementation Pattern

All cron jobs follow this pattern:

```typescript
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { NextResponse } from 'next/server';

// Region is set project-wide via "regions": ["fra1"] in vercel.json
export const maxDuration = 60;

async function handler() {
  console.log('🔄 Running cron job...');

  try {
    // 1. Fetch data
    const items = await fetchItems();

    // 2. Process each item
    for (const item of items) {
      try {
        await processItem(item);
      } catch (error) {
        console.error(`Failed to process ${item.id}:`, error);
      }
    }

    // 3. Return results
    return NextResponse.json({
      success: true,
      processed: items.length,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { error: 'Failed to process' },
      { status: 500 }
    );
  }
}

// QStash signature verification
export const POST = verifySignatureAppRouter(handler);
```

## Novu Idempotency

All notification triggers include a `transactionId` for idempotency:

```typescript
await triggerWorkflow({
  workflowId: 'appointment-universal',
  to: { subscriberId: expertWorkosId },
  payload: { ... },
  // Use deterministic ID based on appointment and reminder window
  // This ensures retries produce the same transactionId
  transactionId: `24h-expert-${appointment.id}`,
});
```

**Important:** The `transactionId` must be deterministic (stable across retries). Do NOT use `Date.now()` or other non-deterministic values, as this defeats the idempotency purpose. Use a combination of:
- Reminder window identifier (`24h`, `1hr`)
- Recipient type (`expert`, `patient`)
- Appointment ID

This prevents duplicate notifications if the cron job retries.

## Locale Support

Cron jobs determine the locale for notifications:

```typescript
// Extract locale from user's stored preference or country
const localeLower = (appointment.expertLocale || 'en').toLowerCase();
const locale: SupportedLocale = localeLower.startsWith('pt')
  ? 'pt'
  : localeLower.startsWith('es')
    ? 'es'
    : 'en';
```

## Environment Variables

```bash
# QStash (required for signature verification)
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...

# Novu (for sending notifications)
NOVU_SECRET_KEY=...
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=...
```

## QStash Configuration

In your QStash dashboard, configure schedules:

```
# 24-hour reminders (hourly)
URL: https://your-domain.com/api/cron/appointment-reminders
Schedule: 0 * * * *

# 1-hour reminders (every 15 minutes)
URL: https://your-domain.com/api/cron/appointment-reminders-1hr
Schedule: */15 * * * *

# Cleanup expired reservations (every 30 minutes)
URL: https://your-domain.com/api/cron/cleanup-expired-reservations
Schedule: */30 * * * *

# Payment reminders (every 6 hours)
URL: https://your-domain.com/api/cron/send-payment-reminders
Schedule: 0 */6 * * *
```

## Debugging

### View cron logs
```bash
# In Vercel dashboard
Functions → Select cron route → View logs
```

### Test locally

The cron endpoints use `verifySignatureAppRouter(handler)` which requires valid QStash signatures. Here are three approaches to test locally:

**Option A: Environment-based conditional export (recommended)**

Modify your route file to bypass verification in development:

```typescript
// At the end of your route.ts file
export const POST = process.env.NODE_ENV === 'development'
  ? handler
  : verifySignatureAppRouter(handler);
```

> **WARNING - Local Testing Only**: The above `POST` export with `NODE_ENV` check bypasses
> `verifySignatureAppRouter` in development. Do NOT commit this to main branches without:
> - Adding a `// TODO: Remove before merge` comment
> - Using a feature flag or git stash for the temporary change
> - Preferring **Option C** (development-only GET route) which is safer for production since
>   GET endpoints won't be triggered by QStash schedules.

Then test with:
```bash
curl -X POST http://localhost:3000/api/cron/appointment-reminders
```

**Option B: Use QStash test headers**

Get test headers from the QStash dashboard (Publish → Test Headers) and include them:

```bash
curl -X POST http://localhost:3000/api/cron/appointment-reminders \
  -H "Upstash-Signature: YOUR_TEST_SIGNATURE" \
  -H "Upstash-Message-Id: test-123"
```

**Option C: Add a development-only GET route**

Add a separate route for local testing:

```typescript
// Only available in development
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  return handler();
}
```

Then test with:
```bash
curl http://localhost:3000/api/cron/appointment-reminders
```

## Related Files

- `src/lib/cron/appointment-utils.ts` - Shared utilities
- `src/lib/integrations/novu/utils.ts` - Novu trigger with idempotency
- `_docs/02-core-systems/notifications/` - Notification documentation

## See Also

- [Novu Integration](../02-core-systems/notifications/01-novu-integration.md)
- [Email Templates](../02-core-systems/notifications/05-email-templates.md)
