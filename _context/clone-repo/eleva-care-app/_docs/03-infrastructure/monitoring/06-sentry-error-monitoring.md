# Sentry Error Monitoring Guide

> **Complete guide to error monitoring, performance tracing, session replay, and logging with Sentry for Eleva Care**

## Overview

Sentry is our primary error monitoring and application performance management (APM) solution. This guide covers:

- **Error Monitoring** - Automatic capture of exceptions and errors
- **Performance Tracing** - Track request flows and identify bottlenecks
- **Session Replay** - Video-like reproductions of user sessions with errors
- **Logs** - Structured logging with correlation to errors and traces
- **User Feedback** - Allow users to report bugs directly

---

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Environment Variables](#environment-variables)
3. [File Structure](#file-structure)
4. [Features](#features)
5. [Usage Examples](#usage-examples)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Configuration Overview

### Project Details

| Setting          | Value             |
| ---------------- | ----------------- |
| **Organization** | elevacare         |
| **Project**      | eleva-care        |
| **Project ID**   | 4510510365737040  |
| **DSN Region**   | EU (de.sentry.io) |

### Features Enabled

| Feature             | Client | Server | Edge |
| ------------------- | ------ | ------ | ---- |
| Error Monitoring    | ✅     | ✅     | ✅   |
| Performance Tracing | ✅     | ✅     | ✅   |
| Session Replay      | ✅     | N/A    | N/A  |
| User Feedback       | ✅     | N/A    | N/A  |
| Logs                | ✅     | ✅     | ✅   |
| Source Maps         | ✅     | ✅     | N/A  |

---

## Environment Variables

### Required Variables

Add these to your `.env.local` file and Vercel environment:

```bash
# Public DSN (safe to expose to browser)
NEXT_PUBLIC_SENTRY_DSN="https://924a8bdf94ce8285f86e440920ff184a@o4507550720065536.ingest.de.sentry.io/4510510365737040"

# Auth token for source map uploads (KEEP SECRET - never commit!)
# Get from: https://sentry.io/settings/account/api/auth-tokens/
SENTRY_AUTH_TOKEN="sntrys_eyJ..."
```

### Optional Variables

```bash
# Server-side DSN (defaults to NEXT_PUBLIC_SENTRY_DSN if not set)
SENTRY_DSN="https://924a8bdf94ce8285f86e440920ff184a@o4507550720065536.ingest.de.sentry.io/4510510365737040"
```

### Getting a Sentry Auth Token

1. Go to [Sentry Auth Tokens](https://sentry.io/settings/account/api/auth-tokens/)
2. Click **Create New Token**
3. Select scopes:
   - `project:releases`
   - `project:write`
   - `org:read`
4. Name it: `eleva-care-source-maps`
5. Copy the token and add to your environment

### Vercel Setup

Add these environment variables in Vercel:

1. Go to Project Settings → Environment Variables
2. Add `SENTRY_AUTH_TOKEN` (Production & Preview only, Secret)
3. Add `NEXT_PUBLIC_SENTRY_DSN` (All environments)

---

## File Structure

```
/
├── instrumentation-client.ts     # Client-side SDK (browser)
├── sentry.server.config.ts       # Server-side SDK (Node.js)
├── sentry.edge.config.ts         # Edge runtime SDK
├── next.config.ts                # Sentry build configuration
└── src/
    ├── instrumentation.ts        # Next.js instrumentation hook
    └── app/
        ├── global-error.tsx      # Root error boundary
        └── layout.tsx            # Trace data for distributed tracing
```

### Configuration Details

#### `instrumentation-client.ts` (Client)

- Session Replay (10% sessions, 100% on error)
- User Feedback widget
- Console logging integration
- Router transition tracing

#### `sentry.server.config.ts` (Server)

- Console logging integration
- Performance tracing (10% in production)
- PII capture enabled

#### `sentry.edge.config.ts` (Edge)

- Lightweight configuration for middleware
- Performance tracing

#### `next.config.ts` (Build)

- Source map uploads
- Tunnel route (`/monitoring`) for ad-blocker bypass
- React component annotation
- Vercel cron monitoring

---

## Features

### 1. Error Monitoring

Errors are automatically captured from:

- Unhandled exceptions
- Promise rejections
- React render errors
- API route errors
- Server component errors

**Manual capture:**

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { operation: 'riskyOperation' },
    extra: { userId, context: 'booking flow' },
  });
}
```

### 2. Session Replay

Records user sessions for debugging. Shows exactly what the user saw and did before an error occurred.

**Sample rates:**

- 10% of all sessions in production
- 100% of sessions with errors
- 100% of sessions in development

### 3. User Feedback

A "Report a Bug" button appears in the UI, allowing users to:

- Describe what went wrong
- Optionally provide email and name
- Submit directly to Sentry

### 4. Performance Tracing

**Automatic instrumentation:**

- Page loads and navigations
- API requests (fetch)
- Database queries (via Drizzle)

**Manual spans:**

```typescript
import * as Sentry from '@sentry/nextjs';

async function processBooking(bookingId: string) {
  return Sentry.startSpan(
    {
      op: 'booking.process',
      name: `Process Booking ${bookingId}`,
    },
    async (span) => {
      span.setAttribute('booking_id', bookingId);

      // Your logic here
      const result = await createAppointment();

      span.setAttribute('appointment_id', result.id);
      return result;
    },
  );
}
```

### 5. Logs

**Using the logger:**

```typescript
import * as Sentry from '@sentry/nextjs';

const { logger } = Sentry;

logger.info('Booking created', { bookingId, userId });
logger.warn('Rate limit approaching', { endpoint, remaining: 10 });
logger.error('Payment failed', { orderId, error: error.message });
```

**Console integration:**

- `console.error` and `console.warn` are automatically sent to Sentry

### 6. Distributed Tracing

Frontend and backend traces are connected via headers in `src/app/layout.tsx`.

This enables:

- Following a request from browser → API → database
- Identifying which backend operation caused a frontend error
- Performance analysis across the full stack

---

## Usage Examples

### Adding Context to Errors

```typescript
import * as Sentry from '@sentry/nextjs';

// Set user context
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});

// Add tags for filtering
Sentry.setTag('feature', 'booking');
Sentry.setTag('plan', user.plan);

// Add extra data
Sentry.setExtra('booking_details', {
  eventId,
  expertId,
  duration,
});
```

### Creating Breadcrumbs

```typescript
Sentry.addBreadcrumb({
  category: 'booking',
  message: 'User selected time slot',
  level: 'info',
  data: {
    time: selectedTime,
    expert: expertId,
  },
});
```

### Custom Error Boundaries

```tsx
'use client';

import * as Sentry from '@sentry/nextjs';

export function BookingErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      fallback={<BookingError />}
      onError={(error) => {
        Sentry.captureException(error, {
          tags: { component: 'booking' },
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

---

## Testing

### Verify Error Capture

Add a test button to any page:

```tsx
<button
  type="button"
  onClick={() => {
    throw new Error('Sentry Test Error');
  }}
>
  Test Sentry Error
</button>
```

### Verify API Tracing

Create a test API route:

```typescript
// app/api/sentry-test/route.ts
import { NextResponse } from 'next/server';

export function GET() {
  throw new Error('Sentry API Test Error');
}
```

### View in Sentry

1. **Issues**: [sentry.io/issues](https://sentry.io/issues)
2. **Traces**: [sentry.io/explore/traces](https://sentry.io/explore/traces)
3. **Replays**: [sentry.io/explore/replays](https://sentry.io/explore/replays)
4. **Logs**: [sentry.io/explore/logs](https://sentry.io/explore/logs)

---

## PostHog Integration

Sentry is integrated with PostHog for cross-platform debugging:

### User Context Sharing

When a user is identified in PostHog, the same user context is set in Sentry:

```typescript
// Set in src/app/providers.tsx
Sentry.setUser({
  id: user.id,       // WorkOS user ID
  email: user.email,
  username: userName,
});
```

### Role Tagging

User roles are tagged for filtering errors by user type:

```typescript
Sentry.setTag('user_role', userRole);
// Values: 'admin', 'expert_top', 'expert_community', 'user', 'anonymous'
```

### PostHog Session Context

PostHog session info is added to Sentry for debugging:

```typescript
Sentry.setContext('posthog', {
  session_id: posthog.get_session_id(),
  distinct_id: posthog.get_distinct_id(),
  session_replay_url: posthog.get_session_replay_url({ withTimestamp: true }),
});
```

### Debugging Workflow

1. **View error in Sentry** → See user ID and role tag
2. **Check PostHog context** → Get session replay URL
3. **Click replay URL** → Watch user journey before error
4. **Filter by role** → Analyze if error affects specific user types

---

## Troubleshooting

### Errors Not Appearing

1. **Check DSN**: Verify `NEXT_PUBLIC_SENTRY_DSN` is set
2. **Check Network**: Look for requests to `sentry.io` in browser DevTools
3. **Check Console**: Look for Sentry initialization errors
4. **Enable Debug**: Set `debug: true` in Sentry.init()

### Source Maps Not Working

1. **Check Token**: Verify `SENTRY_AUTH_TOKEN` is set in Vercel
2. **Check Build Logs**: Look for "Uploading source maps" in build output
3. **Check Release**: Verify release version matches in Sentry

### Session Replay Not Recording

1. **Sample Rate**: Remember only 10% of sessions are recorded in production
2. **Error Sessions**: All sessions with errors are recorded
3. **Development**: 100% of sessions are recorded in development

### Tunnel Route Issues

If errors aren't being sent and you suspect ad-blockers:

1. Check that `/monitoring` isn't blocked by your middleware
2. Verify the tunnel route is configured in `next.config.ts`
3. Test with ad-blocker disabled to confirm

### High Volume Alerts

If you're hitting quota limits:

1. Reduce `tracesSampleRate` (e.g., from 0.1 to 0.05)
2. Reduce `replaysSessionSampleRate` (e.g., from 0.1 to 0.05)
3. Use `beforeSend` to filter out known issues

---

## Maintenance

### Weekly

- [ ] Review error trends in Issues dashboard
- [ ] Check for new error patterns
- [ ] Review session replays for UX issues

### Monthly

- [ ] Audit sample rates vs. quota usage
- [ ] Review and resolve recurring issues
- [ ] Update ignored errors list

### Quarterly

- [ ] Update SDK version
- [ ] Review and optimize configuration
- [ ] Audit PII handling

---

## Quick Reference

### Common Imports

```typescript
import * as Sentry from '@sentry/nextjs';

// For logging
const { logger } = Sentry;
```

### Common Operations

```typescript
// Capture exception
Sentry.captureException(error);

// Capture message
Sentry.captureMessage('Something happened', 'warning');

// Set user
Sentry.setUser({ id, email });

// Clear user (on logout)
Sentry.setUser(null);

// Add breadcrumb
Sentry.addBreadcrumb({ category, message, level });

// Create span
Sentry.startSpan({ op, name }, callback);
```

### Links

- [Sentry Dashboard](https://eleva-cuidados-de-salud-sl.sentry.io)
- [Issues](https://sentry.io/issues)
- [Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

**Last Updated**: December 10, 2025  
**Maintained By**: Engineering Team  
**Questions?** Post in #engineering Slack channel
