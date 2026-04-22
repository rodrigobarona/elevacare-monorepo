# Server Audit -- February 2026

**Date:** February 24, 2026
**Commits:** `5fc7bf34`, `8486a4b8`, `35fffdf9`, `2e30c393`, `ce9b23c0`, `4dd6dd2e`
**Files changed:** ~70 across 6 commits
**Status:** Complete

---

## Overview

A security and code-quality audit was performed across the server layer on Feb 24, 2026. The work addressed findings from the `lib_server_audit` plan and covered six areas:

1. Superadmin role checks on admin endpoints
2. User data retrieval refactoring
3. Dependency removal (p-retry)
4. Configuration centralization
5. Server action hygiene
6. WorkOS user ID reference cleanup

---

## 1. Admin Endpoint Authorization

**Commit:** `4dd6dd2e`

**Problem:** Several admin and internal endpoints relied on proxy-level middleware for authorization but had no in-route role checks. If the proxy was bypassed or misconfigured, the endpoints were unprotected.

**Fix:** Every admin and internal endpoint now performs an explicit `hasRole(WORKOS_ROLES.SUPERADMIN)` check at the top of the handler:

```typescript
import { hasRole } from '@/lib/auth/roles.server';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function GET() {
  const { user } = await withAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... handler logic
}
```

**Routes updated:**

| Route | Methods |
| ----- | ------- |
| `/api/admin/payment-transfers` | GET, POST |
| `/api/admin/qstash-health` | GET |
| `/api/admin/setup-schedules` | GET, POST |
| `/api/admin/verify-qstash` | GET |
| `/api/cron/check-eligibility` | GET |
| `/api/cron/keep-alive` | GET |
| `/api/internal/force-verification` | POST |
| `/api/test-email` | POST |

---

## 2. User Data Retrieval Refactoring

**Commit:** `8486a4b8`

**Problem:** Multiple user lookup patterns existed across the codebase. `src/server/db/users.ts` contained legacy functions that duplicated logic found in `ensureFullUserSynchronization`.

**Fix:**

- Deprecated and removed legacy helper functions from `src/server/db/users.ts` (-55 lines)
- Consolidated user lookup into `ensureFullUserSynchronization` in `src/server/actions/user-sync.ts` (-138 lines net, simplified flow)
- Updated callers (e.g., `check-upcoming-payouts` cron route) to use the consolidated function

**Remaining in `src/server/db/users.ts`:**

- `getUserByUsername` -- public profile lookup by username
- `getUserByWorkosId` -- minimal user fetch by WorkOS ID
- `getFullUserByWorkosId` -- full user record with all columns
- `isUsernameAvailable` -- availability check
- `updateUsername`, `getUsersWithoutUsernames` -- admin utilities

---

## 3. Dependency Removal: p-retry

**Commit:** `2e30c393`

**Problem:** The `p-retry` npm package was used in billing server actions for retry logic around Stripe API calls. This added a dependency for a pattern better handled by Sentry instrumentation and Stripe's own retry mechanisms.

**Fix:**

- Removed `p-retry` from `package.json` and `bun.lock`
- Removed retry wrappers from `src/server/actions/billing.ts` (-72 lines)
- Error handling now relies on `Sentry.withServerActionInstrumentation` for observability and structured `try/catch` blocks for error responses

---

## 4. Configuration Centralization

**Commit:** `35fffdf9`

Two configuration concerns were extracted from inline code into dedicated modules:

### Stripe Connect Appearance

**Before:** Stripe appearance object was defined inline in `StripeConnectProvider.tsx`.

**After:** Extracted to `src/config/stripe-appearance.ts` as `STRIPE_CONNECT_APPEARANCE`. Maps Eleva design tokens (Deep Teal `#006D77`, Sage Green `#83C5BE`, Soft Coral `#E29578`, etc.) to Stripe's appearance API. Used by all Stripe Connect embedded components.

### Country Labels

**Before:** Country name mapping was duplicated in `src/config/stripe.ts` and `billing-client.tsx`.

**After:** Extracted to `src/lib/constants/countries.ts` with a `getCountryLabel(code)` helper. Single source of truth for all country display names. Currently used by billing and Stripe Connect account creation flows.

---

## 5. Server Action Hygiene

**Commit:** `5fc7bf34`

**Problem:** Some files in `src/server/actions/` included `'use server'` directives that were unnecessary because the files are already server-only modules (imported only by other server code, never by client components).

**Fix:**

- Removed unnecessary `'use server'` from `billing.ts`, `experts.ts`, and `user-sync.ts`
- Added a Cursor rule (`.cursor/rules/server-actions.mdc`) documenting when `'use server'` is required vs optional

**Rule:** `'use server'` is required only when a function is called directly from a client component (form actions, event handlers). Server-to-server imports do not need it.

---

## 6. WorkOS User ID Reference Cleanup

**Commit:** `ce9b23c0`

**Problem:** After the Clerk-to-WorkOS migration, some code still used old variable names (`clerkUserId`, `userId`) or stale import paths for user-related utilities.

**Fix:** Systematic rename across 55 files:

- Standardized on `workosUserId` as the variable name for WorkOS user IDs
- Updated all `src/lib/integrations/` modules (Novu, QStash, Stripe, WorkOS, Google Calendar)
- Updated all `src/lib/` utilities (Redis, cache, rate limiter, audit, notifications)
- Updated all `src/server/` actions and services
- Removed stale test files and mocks that tested deleted Novu workflow logic
- Updated schema comments in `drizzle/schema.ts`

---

## Impact Summary

| Area | Before | After |
| ---- | ------ | ----- |
| Admin auth | Proxy-only | Proxy + in-route superadmin check |
| User lookup | 5+ patterns | Consolidated into 2 paths |
| Dependencies | p-retry installed | Removed |
| Stripe config | Inline in 2 files | Centralized in `src/config/` |
| Server directives | Unnecessary `'use server'` in 3 files | Cleaned up |
| Variable names | Mixed `clerkUserId`/`userId` | Standardized `workosUserId` |
