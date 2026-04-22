# Root Page Fix - Home Page 404 Issue

**Date:** November 13, 2025  
**Issue:** `/` (root path) returned 404 and "withAuth not covered by middleware" error  
**Status:** ✅ Fixed

---

## 🐛 Problem

When accessing `http://localhost:3000/` (root path without locale):

1. **404 Error:** `GET / 404 in 5.7s`
2. **Middleware Error:** "You are calling 'withAuth' on a route that isn't covered by the AuthKit middleware"

**Root Cause:**
- Next.js App Router structure had all pages under `(marketing)/[locale]/page.tsx`
- No root-level `page.tsx` at `src/app/page.tsx`
- When users accessed `/`, Next.js couldn't find a page to render → 404

---

## ✅ Solution

Created `/src/app/page.tsx` with a redirect to the default locale:

```typescript
/**
 * Root Page - Redirects to the appropriate localized home page
 *
 * This page handles requests to "/" (without locale prefix) and redirects
 * to the appropriate locale-prefixed version (e.g., "/en", "/es", etc.)
 */
import { defaultLocale } from '@/lib/i18n';
import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect to default locale
  // The middleware will handle locale detection and may redirect again
  // if a different locale should be used
  redirect(`/${defaultLocale}`);
}
```

---

## 🔍 How It Works

### **Request Flow:**

1. **User accesses:** `http://localhost:3000/`
2. **Proxy runs:** Checks `isHomePage(path)` → returns `true` for `/`
3. **Marked as public route:** No authentication required
4. **i18n middleware runs:** Detects locale from headers/cookies
5. **Root page renders:** Redirects to `/en` (or detected locale)
6. **Final destination:** `(marketing)/[locale]/page.tsx` renders

### **Proxy Configuration:**

The proxy's `isHomePage()` function already handled `/` correctly:

```typescript
function isHomePage(path: string): boolean {
  if (path === '/') return true;  // ✅ Catches root path
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 1) {
    return locales.includes(segments[0] as (typeof locales)[number]);
  }
  return false;
}
```

And root path was included in public routes:

```typescript
const isPublicRoute =
  isUsernameRoute(path) ||
  isLocalePublicRoute(path) ||
  isHomePage(path) ||  // ✅ Root path is public
  isAuthRoute(path) ||
  isPublicContentPath(path) ||
  isPublicContentPath(pathWithoutLocale) ||
  matchPatternsArray(path, PUBLIC_ROUTES);
```

The middleware config matcher also includes `/`:

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\..*|\\.well-known|api/webhooks|api/cron|api/qstash|api/internal|api/healthcheck|api/health|api/create-payment-intent|_vercel|_botid).*)',
  ],
};
// This regex matches "/" because it matches any path not in the exclusions
```

---

## 🎯 Why This Pattern?

**Best Practice: Separate Root Redirect from Localized Pages**

This follows Next.js App Router + i18n best practices:

1. **Root page:** Simple redirect to default locale
2. **Middleware:** Handles advanced locale detection (headers, cookies, geo)
3. **Localized pages:** `(marketing)/[locale]/page.tsx` contains the actual content

**Benefits:**
- ✅ SEO-friendly (proper redirects)
- ✅ Works with `next-intl` middleware
- ✅ Supports locale detection
- ✅ Clean separation of concerns

---

## 📝 Alternative Approaches Considered

### **❌ Option 1: Duplicate content at root**
```typescript
// src/app/page.tsx
export default function HomePage() {
  return <HomePageContent />;
}
```
**Rejected:** Creates duplicate content, SEO issues, breaks i18n

### **❌ Option 2: Root layout-level redirect**
```typescript
// src/app/layout.tsx
if (!locale) redirect('/en');
```
**Rejected:** Complicates root layout, harder to maintain

### **✅ Option 3: Dedicated root page with redirect (CHOSEN)**
```typescript
// src/app/page.tsx
redirect(`/${defaultLocale}`);
```
**Selected:** Clean, simple, follows Next.js patterns

---

## 🧪 Testing

**Before Fix:**
```bash
$ curl http://localhost:3000/
# 404 Not Found
```

**After Fix:**
```bash
$ curl -I http://localhost:3000/
# 307 Temporary Redirect
# Location: /en

$ curl http://localhost:3000/en
# 200 OK (Home page renders)
```

---

## 📚 References

- Next.js App Router: https://nextjs.org/docs/app/building-your-application/routing
- next-intl Routing: https://next-intl-docs.vercel.app/docs/routing
- WorkOS AuthKit Middleware: https://workos.com/docs/authkit/next

---

**Document Version:** 1.0  
**Status:** ✅ Complete  
**Created:** November 13, 2025

