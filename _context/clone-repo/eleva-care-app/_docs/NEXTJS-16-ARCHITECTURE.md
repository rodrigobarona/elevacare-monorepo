# Next.js 16 Project Architecture Best Practices

Based on official Next.js 16 documentation and Context7 research.

## ✅ Correct Folder Structure

```
project-root/
├── app/                    # Next.js App Router (routes ONLY)
│   ├── (auth)/            # Route groups
│   ├── (private)/         # Protected routes
│   ├── [locale]/          # Dynamic routes
│   ├── api/               # API routes
│   ├── fonts/             # ✅ Font files (Next.js optimization)
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
│
├── lib/                   # Shared utilities & business logic
│   ├── auth/             # Authentication utilities
│   ├── cache/            # Caching utilities
│   ├── constants/        # Application constants
│   ├── integrations/     # Third-party integrations
│   ├── notifications/    # Notification utilities
│   ├── redis/            # Redis utilities
│   ├── seo/              # SEO utilities
│   ├── utils/            # General utilities
│   └── validations/      # Zod schemas
│
├── server/                # Server-only code
│   ├── actions/          # Server Actions
│   ├── db/               # Database utilities
│   └── *.ts              # Server utilities
│
├── components/            # Reusable UI components
│   ├── features/         # Feature-specific components
│   ├── layout/           # Layout components
│   ├── shared/           # Shared components
│   └── ui/               # shadcn/ui components
│
├── public/                # Static assets
│   ├── img/              # Images
│   └── *.png             # Logo files
│
├── drizzle/               # Database schema & migrations
├── config/                # Configuration files
├── types/                 # TypeScript type definitions
├── hooks/                 # React hooks
└── content/               # MDX content
```

## 🎯 Key Principles

### 1. `app/` Directory - Routes ONLY

**✅ What belongs in `app/`:**

- Route files: `page.tsx`, `layout.tsx`, `route.ts`
- Route-specific components (used only in that route)
- Special files: `loading.tsx`, `error.tsx`, `not-found.tsx`
- Fonts (for Next.js font optimization)
- Metadata files: `robots.txt`, `sitemap.ts`, `opengraph-image.tsx`

**❌ What does NOT belong in `app/`:**

- Utilities (`app/utils/` ❌)
- Constants (`app/data/` ❌)
- Business logic
- Shared components
- Helper functions

### 2. `lib/` Directory - Shared Logic

**Purpose:** All reusable code that isn't specific to a single route

**Examples:**

- `lib/utils/` - Helper functions
- `lib/integrations/novu/` - Third-party integrations
- `lib/constants/` - Application constants
- `lib/auth/` - Authentication utilities
- `lib/cache/` - Caching utilities

### 3. `server/` Directory - Server-Only Code

**Purpose:** Code that should NEVER run on the client

**Examples:**

- Server Actions
- Database queries
- Server utilities
- API helpers

### 4. `components/` Directory - UI Components

**Purpose:** Reusable React components

**Organization:**

- `components/ui/` - Basic UI primitives (shadcn/ui)
- `components/features/` - Feature-specific components
- `components/layout/` - Layout components
- `components/shared/` - Shared across features

### 5. `public/` Directory - Static Assets

**Purpose:** Publicly accessible files

**Examples:**

- Images
- Fonts (legacy - prefer `app/fonts/`)
- Favicons
- robots.txt (prefer `app/robots.txt`)

## 📚 From Next.js Documentation

### App Router Colocation

> "The App Router allows you to colocate files with routes, but only the returned content from `page.js` and `route.js` are publicly addressable."

This means you CAN put files in `app/`, but it's not recommended for shared utilities because:

- Makes it unclear what's route-specific vs shared
- Harder to import from other parts of the app
- Goes against community conventions

### Recommended Project Organization

From Next.js docs:

```
app/
  (marketing)/
    page.tsx           # Route
  (shop)/
    page.tsx           # Route
  layout.tsx           # Shared layout
  not-found.tsx        # Not found page

components/            # Shared components
  Button.tsx
  Header.tsx

lib/                   # Utilities and helpers
  utils.ts
  api.ts

styles/                # Global styles
  globals.css
```

## 🔄 Migration Summary

### What We Fixed

**Before (❌ Wrong):**

```
app/
├── utils/
│   └── novu.ts        # Novu client - 333 lines
├── data/
│   └── constants.ts   # Constants - 10 lines
└── fonts/             # ✅ Correct - keep here
```

**After (✅ Correct):**

```
lib/
├── integrations/
│   └── novu/
│       └── client.ts  # Moved from app/utils/
├── constants/
│   └── days-of-week.ts # Moved from app/data/
└── ...

app/
└── fonts/             # ✅ Stays here
```

### Files Updated

- **Moved:** 2 files to proper locations
- **Updated:** 15 import statements across codebase
- **Result:** Clear, organized structure following best practices

## 💡 Decision Tree: Where Should My Code Go?

```
Is this a route, layout, or loading state?
├─ YES → app/
└─ NO  → Is it reusable across routes?
          ├─ YES → Is it server-only?
          │        ├─ YES → server/
          │        └─ NO  → Is it UI?
          │                 ├─ YES → components/
          │                 └─ NO  → lib/
          └─ NO  → Keep colocated with route in app/
```

## 🎓 Best Practices

### 1. Route Colocation (Sometimes OK)

If a component is ONLY used in ONE route, you can colocate it:

```
app/
└── dashboard/
    ├── page.tsx
    └── DashboardChart.tsx  # Only used in this route
```

### 2. Shared Code in `lib/`

If it's used in multiple routes or is a utility:

```
lib/
└── utils/
    └── format-currency.ts  # Used across many routes
```

### 3. Server Actions in `server/`

Keep server-only code isolated:

```
server/
└── actions/
    └── create-post.ts  # Server Action
```

### 4. Components in `components/`

Reusable UI components:

```
components/
├── ui/
│   └── button.tsx      # Basic UI primitive
└── features/
    └── UserProfile.tsx # Feature component
```

## 📖 References

- **Next.js App Router Docs:** https://nextjs.org/docs/app
- **Project Organization:** https://nextjs.org/docs/app/building-your-application/routing/colocation
- **Context7 Research:** Retrieved from `/vercel/next.js` library

## ✅ Checklist for New Code

Before adding new code, ask:

- [ ] Is this a route? → `app/`
- [ ] Is this route-specific? → `app/[route]/`
- [ ] Is this reusable? → `lib/` or `components/`
- [ ] Is this server-only? → `server/`
- [ ] Is this a static asset? → `public/`
- [ ] Is this a font? → `app/fonts/`

---

**Last Updated:** November 9, 2025  
**Status:** ✅ Implemented  
**Migration:** Complete
