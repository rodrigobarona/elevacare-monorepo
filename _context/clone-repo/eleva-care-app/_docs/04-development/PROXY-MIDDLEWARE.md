# Proxy Middleware Architecture

> **File:** `src/proxy.ts`
>
> The proxy middleware is the central request handler for the Eleva Care application, managing authentication, authorization, i18n routing, and special route handling.

## Overview

The proxy middleware runs on **every request** (except static files) and handles:

1. **Authentication** - WorkOS AuthKit session validation
2. **Authorization** - JWT-based role-based access control (RBAC)
3. **i18n Routing** - Internationalization for marketing pages
4. **Content Negotiation** - LLM documentation routes (Fumadocs)
5. **Security** - Cron job authentication, webhook bypasses

## Architecture Flow

```
Request
   │
   ▼
┌─────────────────────────────────────┐
│  Static File Check                   │
│  (bypass if .png, .jpg, .css, etc.) │
└─────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────┐
│  AuthKit Middleware                  │
│  - Session validation                │
│  - JWT extraction                    │
│  - Role/Permission extraction        │
└─────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────┐
│  Route Classification               │
│  - Skip-auth routes (webhooks)      │
│  - Special auth routes (cron)       │
│  - LLM routes (docs)                │
│  - Docs routes (/docs/*)            │
│  - Auth/App routes                  │
│  - Marketing routes (i18n)          │
└─────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────┐
│  Authorization Check                 │
│  - Admin route → SUPERADMIN role     │
│  - Expert route → EXPERT_* role      │
│  - Permission checks                 │
└─────────────────────────────────────┘
   │
   ▼
Response
```

## Route Categories

### 1. Skip-Auth Routes

Routes that bypass authentication entirely (have their own security):

```typescript
SKIP_AUTH_API_PATTERNS = [
  '/api/webhooks/',     // Stripe signature verification
  '/api/cron/',         // QStash signature verification
  '/api/qstash/',       // QStash internal routes
  '/api/internal/',     // Internal API (admin key required)
  '/api/healthcheck',   // Health checks
  '/api/search',        // Documentation search
  '/monitoring',        // Sentry tunnel
  '/llms-full.txt',     // LLM documentation
  '/llms.mdx/',         // LLM MDX routes
]
```

### 2. Admin Routes

Routes requiring SUPERADMIN role:

```typescript
ADMIN_ROUTES = [
  '/admin(.*)',           // Admin pages
  '/api/admin(.*)',       // Admin API endpoints
  '/api/categories(.*)',  // Category management
]
```

### 3. Expert Routes

Routes requiring EXPERT_TOP or EXPERT_COMMUNITY role:

```typescript
EXPERT_ROUTES = [
  '/booking(.*)',          // Booking management
  '/appointments(.*)',     // Appointments
  '/account/identity(.*)', // Identity verification
  '/account/billing(.*)',  // Billing management
  '/api/expert(.*)',       // Expert API
  '/api/appointments(.*)', // Appointments API
  '/api/customers(.*)',    // Customer management
  '/api/records(.*)',      // Medical records
  '/api/meetings(.*)',     // Meeting management
  '/api/stripe(.*)',       // Stripe Connect
]
```

### 4. Marketing Routes (i18n)

All other routes go through `next-intl` for internationalization:

- `/` → `/en/` or `/pt/` (locale detection)
- `/about` → `/en/about` or `/pt/about`

## Header Forwarding

The proxy forwards AuthKit headers to downstream handlers:

```typescript
// Request headers (for withAuth() verification)
const requestHeaders = createRequestHeadersWithAuth(request.headers, authkitHeaders);

// Response headers (for Set-Cookie)
applyAuthkitHeaders(response, authkitHeaders);
```

**Critical:** `withAuth()` in page components reads these headers to verify the middleware ran.

## Cron Job Authentication

Cron jobs use QStash signature verification:

```typescript
// Verification methods (in order of precedence):
1. QStash signature (isVerifiedQStashRequest)
2. CRON_API_KEY header
3. CRON_SECRET header
4. Fallback token (production only, Upstash user-agent)
```

## Matcher Configuration

```typescript
export const config = {
  matcher: [
    // All routes except static files
    '/((?!_next|_vercel|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|eot|css|js|map)$).*)',
    '/',
    '/llms-full.txt',  // Explicit LLM route
  ],
};
```

**Excluded extensions:** Images, fonts, CSS, JS bundles
**Allowed extensions:** `.txt`, `.mdx` (these are routes, not static files)

## Helper Functions

### `applyAuthkitHeaders(response, headers)`

Applies AuthKit headers to a response:
- `Set-Cookie` headers are appended (supports multiple cookies)
- Other headers are set (overwrite if exists)

### `createRequestHeadersWithAuth(originalHeaders, authkitHeaders)`

Creates request headers with AuthKit headers merged in.
Excludes `Set-Cookie` (those go on response only).

### `isStaticFile(pathname)`

Checks if a path is a static file that should bypass middleware.

### `matchPatternsArray(path, patterns)`

Matches a path against glob patterns like `/admin(.*)`.

## Debugging

Enable debug logging:

```bash
DEBUG_MIDDLEWARE=true bun run dev
```

Debug output shows:
- Route classification
- i18n rewriting
- Authorization checks
- Header forwarding

## Related Files

- `src/lib/constants/roles.ts` - Route patterns for RBAC
- `src/lib/constants/routes.ts` - Segment-based route helpers
- `src/types/workos-rbac.ts` - WorkOS role definitions
- `src/lib/auth/roles.ts` - Client-side role management
- `src/lib/auth/roles.server.ts` - Server-side role management

## Why No Route-Level Admin Middleware?

**Q: Why don't admin API routes have their own middleware?**

The proxy already handles admin authorization:

```typescript
// In proxy.ts
if (matchPatternsArray(path, ADMIN_ROUTES)) {
  const isAdmin = hasRequiredRole(userRole, ADMIN_ROLES);
  if (!isAdmin) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }
}
```

This means:
1. Non-admin users are **blocked before reaching the route handler**
2. Route handlers can assume the user is already authorized
3. No redundant checks needed in each API route

This follows Next.js 16's single-proxy architecture where all authorization happens in one place.

