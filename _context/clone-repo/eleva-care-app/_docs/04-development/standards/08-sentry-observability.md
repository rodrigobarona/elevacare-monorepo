# Sentry Observability -- API Route Instrumentation

**Date:** February 24, 2026
**Commit:** `0318ae9a`
**Files changed:** 64 (+1,097 / -1,001 lines)
**Status:** Complete

---

## Overview

All API route handlers across the application were instrumented with Sentry for structured error logging, exception capture, and performance tracing. This replaces ad-hoc `console.error` / `console.warn` usage with Sentry's structured logging SDK.

The existing Cursor rule `.cursor/rules/sentry.mdc` documents the Sentry configuration; this document covers the API route instrumentation pattern specifically.

---

## Pattern

Every API route handler now follows this structure:

```typescript
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export async function GET() {
  try {
    // ... handler logic ...
    return NextResponse.json({ data });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Descriptive error message', { error, contextKey: contextValue });
    return NextResponse.json(
      { success: false, error: 'User-facing message' },
      { status: 500 },
    );
  }
}
```

### Key elements

1. **Import `* as Sentry`** at the top of every route file
2. **Destructure `logger`** from Sentry for structured logging
3. **`Sentry.captureException(error)`** in every catch block to send the exception to Sentry with full stack trace
4. **`logger.error(message, metadata)`** replaces `console.error` with structured metadata (objects, not string interpolation)
5. **User-facing error responses** remain generic; detailed context goes to Sentry only

---

## Before / After

### Before (console.error)

```typescript
export async function GET() {
  try {
    const categories = await db.query.CategoriesTable.findMany();
    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}
```

### After (Sentry instrumentation)

```typescript
import * as Sentry from '@sentry/nextjs';

const { logger } = Sentry;

export async function GET() {
  try {
    const categories = await db.query.CategoriesTable.findMany();
    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching categories', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}
```

---

## Server Actions vs API Routes

Server actions in `src/server/actions/` use `Sentry.withServerActionInstrumentation` which automatically creates a Sentry transaction/span:

```typescript
export async function getExpertStats(workosUserId: string): Promise<ExpertStats> {
  return Sentry.withServerActionInstrumentation(
    'dashboard.getExpertStats',
    { recordResponse: true },
    async () => {
      // ... action logic with try/catch and logger.error ...
    },
  );
}
```

API routes use the simpler `try/catch` + `captureException` + `logger` pattern shown above. The distinction:

| Context | Pattern | Tracing |
| ------- | ------- | ------- |
| Server Actions | `withServerActionInstrumentation` | Automatic transaction + span |
| API Routes | `try/catch` + `captureException` | Exception capture, no automatic span |
| Webhook Handlers | `try/catch` + `captureException` | Exception capture with webhook-specific tags |

---

## Routes Instrumented

64 route files across 13 API domains:

### Admin (8 files)

- `admin/categories/[id]`, `admin/categories`
- `admin/payment-transfers/approve`, `admin/payment-transfers`
- `admin/qstash-health`, `admin/setup-schedules`
- `admin/users`, `admin/verify-qstash`

### Appointments (3 files)

- `appointments/[meetingId]/records`
- `appointments/patients/[email]`
- `appointments`

### Auth (3 files)

- `auth/callback`, `auth/google/callback`, `auth/user-authorization`

### Cron Jobs (8 files)

- `cron/appointment-reminders-1hr`, `cron/appointment-reminders`
- `cron/check-upcoming-payouts`, `cron/cleanup-blocked-dates`
- `cron/cleanup-expired-reservations`, `cron/keep-alive`
- `cron/process-expert-transfers`, `cron/process-pending-payouts`
- `cron/process-tasks`, `cron/send-payment-reminders`

### Customers (2 files)

- `customers/[id]`, `customers`

### Expert (4 files)

- `expert/accept-practitioner-agreement`, `expert/identity-status`
- `experts/verify-connect`, `experts/verify-specific`

### Health (3 files)

- `health/[service]`, `healthcheck`, `diagnostics`

### Internal (2 files)

- `internal/force-verification`, `internal/sync-identity`

### Stripe (5 files)

- `stripe/dashboard`
- `stripe/identity/status`, `stripe/identity/verification`, `stripe/identity/verification/status`
- `create-payment-intent`

### User (6 files)

- `user/billing`, `user/identity`, `user/profile`
- `user/rbac`, `user/roles`, `user/security-preferences`

### Webhooks (5 files)

- `webhooks/novu`, `webhooks/stripe-subscriptions`
- `webhooks/stripe` (route + handlers: `account`, `external-account`, `payment`)
- `webhooks/workos`

### Other (5 files)

- `categories`, `meetings/status`, `novu/subscriber-hash`
- `og/image`, `profile`, `qstash`, `records`
- `scheduling-settings`, `upload`, `users/[userId]/roles`

---

## Logger Levels Used

| Level | When to use | Example |
| ----- | ----------- | ------- |
| `logger.error` | Unrecoverable failures, caught exceptions | `logger.error('Payment processing failed', { error, paymentIntentId })` |
| `logger.warn` | Degraded state, retryable failures | `logger.warn('Cache miss, falling back to DB', { key })` |
| `logger.info` | Significant operations completing successfully | `logger.info('Commission recorded', { commissionId })` |

All log calls use structured metadata objects as the second argument. Template literals via `logger.fmt` are used for variable interpolation when needed (see `.cursor/rules/sentry.mdc` for examples).

---

## Verification

All instrumented routes can be verified in the Sentry dashboard:

- **Organization:** `elevacade`
- **Project:** `eleva-care`
- **View errors:** Sentry Issues dashboard, filtered by tag `operation` or error message
- **View logs:** Sentry Logs tab (enabled via `enableLogs: true` in SDK config)

Errors from API routes appear with full stack traces, structured metadata, and source maps (uploaded automatically during builds via `SENTRY_AUTH_TOKEN`).
