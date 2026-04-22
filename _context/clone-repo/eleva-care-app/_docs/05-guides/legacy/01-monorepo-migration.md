# Eleva Care Monorepo Migration Plan

## Overview

This document outlines our comprehensive plan to migrate the Eleva Care application from its current Next.js App Router structure to a Turborepo monorepo architecture. The migration will enhance code organization, reusability, and maintainability while addressing specific constraints like Clerk's single-domain limitation in the free tier.

## Current Architecture

The Eleva Care application currently follows a Next.js 15.3 App Router structure with route groups:

- **`/app/[locale]/(public)`**: Marketing website and public-facing pages
- **`/app/[locale]/(auth)`**: Authentication flows powered by Clerk
- **`/app/(private)`**: Protected application features including:
  - Account management
  - Appointments module
  - Booking system
  - Admin dashboard

### Key Technical Components

1. **Authentication**: Clerk.com with custom localization
2. **Internationalization**: next-intl with localized routes
3. **Database**: Neon.tech PostgreSQL with Drizzle ORM
4. **Background Processing**: Upstash QStash
5. **Payments**: Stripe integration (Connect, Identity)
6. **Authorization**: Custom role-based permission system

## Target Monorepo Architecture

### Repository Structure

```
eleva-care/
├── apps/
│   ├── marketing/       # Marketing site ([locale]/(public))
│   ├── portal/          # Main application ((private))
│   ├── auth/            # Authentication flows ([locale]/(auth))
│   ├── admin/           # Admin dashboard
│   └── docs/            # Documentation site
├── packages/
│   ├── ui/              # Shared UI components
│   ├── config/          # Shared configs (eslint, typescript, etc.)
│   ├── auth/            # Auth utilities and hooks
│   ├── database/        # Database schema and utilities
│   ├── api/             # Shared API utilities
│   └── i18n/            # Internationalization utilities
├── tooling/             # Developer tooling
│   ├── eslint/
│   └── typescript/
└── turbo.json
```

### Path-Based Routing Solution

To address Clerk's single-domain limitation, we'll implement a path-based routing approach where all applications are deployed under the same domain:

```
eleva-care.com/             → Marketing site
eleva-care.com/portal/      → Main application
eleva-care.com/auth/        → Auth flows
eleva-care.com/admin/       → Admin dashboard
eleva-care.com/docs/        → Documentation
```

## Implementation Details

### 1. Turborepo Setup

First, we'll set up Turborepo to manage our workspace:

```bash
# Install Turborepo
npm install turbo --global

# Create the monorepo structure
mkdir -p eleva-care/{apps,packages,tooling}

# Initialize Turborepo
cd eleva-care
pnpm init
pnpm add turbo -D
```

**turbo.json configuration:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Root package.json:**

```json
{
  "name": "eleva-care",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*", "tooling/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "clean": "turbo run clean",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "prettier": "^3.5.3",
    "turbo": "latest"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "packageManager": "pnpm@8.6.10"
}
```

### 2. Shared Packages Implementation

#### UI Package

The UI package will contain shared components used across all applications:

```bash
mkdir -p packages/ui/{src,types}
```

**packages/ui/package.json:**

```json
{
  "name": "@eleva/ui",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "license": "MIT",
  "files": ["dist/**"],
  "scripts": {
    "build": "tsup src/index.tsx --format esm,cjs --dts --external react",
    "dev": "tsup src/index.tsx --format esm,cjs --watch --dts --external react",
    "lint": "eslint \"src/**/*.ts*\"",
    "clean": "rm -rf .turbo && rm -rf node_modules && rm -rf dist"
  },
  "devDependencies": {
    "@eleva/eslint-config": "workspace:*",
    "@eleva/typescript-config": "workspace:*",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "eslint": "^9.25.1",
    "react": "^19.1.0",
    "tsup": "^8.0.1",
    "typescript": "^5.8.3"
  }
}
```

Example component:

```tsx
// packages/ui/src/button/button.tsx
import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "destructive" | "outline-solid";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    // Implementation from your current Button component
    return (
      <button
        className={/* classes based on variant and size */}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

Export components:

```tsx
// packages/ui/src/index.tsx
export * from './button/button';
// Export other components
```

#### Database Package

The database package will contain your database schema and utilities:

```bash
mkdir -p packages/database/src
```

**packages/database/package.json:**

```json
{
  "name": "@eleva/database",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "license": "MIT",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --watch --dts",
    "lint": "eslint \"src/**/*.ts*\"",
    "clean": "rm -rf .turbo && rm -rf node_modules && rm -rf dist",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "push": "drizzle-kit push",
    "studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "drizzle-orm": "^0.35.3",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "@eleva/eslint-config": "workspace:*",
    "@eleva/typescript-config": "workspace:*",
    "drizzle-kit": "^0.26.2",
    "eslint": "^9.25.1",
    "tsup": "^8.0.1",
    "typescript": "^5.8.3"
  }
}
```

Example implementation:

```typescript
// packages/database/src/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Re-export schema and models
export * from './schema';
export * from './models';

// Export DB client factory
export function createDbClient(url?: string) {
  const connectionString = url || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return drizzle(neon(connectionString));
}
```

```typescript
// packages/database/src/schema/users.ts
import { boolean, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true),
});

// Define relationships and other schema elements
```

#### Auth Package

The auth package will contain Clerk integration and authentication utilities:

```bash
mkdir -p packages/auth/src
```

**packages/auth/package.json:**

```json
{
  "name": "@eleva/auth",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "license": "MIT",
  "scripts": {
    "build": "tsup src/index.tsx --format esm,cjs --dts --external react",
    "dev": "tsup src/index.tsx --format esm,cjs --watch --dts --external react",
    "lint": "eslint \"src/**/*.ts*\"",
    "clean": "rm -rf .turbo && rm -rf node_modules && rm -rf dist"
  },
  "dependencies": {
    "@clerk/nextjs": "^6.18.0",
    "@clerk/localizations": "^3.15.2"
  },
  "devDependencies": {
    "@eleva/eslint-config": "workspace:*",
    "@eleva/typescript-config": "workspace:*",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "eslint": "^9.25.1",
    "react": "^19.1.0",
    "tsup": "^8.0.1",
    "typescript": "^5.8.3"
  },
  "peerDependencies": {
    "react": "^19.1.0"
  }
}
```

Example implementation:

```tsx
// packages/auth/src/clerk-provider.tsx
import { enUS, esES, ptBR, ptPT } from '@clerk/localizations';
import { ClerkProvider as BaseClerkProvider } from '@clerk/nextjs';
import { ReactNode } from 'react';

type LocalizationKey = 'en' | 'es' | 'pt' | 'pt-BR';

interface ElevaClerkProviderProps {
  locale?: string;
  children: ReactNode;
}

export function ElevaClerkProvider({ locale = 'en', children }: ElevaClerkProviderProps) {
  // Mapping function similar to your current implementation
  const getLocalization = (locale: string) => {
    const localizationMap: Record<string, typeof enUS> = {
      en: enUS,
      pt: ptPT,
      es: esES,
      'pt-BR': ptBR,
    };

    return localizationMap[locale as LocalizationKey];
  };

  return (
    <BaseClerkProvider
      localization={getLocalization(locale)}
      signInUrl="/auth/sign-in"
      signUpUrl="/auth/sign-up"
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      {children}
    </BaseClerkProvider>
  );
}
```

```typescript
// packages/auth/src/index.tsx
export * from './clerk-provider';
export * from './hooks';
export * from './utils';
```

#### i18n Package

The i18n package will handle internationalization utilities:

```bash
mkdir -p packages/i18n/{src,locales}
```

**packages/i18n/package.json:**

```json
{
  "name": "@eleva/i18n",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "license": "MIT",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --watch --dts",
    "lint": "eslint \"src/**/*.ts*\"",
    "clean": "rm -rf .turbo && rm -rf node_modules && rm -rf dist"
  },
  "dependencies": {
    "next-intl": "^4.1.0"
  },
  "devDependencies": {
    "@eleva/eslint-config": "workspace:*",
    "@eleva/typescript-config": "workspace:*",
    "eslint": "^9.25.1",
    "tsup": "^8.0.1",
    "typescript": "^5.8.3"
  }
}
```

Example implementation:

```typescript
// packages/i18n/src/index.ts
export * from './routing';
export * from './navigation';
export * from './utils';

// Re-export locale files
export * from './locales';
```

```typescript
// packages/i18n/src/routing.ts
import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'es', 'pt', 'pt-BR'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale = 'en' as const;

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  // We'll adapt the pathnames for our path-based routing approach
  pathnames: {
    '/': '/',
    '/about': '/about',
    '/portal': '/portal',
    '/portal/dashboard': '/portal/dashboard',
    '/auth/sign-in': '/auth/sign-in',
    '/auth/sign-up': '/auth/sign-up',
    // ... other paths
  },
});
```

### 3. Application Implementation

#### Marketing App

```bash
mkdir -p apps/marketing/app
```

**apps/marketing/package.json:**

```json
{
  "name": "marketing",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "clean": "rm -rf .next && rm -rf .turbo && rm -rf node_modules"
  },
  "dependencies": {
    "@eleva/auth": "workspace:*",
    "@eleva/database": "workspace:*",
    "@eleva/ui": "workspace:*",
    "@eleva/i18n": "workspace:*",
    "next": "15.3.1",
    "next-intl": "^4.1.0",
    "next-themes": "^0.4.6",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@eleva/eslint-config": "workspace:*",
    "@eleva/typescript-config": "workspace:*",
    "@types/node": "^22.15.2",
    "@types/react": "19.0.10",
    "@types/react-dom": "19.0.4",
    "eslint": "^9.25.1",
    "typescript": "^5.8.3"
  }
}
```

**apps/marketing/app/[locale]/layout.tsx:**

```tsx
import { ElevaClerkProvider } from '@eleva/auth';
import { IntlProvider } from '@eleva/i18n';
import { locales } from '@eleva/i18n';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate locale
  const isValidLocale = locales.includes(locale as any);
  if (!isValidLocale) notFound();

  // Load messages
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <ElevaClerkProvider locale={locale}>
      <IntlProvider locale={locale} messages={messages}>
        {children}
      </IntlProvider>
    </ElevaClerkProvider>
  );
}
```

#### Auth App

```bash
mkdir -p apps/auth/app
```

**apps/auth/next.config.js:**

```js
const { withNextIntl } = require('next-intl/plugin');

module.exports = withNextIntl()({
  basePath: '/auth',
  transpilePackages: ['@eleva/ui', '@eleva/database', '@eleva/auth', '@eleva/i18n'],
  // ... other config
});
```

**apps/auth/app/[locale]/layout.tsx:**

```tsx
import { ElevaClerkProvider } from '@eleva/auth';
import { IntlProvider } from '@eleva/i18n';
import { locales } from '@eleva/i18n';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate locale
  const isValidLocale = locales.includes(locale as any);
  if (!isValidLocale) notFound();

  // Load messages
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <ElevaClerkProvider locale={locale}>
      <IntlProvider locale={locale} messages={messages}>
        {children}
      </IntlProvider>
    </ElevaClerkProvider>
  );
}
```

**apps/auth/app/[locale]/sign-in/[[...sign-in]]/page.tsx:**

```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none rounded-none',
            cardBox: 'shadow-none rounded-none',
            footer: 'bg-transparent',
          },
        }}
      />
    </div>
  );
}
```

#### Portal App (Main Application)

```bash
mkdir -p apps/portal/app
```

**apps/portal/next.config.js:**

```js
module.exports = {
  basePath: '/portal',
  transpilePackages: ['@eleva/ui', '@eleva/database', '@eleva/auth', '@eleva/i18n'],
  // ... other config
};
```

**apps/portal/app/layout.tsx:**

```tsx
import { auth } from '@clerk/nextjs/server';
import { ElevaClerkProvider } from '@eleva/auth';
import { ThemeProvider } from 'next-themes';
import { redirect } from 'next/navigation';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Check authentication
  const { userId } = await auth();
  if (!userId) {
    redirect('/auth/sign-in');
  }

  return (
    <ElevaClerkProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </ElevaClerkProvider>
  );
}
```

### 4. Deployment Configuration with Vercel

**vercel.json for path-based routing:**

```json
{
  "buildCommand": "turbo run build",
  "ignoreCommand": "turbo run lint",
  "installCommand": "pnpm install",
  "rewrites": [
    { "source": "/", "destination": "/marketing" },
    { "source": "/marketing/:path*", "destination": "/marketing/:path*" },
    { "source": "/portal/:path*", "destination": "/portal/:path*" },
    { "source": "/auth/:path*", "destination": "/auth/:path*" },
    { "source": "/admin/:path*", "destination": "/admin/:path*" },
    { "source": "/docs/:path*", "destination": "/docs/:path*" }
  ]
}
```

## Migration Strategy

### Phase 1: Setup and Shared Packages

1. Initialize Turborepo structure
2. Create essential shared packages:
   - `@eleva/ui`
   - `@eleva/database`
   - `@eleva/auth`
   - `@eleva/i18n`
3. Develop and test shared packages within the current monolithic app

### Phase 2: Marketing App Migration

1. Create the marketing app from the `(public)` routes
2. Configure path-based routing in Vercel
3. Ensure the main site continues to work during transition

### Phase 3: Auth App Migration

1. Extract authentication flows to the dedicated auth app
2. Update routing and Clerk configuration
3. Test authentication flows thoroughly

### Phase 4: Portal App Migration

1. Migrate the main application features to the portal app
2. Connect with shared packages
3. Implement cross-app communication

### Phase 5: Additional Apps Development

1. Create admin dashboard app
2. Develop documentation site
3. Build specialized applications (help desk, etc.)

## Clerk Integration with Path-Based Routing

The key to making Clerk work with our path-based routing is proper configuration:

1. Register your primary domain in Clerk dashboard (eleva-care.com)
2. Configure paths in Clerk dashboard:
   - Sign-in URL: `/auth/sign-in`
   - Sign-up URL: `/auth/sign-up`
   - After sign-in URL: `/portal/dashboard`
   - After sign-up URL: `/portal/dashboard`

3. Implement Clerk middleware to handle authentication across paths:

```typescript
// middleware.ts (root of monorepo)
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: [
    '/', // Home page
    '/about', // About page
    '/auth/sign-in', // Sign-in page
    '/auth/sign-up', // Sign-up page
    '/auth/.*', // All auth routes
    '/api/.*', // All API routes
    // Add any other public routes
  ],
  ignoredRoutes: [
    '/api/webhooks/.*', // Webhook endpoints
  ],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

## Internationalization with Path-Based Routing

For internationalization across our path-based apps:

1. Implement shared locale detection in the `@eleva/i18n` package
2. Update routing configuration to support path-based approach:

```typescript
// packages/i18n/src/routing.ts
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  pathnames: {
    // Marketing paths
    '/': '/',
    '/about': '/about',

    // Auth paths
    '/auth/sign-in': '/auth/sign-in',
    '/auth/sign-up': '/auth/sign-up',

    // Portal paths
    '/portal/dashboard': '/portal/dashboard',
    // ... more paths
  },
});
```

3. Ensure cookie-based locale persistence works across all apps:

```typescript
// packages/i18n/src/locale-utils.ts
export function setLocaleCookie(locale: string) {
  document.cookie = `ELEVA_LOCALE=${locale};max-age=31536000;path=/`;
}

export function getLocaleFromCookie(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'ELEVA_LOCALE') {
      return value;
    }
  }
  return null;
}
```

## Conclusion

This monorepo migration plan with path-based routing provides a comprehensive approach to evolve the Eleva Care architecture while working within constraints like Clerk's single-domain limitation. The structure enables:

1. **Better code organization** through specialized packages and apps
2. **Improved developer experience** with Turborepo's efficient build system
3. **Code reusability** across different parts of the application
4. **Maintainable architecture** that can scale as the product grows

The path-based routing approach allows us to deploy multiple Next.js applications under a single domain, maintaining a cohesive user experience while benefiting from the development advantages of a monorepo structure.
