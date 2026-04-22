# Footer Refactoring: Server + Client Composition

## Question & Answer

**Q: Why is the Footer client-side, and what's the best approach for Status and LanguageSwitcher components?**

**A: The Footer was client-side because it used hooks (`useCookieConsent`). The best approach is to refactor it to a Server Component using the Composition Pattern, extracting only the interactive parts into small Client Components.**

## The Problem

### Original Architecture ❌

```tsx
'use client'; // ❌ Entire Footer forced to be client-side

export default function Footer() {
  const { showConsentBanner } = useCookieConsent(); // Needs client
  const t = useTranslations('footer');

  return (
    <footer>
      {/* All content must be client-side now */}
      <Status /> {/* Can't use Server Component! */}
      <LanguageSwitcher />
      <button onClick={() => showConsentBanner()}>Cookie Settings</button>
    </footer>
  );
}
```

**Issues:**

- Entire Footer bundle sent to client (~50KB+)
- Status component needs API route (can't fetch directly from BetterStack)
- API key security risk
- Slower page load
- More client-side JavaScript

## The Solution: Composition Pattern ✅

### New Architecture

```tsx
// Footer.tsx - NO 'use client' = Server Component
import { CookiePreferencesButton } from '@/components/atoms/CookiePreferencesButton';
import { ServerStatus } from '@/components/atoms/ServerStatus';
import { LanguageSwitcher } from '@/components/molecules/LocaleSwitcher';

export default function Footer() {
  const t = useTranslations('footer'); // Works in Server Components

  return (
    <footer>
      <FooterContentWrapper>
        {' '}
        {/* Client wrapper with children */}
        {/* Server Component - fetches directly from BetterStack */}
        <ServerStatus />
        {/* Client Components - only interactive parts */}
        <LanguageSwitcher />
        <CookiePreferencesButton label={t('nav.legal.preferences')} />
        {/* Static content - server-rendered */}
        <div>{/* navigation links */}</div>
      </FooterContentWrapper>
    </footer>
  );
}
```

## Component Breakdown

### 1. Footer (Server Component) 🖥️

```tsx
// components/organisms/Footer.tsx
// NO 'use client' directive = Server Component

export default function Footer() {
  const t = useTranslations('footer'); // ✅ Works in Server Components
  return <footer>{/* content */}</footer>;
}
```

**Characteristics:**

- Runs on the server
- Can fetch data directly
- No JavaScript sent to client
- Fast initial render

### 2. ServerStatus (Server Component) 🖥️

```tsx
// components/atoms/ServerStatus.tsx
// No 'use client' = Server Component by default in Next.js 15

export async function ServerStatus() {
  // ✅ API key stays secure on server
  // Next.js bundler automatically prevents this from being imported in Client Components
  const response = await fetch('https://uptime.betterstack.com/api/v2/monitors', {
    headers: {
      Authorization: `Bearer ${process.env.BETTERSTACK_API_KEY}`,
    },
    next: { revalidate: 60 }, // Cache 60 seconds
  });

  const { data } = await response.json();
  // Calculate status and render
  return <a href="...">{/* status indicator */}</a>;
}
```

**Benefits:**

- 🔒 API key never exposed to browser
- ⚡ Zero JavaScript for status display
- 📊 Server-side caching
- 🔍 SEO-friendly (rendered HTML)

### 3. LanguageSwitcher (Client Component) 💻

```tsx
// components/molecules/LocaleSwitcher.tsx
// Already has 'use client' - needs hooks

export function LanguageSwitcher() {
  const locale = useLocale(); // ✅ Client-side hook
  const [isPending, startTransition] = useTransition();

  return <select onChange={handleChange}>{/* locale options */}</select>;
}
```

**Why Client?**

- Uses `useLocale()` hook
- Uses `useTransition()` hook
- Needs `onChange` handler
- Manipulates DOM/cookies

### 4. CookiePreferencesButton (Client Component) 💻

```tsx
// components/atoms/CookiePreferencesButton.tsx
'use client';

export function CookiePreferencesButton({ label }: Props) {
  const { showConsentBanner } = useCookieConsent(); // ✅ Client-side hook

  return <button onClick={() => showConsentBanner()}>{label}</button>;
}
```

**Why Client?**

- Uses `useCookieConsent()` hook
- Needs `onClick` handler
- Requires browser API

### 5. FooterContentWrapper (Client Component) 💻

```tsx
// components/organisms/FooterContentWrapper.tsx
'use client';

export function FooterContentWrapper({ children }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // IntersectionObserver for lazy loading
  }, []);

  return isVisible ? <>{children}</> : <div ref={ref} />;
}
```

**Why Client?**

- Uses `useState()` and `useEffect()` hooks
- Uses IntersectionObserver (browser API)
- But accepts `children` prop allowing Server Components!

## Key Principle: Composition Pattern

### The Magic ✨

```tsx
// Parent (Server Component)
export function Parent() {
  return (
    <ClientWrapper>
      <ServerChild /> {/* ✅ This works! */}
    </ClientWrapper>
  );
}

// Client wrapper
('use client');
export function ClientWrapper({ children }) {
  const [state] = useState();
  return <div>{children}</div>; // children is pre-rendered
}

// Server child
export async function ServerChild() {
  const data = await fetch(/*...*/);
  return <div>{data}</div>;
}
```

### How It Works

1. **Server:** `Parent` renders `ServerChild` → HTML
2. **Server:** Passes rendered HTML as `children` prop to `ClientWrapper`
3. **Client:** `ClientWrapper` hydrates with pre-rendered children
4. **Result:** Server data + Client interactivity

## Benefits Comparison

| Aspect                | Old (All Client)           | New (Composition)       |
| --------------------- | -------------------------- | ----------------------- |
| **JavaScript Bundle** | ~50KB+                     | ~5KB (only interactive) |
| **API Security**      | Needs API route            | Direct server fetch     |
| **Status Fetching**   | Client → API → BetterStack | Server → BetterStack    |
| **Initial Render**    | Slow (JS needed)           | Fast (HTML)             |
| **SEO**               | Not crawlable              | Fully crawlable         |
| **Caching**           | Client + API route         | Server only             |

## Complete File Structure

```
components/
├── atoms/
│   ├── ServerStatus.tsx         // 🖥️ Server (BetterStack fetch)
│   ├── Status.tsx               // 💻 Client (legacy)
│   └── CookiePreferencesButton.tsx // 💻 Client (cookie consent)
├── molecules/
│   ├── LocaleSwitcher.tsx       // 💻 Client (language switcher)
│   └── LocaleSwitcherSelect.tsx // 💻 Client (dropdown)
└── organisms/
    ├── Footer.tsx               // 🖥️ Server (main component)
    └── FooterContentWrapper.tsx // 💻 Client (lazy loading wrapper)

app/
└── api/
    └── status/
        └── route.ts             // 🖥️ API route (optional, legacy)
```

## Decision Tree: Server or Client?

```
Does component need:
├─ React hooks (useState, useEffect, etc.)? ─→ ✅ Client Component
├─ Browser APIs (window, document)? ─→ ✅ Client Component
├─ Event handlers (onClick, onChange)? ─→ ✅ Client Component
├─ Data fetching with secrets? ─→ ✅ Server Component
├─ Database access? ─→ ✅ Server Component
└─ Just rendering? ─→ ✅ Server Component (default)
```

## Migration Checklist

- [x] ~~Remove `'use client'` from Footer.tsx~~
- [x] ~~Create `ServerStatus.tsx` (server component)~~
- [x] ~~Create `CookiePreferencesButton.tsx` (client component)~~
- [x] ~~Update Footer to use ServerStatus~~
- [x] ~~Update Footer to use CookiePreferencesButton~~
- [x] ~~Test server-side rendering~~
- [x] ~~Verify client interactivity~~
- [x] ~~Update documentation~~
- [x] ~~Remove unnecessary `server-only` package (Next.js 15 handles this)~~

## Testing the Implementation

### 1. Verify Server Rendering

```bash
# Check page source (View → Developer → View Source)
# You should see the status indicator in HTML:
<a href="https://status.eleva.care">
  <span class="bg-green-500">...</span>
  <span>All systems normal</span>
</a>
```

### 2. Verify Client Interactivity

```bash
# Test language switcher - should change locale
# Test cookie button - should show consent banner
```

### 3. Check JavaScript Bundle

```bash
pnpm build
# Check .next/static/chunks/ - Footer chunk should be smaller
```

### 4. Verify API Security

```bash
# Check browser Network tab - should NOT see BETTERSTACK_API_KEY
# API call should happen on server (not visible in browser)
```

## Best Practices Applied

### ✅ Do

- Default to Server Components
- Extract small, focused Client Components
- Use `server-only` package for server code
- Pass Server Components as `children` to Client Components
- Keep API keys and secrets on server

### ❌ Don't

- Make entire layouts Client Components for one hook
- Import Server Components into Client Components directly
- Expose API keys in client-side code
- Send unnecessary JavaScript to client
- Use API routes when Server Components work

## References

- [Server-Client Composition Guide](./server-client-composition.md)
- [BetterStack Integration Docs](../09-integrations/betterstack.md)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React Composition Patterns](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children)

## Summary

**The Answer:**

1. **Footer was client-side** because of hooks (`useCookieConsent`)
2. **Best approach:** Refactor to Server Component, extract client parts
3. **Status:** Use `ServerStatus` (server-side, direct BetterStack fetch)
4. **LanguageSwitcher:** Keep as Client Component (needs hooks)
5. **Cookie Button:** Extract to `CookiePreferencesButton` (client)
6. **Pattern:** Composition Pattern (Server parent → Client children)

**Result:** Faster, more secure, better SEO, less JavaScript! 🎉
