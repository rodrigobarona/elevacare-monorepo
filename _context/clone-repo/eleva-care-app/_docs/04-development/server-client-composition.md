# Server and Client Component Composition Pattern

## Overview

This document explains the architectural pattern used in Eleva Care for composing Server and Client Components, specifically demonstrated in the Footer component refactoring.

## The Challenge

In Next.js App Router, you cannot directly render Server Components inside Client Components. However, many UI components need a mix of server-side data fetching and client-side interactivity.

### Initial Problem: Footer Component

The Footer originally looked like this:

```tsx
'use client'; // ❌ Forced entire Footer to be client-side

export default function Footer() {
  const { showConsentBanner } = useCookieConsent(); // Needs client
  // ... rest of footer
}
```

**Problems:**

1. Entire Footer must be client-side due to one hook
2. Cannot use Server Components for data fetching
3. API keys must be exposed through API routes
4. Unnecessary client-side JavaScript

## The Solution: Composition Pattern

The solution is to use the **Composition Pattern** (also called the "Slots Pattern"):

### Key Principle

> **You CAN pass Server Components as `children` or props to Client Components**

This works because:

1. React Server Components are pre-rendered on the server
2. The rendered output is passed as props to Client Components
3. Client Components don't "see" the Server Component code

## Implementation

### Architecture Diagram

```text
Footer (Server Component)
├── FooterContentWrapper (Client Component - lazy loading)
│   └── children prop contains:
│       ├── ServerStatus (Server Component - BetterStack API)
│       ├── LanguageSwitcher (Client Component - locale switching)
│       ├── CookiePreferencesButton (Client Component - cookie consent)
│       └── Static Content (Server-rendered)
```

### 1. Server Components

#### Footer (Main Container - Server)

```tsx
// components/organisms/Footer.tsx
// NO 'use client' directive = Server Component by default
import { CookiePreferencesButton } from '@/components/atoms/CookiePreferencesButton';
import { ServerStatus } from '@/components/atoms/ServerStatus';
import { LanguageSwitcher } from '@/components/molecules/LocaleSwitcher';

export default function Footer() {
  const t = useTranslations('footer'); // Works in Server Components

  return (
    <footer>
      <FooterContentWrapper>
        {' '}
        {/* Client wrapper */}
        {/* Server Component - fetches directly from BetterStack */}
        <ServerStatus />
        {/* Client Components - for interactivity */}
        <LanguageSwitcher />
        <CookiePreferencesButton label={t('nav.legal.preferences')} />
        {/* Static content - server-rendered */}
        <div>...</div>
      </FooterContentWrapper>
    </footer>
  );
}
```

#### ServerStatus (Data Fetching - Server)

```tsx
// components/atoms/ServerStatus.tsx
// No 'use client' directive = Server Component by default in Next.js 15

export async function ServerStatus() {
  // API key stays secure on the server
  // Next.js bundler automatically prevents this from being imported in Client Components
  const response = await fetch('https://uptime.betterstack.com/api/v2/monitors', {
    headers: {
      Authorization: `Bearer ${process.env.BETTERSTACK_API_KEY}`,
    },
    next: { revalidate: 60 },
  });

  // ... process and render
}
```

### 2. Client Components (Small & Focused)

#### LanguageSwitcher

```tsx
// components/molecules/LocaleSwitcher.tsx
// Already client-side - uses hooks for locale switching

export function LanguageSwitcher() {
  const locale = useLocale(); // Client-side hook
  // ... locale switching logic
}
```

#### CookiePreferencesButton

```tsx
// components/atoms/CookiePreferencesButton.tsx
'use client';

export function CookiePreferencesButton({ label }: Props) {
  const { showConsentBanner } = useCookieConsent(); // Client-side hook

  return <button onClick={() => showConsentBanner()}>{label}</button>;
}
```

### 3. Client Wrapper (Composition Enabler)

#### FooterContentWrapper

```tsx
// components/organisms/FooterContentWrapper.tsx
'use client';

export function FooterContentWrapper({ children }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  // IntersectionObserver logic for lazy loading

  return isVisible ? <>{children}</> : <div ref={ref} />;
}
```

## How It Works

### Rendering Flow

```text
1. Server Request
   └─> Footer (Server Component)
       ├─> ServerStatus: Fetches from BetterStack API (server-side)
       │   Result: HTML with status indicator
       │
       ├─> Translate static text (server-side)
       │   Result: Localized HTML
       │
       └─> Renders to HTML tree

2. HTML Sent to Client
   └─> FooterContentWrapper hydrates (client-side)
       ├─> Receives pre-rendered children
       ├─> LanguageSwitcher hydrates (adds interactivity)
       └─> CookiePreferencesButton hydrates (adds interactivity)

3. User Interaction
   └─> Only Client Components respond
       ├─> Language change: LanguageSwitcher
       └─> Cookie settings: CookiePreferencesButton
```

## Benefits

### 1. **Security** 🔒

```tsx
// ✅ API key never leaves the server
export async function ServerStatus() {
  const response = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${process.env.BETTERSTACK_API_KEY}` }
  });
}

// ❌ API key exposed to client
'use client';
export function ClientStatus() {
  // Would need to use public API route
  const response = await fetch('/api/status');
}
```

### 2. **Performance** ⚡

**Server Component Benefits:**

- Zero JavaScript sent to client
- Data fetched on server (faster database/API access)
- Can use caching at server level

**Client Component Benefits:**

- Small bundle size (only interactive parts)
- Hydration only where needed
- Fast Time to Interactive (TTI)

**Comparison:**

| Approach    | JavaScript Bundle      | API Calls                   | Security         |
| ----------- | ---------------------- | --------------------------- | ---------------- |
| All Client  | 50KB+                  | Browser → API → BetterStack | API route needed |
| Composition | 5KB (only interactive) | Server → BetterStack        | Direct, secure   |

### 3. **Maintainability** 🔧

```tsx
// Clear separation of concerns
Footer (Server)
├── Data fetching: ServerStatus (Server)
├── Interactivity: LanguageSwitcher (Client)
└── Static content: (Server)
```

Each component has a single responsibility and clear boundaries.

### 4. **Better User Experience** 🎨

- Faster initial page load (less JavaScript)
- Progressive enhancement (content visible even if JS fails)
- SEO-friendly (status rendered on server)

## Best Practices

### 1. Default to Server Components

```tsx
// ✅ Server Component by default
export function MyComponent() {
  // ...
}

// Only add 'use client' when needed
('use client');
export function InteractiveComponent() {
  const [state] = useState(); // Needs client
}
```

### 2. Extract Client Parts

```tsx
// ❌ Bad: Entire component is client-side
'use client';
export function Form() {
  const [value, setValue] = useState('');
  return (
    <form>
      <ServerData /> {/* Can't use Server Components here! */}
      <input value={value} onChange={e => setValue(e.target.value)} />
    </form>
  );
}

// ✅ Good: Only interactive part is client-side
export function Form() {
  return (
    <form>
      <ServerData /> {/* Server Component */}
      <ClientInput /> {/* Client Component */}
    </form>
  );
}

'use client';
function ClientInput() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}
```

### 3. Rely on Next.js 15 Bundler

In Next.js 15 App Router, Server Components are the default and the bundler automatically prevents server-only code from being bundled in client components. You don't need the `server-only` package.

```tsx
// No 'use client' = Server Component by default
export async function ServerComponent() {
  // Next.js bundler automatically prevents this from being imported in Client Components
  const data = await fetch(/* server-only API */);
  return <div>{data}</div>;
}
```

### 4. Pass Data as Props

```tsx
// ✅ Good: Fetch in Server Component, pass to Client
export async function Page() {
  const data = await fetchData(); // Server-side
  return <ClientComponent data={data} />;
}

('use client');
function ClientComponent({ data }) {
  // Use data with client-side interactivity
}
```

## Common Patterns

### Pattern 1: Data Fetching + Interactivity

```tsx
// Server Component fetches data
export async function ProductList() {
  const products = await db.product.findMany();

  return (
    <div>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// Client Component adds interactivity
('use client');
function ProductCard({ product }) {
  const [isLiked, setIsLiked] = useState(false);
  return (
    <div>
      <h3>{product.name}</h3>
      <button onClick={() => setIsLiked(!isLiked)}>{isLiked ? '❤️' : '🤍'}</button>
    </div>
  );
}
```

### Pattern 2: Wrapper + Children Composition

```tsx
// Client wrapper for layout/effects
'use client';
export function AnimatedWrapper({ children }) {
  const controls = useAnimation();
  return <motion.div animate={controls}>{children}</motion.div>;
}

// Server children with data
export function Page() {
  return (
    <AnimatedWrapper>
      <ServerData /> {/* Fetches on server */}
    </AnimatedWrapper>
  );
}
```

### Pattern 3: Conditional Client Components

```tsx
// Server Component decides what to render
export async function Dashboard() {
  const user = await getUser();

  return (
    <div>
      <h1>Welcome {user.name}</h1>
      {user.isPremium ? (
        <PremiumFeatures /> // Client Component
      ) : (
        <UpgradePrompt /> // Server Component
      )}
    </div>
  );
}
```

## Troubleshooting

### Error: "You're importing a component that needs server-only"

```text
✗ ./components/ServerComponent.tsx
  You're importing a component that needs "server-only"
```

**Cause:** Trying to import a Server Component into a Client Component

**Solution:** Use composition pattern instead:

```tsx
// ❌ Bad
'use client';

import { ServerComponent } from './ServerComponent';

// ❌ Bad

// ❌ Bad

// ❌ Bad

// ❌ Bad

// ❌ Bad
// Error!

// ✅ Good
export function Parent() {
  return (
    <ClientWrapper>
      <ServerComponent /> {/* Passed as children */}
    </ClientWrapper>
  );
}
```

### Error: "useXxx is not defined"

```text
✗ ReferenceError: useState is not defined
```

**Cause:** Using React hooks in a Server Component

**Solution:** Add `'use client'` directive or move hook to client component

```tsx
// ❌ Bad
export function Component() {
  const [state] = useState(); // Error!
}

// ✅ Good
'use client';
export function Component() {
  const [state] = useState(); // Works!
}
```

## References

- [Next.js Server Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Composition Pattern in React](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children)

## Examples in Eleva Care

- **Footer**: Mix of server data fetching and client interactivity
- **Status Component**: Server-side BetterStack API integration
- **Language Switcher**: Client-side locale management
- **Cookie Consent**: Client-side cookie banner management
