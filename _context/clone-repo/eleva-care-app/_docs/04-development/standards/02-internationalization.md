# Internationalization (i18n) in Eleva Care App

> **Updated**: January 2026  
> **Framework**: next-intl with Next.js 16

This guide explains how to use internationalization in the Eleva Care app with Next.js 16 and next-intl.

## Directory Structure

Our app follows a locale-based structure for public routes and uses cookie-based locale detection for authenticated routes:

```
src/
├── app/
│   ├── [locale]/              # Dynamic locale segment (public routes)
│   │   ├── layout.tsx         # Root layout with NextIntlClientProvider
│   │   ├── page.tsx           # Root page for each locale
│   │   ├── (public)/          # Public section within each locale
│   │   │   ├── layout.tsx
│   │   │   └── about/
│   │   └── (auth)/            # Auth section
│   │       └── layout.tsx
│   └── (app)/                 # Authenticated routes (no locale in URL)
│       ├── layout.tsx         # PrivateLayout with IntlProvider
│       ├── dashboard/
│       └── account/
└── lib/
    └── i18n/
        ├── routing.ts         # Route configuration
        └── navigation.ts      # Localized navigation helpers
```

## Key Components

1. **Routing Configuration**
   - Defined in `i18n/routing.ts`
   - Uses `defineRouting` from next-intl

2. **Navigation Utilities**
   - Defined in `i18n/navigation.ts`
   - Provides localized `Link`, `redirect`, and other navigation helpers

3. **Middleware**
   - Configured in `middleware.ts`
   - Combines next-intl with Clerk for authentication

## Translation Usage

### Client Components

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('MyNamespace');

  return <h1>{t('title')}</h1>;
}
```

### Server Components

```tsx
import { useTranslations } from 'next-intl';

export default function MyServerComponent() {
  const t = useTranslations('MyNamespace');

  return <h1>{t('title')}</h1>;
}
```

### Redirecting

```tsx
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';

export default async function MyPage() {
  const locale = await getLocale();

  // Redirect while preserving locale
  redirect('/dashboard');
}
```

### Link Component

```tsx
import { Link } from '@/i18n/navigation';

export default function MyComponent() {
  return <Link href="/about">About Us</Link>;
}
```

## Translation Files

Translation files are located in the `messages/` directory:

- `messages/en.json` - English translations
- `messages/es.json` - Spanish translations
- `messages/pt.json` - Portuguese translations
- `messages/br.json` - Brazilian Portuguese translations

## Adding a New Page

1. Create the page file in all locale directories
2. Add translations to all message files
3. Use the appropriate translation keys in your components

## Authenticated Routes (PrivateLayout)

For authenticated routes under `(app)/`, we use a different approach since the URL doesn't include the locale segment:

### How It Works

1. User's locale preference is stored in the `ELEVA_LOCALE` cookie
2. `PrivateLayout` reads this cookie on the server
3. Messages are loaded using `getMessages({ locale })`
4. `IntlProvider` wraps all authenticated content

### Implementation

```tsx
// src/app/(app)/layout.tsx
import { IntlProvider } from '@/app/providers';
import { defaultLocale } from '@/lib/i18n/routing';
import { getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  // Get locale from cookie or use default
  const cookieStore = await cookies();
  const locale = cookieStore.get('ELEVA_LOCALE')?.value || defaultLocale;

  // Load messages for the detected locale
  const messages = await getMessages({ locale });

  return (
    <IntlProvider locale={locale} messages={messages}>
      {/* ... rest of layout */}
      {children}
    </IntlProvider>
  );
}
```

### Setting the Locale Cookie

The locale cookie should be set when:

- User changes language preference in settings
- User logs in (sync with their profile preference)
- User first visits (detect from browser or IP)

```typescript
// Example: Setting locale in a Server Action
'use server';

import { cookies } from 'next/headers';

export async function setUserLocale(locale: string) {
  const cookieStore = await cookies();
  cookieStore.set('ELEVA_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
```

## Using with WorkOS Authentication

The proxy.ts (middleware) handles both internationalization and authentication:

1. next-intl middleware processes locale routing for public pages
2. WorkOS AuthKit handles authentication
3. Authenticated routes use cookie-based locale detection

This ensures proper locale preservation during authentication flows.

## Debug Checklist

If you're experiencing issues with internationalization:

1. Check that the locale segment is included in the URL
2. Ensure translations exist in the appropriate message file
3. Verify that components are using the correct translation namespace
4. Check that navigation is using the `Link` component from `@/i18n/navigation`
5. Use `getLocale()` in server components when redirecting
