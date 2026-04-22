# Package Migration Plan 2025

> **Created:** December 16, 2025  
> **Last Updated:** December 16, 2025  
> **Status:** Planning Phase

## Executive Summary

This document outlines the migration strategy for upgrading major dependencies with breaking changes. The plan is organized into **4 phases** spanning Q1-Q2 2025, prioritized by risk level and business impact.

### Current State (December 2025)

| Package              | Current | Target          | Risk Level | Phase   |
| -------------------- | ------- | --------------- | ---------- | ------- |
| Zod                  | 3.25.76 | 4.x             | 🟡 Medium  | Phase 1 |
| date-fns             | 3.6.0   | 4.x             | 🟢 Low     | Phase 1 |
| @hookform/resolvers  | 3.10.0  | 5.x             | 🟡 Medium  | Phase 1 |
| posthog-node         | 4.18.0  | 5.x             | 🟢 Low     | Phase 1 |
| Drizzle ORM          | 0.35.3  | 0.45.x          | 🟡 Medium  | Phase 2 |
| Drizzle Kit          | 0.26.2  | 0.31.x          | 🟡 Medium  | Phase 2 |
| @novu/api            | 1.8.0   | 3.x             | 🟡 Medium  | Phase 2 |
| @react-email/\*      | 0.x/1.x | 1.x/2.x         | 🟡 Medium  | Phase 2 |
| resend               | 4.8.0   | 6.x             | 🟡 Medium  | Phase 2 |
| Stripe               | 17.7.0  | 20.x            | 🔴 High    | Phase 3 |
| TailwindCSS          | 3.4.19  | 4.x             | 🔴 High    | Phase 4 |
| tailwind-merge       | 2.6.0   | 3.x             | 🔴 High    | Phase 4 |
| tailwindcss-animate  | current | tw-animate-css  | 🔴 High    | Phase 4 |
| shadcn/ui components | v3      | v4 (Tailwind 4) | 🔴 High    | Phase 4 |
| react-day-picker     | 9.5.1   | 9.x (latest)    | 🟡 Medium  | Phase 4 |

---

## Phase 1: Low-Risk Schema & Analytics Updates

**Timeline:** January 6-17, 2025 (2 weeks)  
**Risk Level:** 🟢 Low to 🟡 Medium  
**Packages:** Zod, date-fns, @hookform/resolvers, posthog-node

### Why These Go Together

These packages share a common characteristic: their changes are primarily **type-level and internal**, with minimal runtime impact. They can be safely tested together because:

1. **Zod 4** changes are mainly in error customization APIs
2. **date-fns 4** has minimal breaking changes (mostly type-related)
3. **@hookform/resolvers** is tightly coupled with Zod
4. **posthog-node** has isolated analytics functionality

### 1.1 Zod 3.x → 4.x

**Estimated Effort:** 4-8 hours  
**Breaking Changes:**

- `message` parameter deprecated → use `error` instead
- `invalid_type_error` and `required_error` → use `error` (function syntax)
- `errorMap` → use `error` (function syntax)
- `z.intersection()` throws `Error` instead of `ZodError` on merge conflicts

**Migration Steps:**

```bash
# Step 1: Update to Zod 4
bun add zod@^4.0.0

# Step 2: Update imports (optional - old imports still work)
# From: import { z } from "zod"
# To: import { z } from "zod" (no change needed)
```

**Files to Update:**

```bash
# Find all Zod schema files
grep -r "message:" --include="*.ts" src/schema/
grep -r "invalid_type_error" --include="*.ts" src/
grep -r "required_error" --include="*.ts" src/
grep -r "errorMap" --include="*.ts" src/
```

**Code Changes:**

```typescript
// Before (Zod 3)
const schema = z.string({
  message: "Custom error message",
  invalid_type_error: "Must be a string",
  required_error: "This field is required",
});

// After (Zod 4)
const schema = z.string({
  error: "Custom error message",
  // Or with function syntax for more control:
  error: (issue) => {
    if (issue.code === "invalid_type") return "Must be a string";
    if (issue.code === "missing") return "This field is required";
    return "Invalid value";
  },
});
```

**Testing Checklist:**

- [ ] All form validations work correctly
- [ ] Error messages display properly
- [ ] TypeScript compilation passes
- [ ] Unit tests pass

---

### 1.2 date-fns 3.x → 4.x

**Estimated Effort:** 2-4 hours  
**Breaking Changes:**

Per the changelog: "There aren't many breaking changes in this release. All of them are type-related and will affect only those explicitly using internal date-fns types."

**Key Addition:** Native timezone support via `TZDate` class.

**Migration Steps:**

```bash
# Step 1: Update date-fns
bun add date-fns@^4.0.0

# Step 2: Update date-fns-tz (if using)
bun add date-fns-tz@^3.2.0  # Compatible with v4
```

**Files to Check:**

```bash
# Find date-fns usage
grep -r "from 'date-fns'" --include="*.ts" --include="*.tsx" src/
```

**Testing Checklist:**

- [ ] Date formatting works correctly
- [ ] Timezone handling works (if applicable)
- [ ] Calendar/booking date calculations are accurate
- [ ] All date-related unit tests pass

---

### 1.3 @hookform/resolvers 3.x → 5.x

**Estimated Effort:** 2-4 hours  
**Dependency:** Requires Zod 4 migration first

**Migration Steps:**

```bash
# Must be done AFTER Zod 4 migration
bun add @hookform/resolvers@^5.0.0
```

**Files to Update:**

```bash
# Find resolver usage
grep -r "zodResolver" --include="*.ts" --include="*.tsx" src/
```

**Testing Checklist:**

- [ ] All forms validate correctly
- [ ] Error messages render properly
- [ ] Form submission works
- [ ] React Hook Form integration is stable

---

### 1.4 posthog-node 4.x → 5.x

**Estimated Effort:** 1-2 hours  
**Breaking Changes:** Likely minimal (check changelog when upgrading)

**Migration Steps:**

```bash
bun add posthog-node@^5.0.0
```

**Files to Check:**

```bash
# Find PostHog server-side usage
grep -r "posthog-node" --include="*.ts" src/
grep -r "PostHog" --include="*.ts" src/lib/
```

**Testing Checklist:**

- [ ] Server-side analytics capture works
- [ ] Feature flags evaluation works
- [ ] No runtime errors in server logs

---

## Phase 2: Email & Database Infrastructure

**Timeline:** January 20 - February 7, 2025 (3 weeks)  
**Risk Level:** 🟡 Medium  
**Packages:** Drizzle ORM/Kit, @react-email/\*, resend, @novu/api

### Why These Go Together

These packages form the **communication and data persistence layer**. They should be migrated together because:

1. **Drizzle ORM** changes affect query patterns across the app
2. **Email packages** (@react-email, resend) are tightly integrated
3. **Novu** depends on email infrastructure
4. Testing can be consolidated around email/notification flows

### 2.1 Drizzle ORM 0.35.x → 0.45.x + Drizzle Kit 0.26.x → 0.31.x

**Estimated Effort:** 8-16 hours  
**Breaking Changes:**

- **Relational Queries v2** - Major API change
- `db.query` → `db._query` (v1 syntax moves to underscore prefix)
- New centralized relations definition
- `mode` option removal for MySQL (not applicable for PostgreSQL)

**Migration Strategy:**

Drizzle supports **partial/incremental migration** - you can migrate query by query:

```typescript
// Step 1: Update imports for v1 relations (keep working)
// Before:
import { relations } from "drizzle-orm";

// After (to keep v1 syntax):
import { relations } from "drizzle-orm/_relations";
```

**Migration Steps:**

```bash
# Step 1: Update both packages together (required)
bun add drizzle-orm@^0.45.0
bun add -D drizzle-kit@^0.31.0

# Step 2: Test existing queries still work
bun run test

# Step 3: Gradually migrate to new syntax
```

**Files to Update:**

```bash
# Find all Drizzle queries
grep -r "db.query" --include="*.ts" src/
grep -r "relations(" --include="*.ts" drizzle/
```

**New Relations Syntax (v2):**

```typescript
// Before (v1) - Multiple relation definitions
// drizzle/schema.ts
export const usersRelations = relations(users, ({ one, many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));

// After (v2) - Centralized relations
// drizzle/relations.ts
import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    posts: r.many.posts(),
  },
  posts: {
    author: r.one.users(),
  },
}));

// drizzle/db.ts
import { relations } from "./relations";
const db = drizzle(client, { relations }); // Note: relations, not schema
```

**Query Migration:**

```typescript
// Before (v1)
const result = await db.query.users.findFirst({
  with: { posts: true },
});

// After (v2) - if using new syntax
const result = await db._query.users.findFirst({
  with: { posts: true },
});

// Or with new v2 query builder (recommended for new code)
const result = await db.query.users.findFirst({
  include: { posts: true },
});
```

**Testing Checklist:**

- [ ] All database queries execute correctly
- [ ] Relational queries return expected data
- [ ] Migrations generate correctly (`bun run db:generate`)
- [ ] Database studio works (`bun run db:studio`)
- [ ] All integration tests pass

---

### 2.2 @react-email/\* 0.x/1.x → 1.x/2.x

**Estimated Effort:** 4-8 hours  
**Packages to Update:**

- `@react-email/components` 0.0.35 → 1.x
- `@react-email/render` 1.4.0 → 2.x
- `react-email` (dev) 4.3.2 → 5.x

**Migration Steps:**

```bash
# Update all react-email packages together
bun add @react-email/components@^1.0.0 @react-email/render@^2.0.0
bun add -D react-email@^5.0.0
```

**Files to Update:**

```bash
# Find email templates
ls -la src/emails/
grep -r "@react-email" --include="*.tsx" src/
```

**Testing Checklist:**

- [ ] Email preview works (`bun run email:dev`)
- [ ] All email templates render correctly
- [ ] HTML output is valid
- [ ] Emails display correctly in test clients

---

### 2.3 resend 4.x → 6.x

**Estimated Effort:** 2-4 hours  
**Dependency:** Should be done AFTER @react-email updates

**Migration Steps:**

```bash
bun add resend@^6.0.0
```

**Files to Update:**

```bash
grep -r "resend" --include="*.ts" src/lib/
grep -r "Resend" --include="*.ts" src/
```

**API Pattern (unchanged):**

```typescript
// The { data, error } pattern remains the same
const { data, error } = await resend.emails.send({
  from: "...",
  to: "...",
  subject: "...",
  react: EmailTemplate({ ... }),
});
```

**Testing Checklist:**

- [ ] Test email sending in development
- [ ] Verify email delivery in Resend dashboard
- [ ] Check webhook handling (if applicable)

---

### 2.4 @novu/api 1.x → 3.x

**Estimated Effort:** 4-8 hours  
**Breaking Changes:**

Per Novu docs: "The new v2 images are backward compatible with the old v0 API."

However, for the new Workflow editor experience, workflows need migration.

**Note:** We're using `@novu/framework` 2.9.0 which is already compatible.

**Migration Steps:**

```bash
bun add @novu/api@^3.0.0
```

**Files to Update:**

```bash
grep -r "@novu/api" --include="*.ts" src/
grep -r "Novu" --include="*.ts" src/lib/integrations/novu/
```

**Testing Checklist:**

- [ ] Notification triggers work
- [ ] Workflow sync works (`bun run novu:sync:dev`)
- [ ] In-app notifications display
- [ ] Email notifications send correctly

---

## Phase 3: Payment Infrastructure (Stripe)

**Timeline:** February 10-28, 2025 (3 weeks)  
**Risk Level:** 🔴 High  
**Packages:** Stripe 17.x → 20.x

### Why This Is Separate

Stripe is **mission-critical payment infrastructure**. It requires:

- Dedicated testing environment
- Webhook endpoint version management
- Careful API version migration
- Extended QA cycle

### 3.1 Stripe 17.x → 20.x

**Estimated Effort:** 16-24 hours  
**Breaking Changes:**

- **API Version:** `2025-03-31.basil` (v18+)
- **Billing Changes:** Removal of legacy usage-based billing
- **Upcoming Invoice API** → **Create Preview API**
- **List operations** changes
- **Checkout workflow** updates

**Migration Strategy:**

**Option A (Recommended): Incremental Migration**

```typescript
// Keep using pinned API version initially
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // Pin to current version
});

// Then migrate endpoint by endpoint using request-level versioning
const session = await stripe.checkout.sessions.create({
  // ...params
}, {
  apiVersion: '2025-03-31.basil', // Test new version per-request
});
```

**Option B: Full Migration**

```bash
bun add stripe@^20.0.0
```

**Pre-Migration Checklist:**

- [ ] Review [Stripe API Changelog](https://stripe.com/docs/upgrades)
- [ ] Check current API version in Stripe Dashboard
- [ ] Identify all Stripe endpoints used in codebase
- [ ] Create test webhook endpoint for new version

**Files to Update:**

```bash
# Find all Stripe usage
grep -r "stripe" --include="*.ts" src/app/api/
grep -r "Stripe" --include="*.ts" src/lib/
ls -la src/app/api/webhooks/stripe/
```

**Key Areas to Test:**

1. **Checkout Sessions**
   - Session creation
   - Success/cancel redirects
   - Metadata handling

2. **Webhooks**
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - Identity verification events

3. **Subscriptions** (if applicable)
   - Subscription creation
   - Invoice generation
   - Proration handling

4. **Payment Intents**
   - Direct payment intents
   - Multibanco flows
   - Refund processing

**Testing Checklist:**

- [ ] All checkout flows work in test mode
- [ ] Webhooks receive and process correctly
- [ ] Payment confirmations work
- [ ] Refund flows work
- [ ] Error handling is correct
- [ ] TypeScript types are correct
- [ ] Integration tests pass

---

## Phase 4: Frontend Framework (TailwindCSS + shadcn/ui + Calendar)

**Timeline:** March 3-28, 2025 (4 weeks)  
**Risk Level:** 🔴 High  
**Packages:**

| Package                  | Current  | Target         |
| ------------------------ | -------- | -------------- |
| TailwindCSS              | 3.4.19   | 4.x            |
| tailwind-merge           | 2.6.0    | 3.x            |
| tailwindcss-animate      | current  | tw-animate-css |
| react-day-picker         | 9.5.1    | 9.x (latest)   |
| All shadcn/ui components | v3-style | v4-style       |

### Why This Is Last

TailwindCSS v4 is a **complete architecture rewrite** that cascades to all UI components:

- Configuration moves from JavaScript to CSS
- New browser requirements (Safari 16.4+, Chrome 111+, Firefox 128+)
- Class naming changes affect all components
- shadcn/ui components need simultaneous upgrade
- Calendar component (react-day-picker) needs migration

This affects **every component** in the application and requires:

- Visual regression testing
- Cross-browser testing
- Extensive QA
- Component-by-component verification

---

### 4.1 TailwindCSS 3.x → 4.x (Core Framework)

**Estimated Effort:** 8-12 hours  
**Breaking Changes:**

1. **Browser Requirements:**
   - Safari 16.4+
   - Chrome 111+
   - Firefox 128+
   - ⚠️ No IE11 or older browser support

2. **Configuration Migration:**
   - `tailwind.config.ts` → CSS-based configuration with `@theme`
   - JavaScript plugins → CSS `@plugin` directives

3. **Class Renames:**
   - `shadow-xs` behavior changed → use `shadow-2xs`
   - `ring-3` default width: `3px` → `1px` (use `ring-3`)
   - `outline-hidden` → `outline-hidden`

4. **Utility Changes:**
   - `space-x-*`/`space-y-*` selector changed
   - Container configuration simplified
   - Gradient variant behavior changed
   - New `size-*` utility replaces `w-* h-*` combinations

5. **Color System:**
   - HSL colors → OKLCH colors
   - CSS variables need `@theme inline` wrapper

**Migration Steps:**

```bash
# Step 1: Create new branch
git checkout -b feat/tailwind-v4-migration

# Step 2: Run official upgrade tool
npx @tailwindcss/upgrade@next

# Step 3: Review all changes
git diff

# Step 4: Follow shadcn/ui migration (see 4.2)
```

**CSS Variables Migration (Critical for shadcn/ui):**

The codemod will migrate CSS variables, but you need to update them for `@theme inline`:

```css
/* Before: globals.css (Tailwind v3) */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
  }
}

@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
}

/* After: globals.css (Tailwind v4 with @theme inline) */
:root {
  --background: hsl(0 0% 100%);  /* Wrap in hsl() */
  --foreground: hsl(0 0% 3.9%);
}

.dark {
  --background: hsl(0 0% 3.9%);
  --foreground: hsl(0 0% 98%);
}

@theme inline {
  --color-background: var(--background);  /* Remove hsl() wrapper */
  --color-foreground: var(--foreground);
}
```

**Animation Plugin Migration:**

```bash
# Remove old animation plugin
bun remove tailwindcss-animate

# Install new animation CSS
bun add -D tw-animate-css
```

```css
/* globals.css - Update import */
- @plugin 'tailwindcss-animate';
+ @import "tw-animate-css";
```

**Class Migration Patterns:**

```bash
# Find patterns to update
grep -r "shadow-xs" --include="*.tsx" src/
grep -r "ring[^-]" --include="*.tsx" src/
grep -r "outline-hidden" --include="*.tsx" src/
grep -r "w-4 h-4" --include="*.tsx" src/  # Can use size-4

# Common replacements:
# w-4 h-4 → size-4
# ring → ring-3 (if expecting 3px)
# outline-hidden → outline-hidden
```

---

### 4.2 shadcn/ui Components Migration

**Estimated Effort:** 8-12 hours  
**What's Changed in shadcn/ui for Tailwind v4:**

- All components updated for Tailwind v4 + React 19
- `forwardRef` removed → using props directly
- New `data-slot` attributes for styling
- Toast component deprecated → use Sonner
- Default style deprecated → `new-york` is now default
- HSL colors → OKLCH colors

**Migration Steps:**

```bash
# Step 1: Update shadcn CLI
bun add -D shadcn@canary

# Step 2: Update all shadcn components
bunx shadcn@latest add --all --overwrite

# Step 3: Update dependencies
bun up "@radix-ui/*" cmdk lucide-react recharts tailwind-merge clsx --latest
```

**Charts Configuration Update:**

```typescript
// Before (v3)
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--chart-1))",  // Has hsl wrapper
  },
};

// After (v4)
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",  // No hsl wrapper (already in CSS)
  },
};
```

**forwardRef Removal (Optional but Recommended):**

```bash
# Use React codemod
npx react-codemod remove-forward-ref ./src/components/ui
```

Manual pattern:

```tsx
// Before (v3 with forwardRef)
const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b last:border-b-0", className)}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

// After (v4 without forwardRef)
function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  );
}
```

---

### 4.3 Calendar Component Migration (react-day-picker)

**Estimated Effort:** 4-8 hours  
**Current Version:** 9.5.1 (already on v9)  
**Changes Required:** Component styling updates for Tailwind v4

**Migration Steps:**

```bash
# Step 1: Update Calendar component
bunx shadcn@latest add calendar --overwrite

# Step 2: Update react-day-picker if needed
bun up react-day-picker --latest
```

**Calendar Component Updates:**

The new Calendar component includes:

- `--cell-size` CSS variable for customization
- `data-slot="calendar"` attribute
- Better RTL support
- Improved range selection styling
- Week number display fixes

**Key Changes in Calendar Styling:**

```tsx
// New responsive cell sizing
<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  className="rounded-lg border [--cell-size:--spacing(11)] md:[--cell-size:--spacing(12)]"
/>

// Fixed values
<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  className="rounded-lg border [--cell-size:2.75rem] md:[--cell-size:3rem]"
/>
```

**Timezone Handling (Important):**

```tsx
// Ensure timezone is set client-side to prevent hydration mismatch
export function CalendarWithTimezone() {
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [timeZone, setTimeZone] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      timeZone={timeZone}
    />
  );
}
```

**Date Picker Component:**

If you have a custom date picker, ensure it's updated to use the new Calendar:

```bash
bunx shadcn@latest add date-picker --overwrite
```

---

### 4.4 Complete Phase 4 Checklist

**Pre-Migration:**

- [ ] Commit all current changes
- [ ] Create feature branch `feat/tailwind-v4-migration`
- [ ] Take screenshots of all major UI components
- [ ] Document any custom component modifications

**Step 1: TailwindCSS Upgrade**

- [ ] Run `npx @tailwindcss/upgrade@next`
- [ ] Review and commit codemod changes
- [ ] Update CSS variables to `@theme inline` format
- [ ] Replace `tailwindcss-animate` with `tw-animate-css`
- [ ] Test basic styling works

**Step 2: shadcn/ui Components**

- [ ] Update shadcn CLI to canary
- [ ] Run `bunx shadcn@latest add --all --overwrite`
- [ ] Update dependencies: `@radix-ui/*`, `cmdk`, `lucide-react`, `recharts`, `tailwind-merge`, `clsx`
- [ ] Update chart configurations (remove hsl wrappers)
- [ ] Optionally remove forwardRef from components

**Step 3: Calendar & Date Picker**

- [ ] Run `bunx shadcn@latest add calendar --overwrite`
- [ ] Update react-day-picker to latest
- [ ] Test all calendar modes (single, range, multiple)
- [ ] Verify timezone handling
- [ ] Test date picker popover behavior

**Step 4: Testing**

- [ ] Visual regression testing on all pages
- [ ] Component library renders correctly
- [ ] Dark mode works (check OKLCH colors)
- [ ] Responsive breakpoints work
- [ ] Custom colors/themes work
- [ ] All shadcn/ui components render correctly
- [ ] Calendar selection works (single, range)
- [ ] Cross-browser testing (Chrome 111+, Firefox 128+, Safari 16.4+)
- [ ] Mobile testing
- [ ] Animations work (`tw-animate-css`)

**Step 5: Cleanup**

- [ ] Remove any deprecated dependencies
- [ ] Update documentation
- [ ] Merge to main

---

### Related Package Updates (Phase 4)

```bash
# All these should be done together:
bun add tailwind-merge@^3.0.0
bun add -D tw-animate-css
bun add -D prettier-plugin-tailwindcss@latest

# Update all Radix UI packages
bun up "@radix-ui/*" --latest

# Update other UI dependencies
bun up cmdk lucide-react recharts clsx --latest
```

---

## Migration Calendar

```
January 2025
├── Week 1 (Jan 6-10): Phase 1 - Zod, date-fns
├── Week 2 (Jan 13-17): Phase 1 - @hookform/resolvers, posthog-node
└── Week 3 (Jan 20-24): Phase 2 - Drizzle ORM/Kit (start)

February 2025
├── Week 4 (Jan 27-31): Phase 2 - Drizzle ORM/Kit (complete)
├── Week 5 (Feb 3-7): Phase 2 - Email packages (react-email, resend, novu)
├── Week 6 (Feb 10-14): Phase 3 - Stripe (start)
├── Week 7 (Feb 17-21): Phase 3 - Stripe (testing)
└── Week 8 (Feb 24-28): Phase 3 - Stripe (complete)

March 2025
├── Week 9 (Mar 3-7): Phase 4 - TailwindCSS 4 + CSS migration
├── Week 10 (Mar 10-14): Phase 4 - shadcn/ui components update
├── Week 11 (Mar 17-21): Phase 4 - Calendar + remaining components
└── Week 12 (Mar 24-28): Phase 4 - Visual regression testing & QA
```

### Phase 4 Detailed Timeline

| Day         | Task                                              |
| ----------- | ------------------------------------------------- |
| **Week 9**  |                                                   |
| Mon         | Create branch, run `@tailwindcss/upgrade@next`    |
| Tue         | Update CSS variables to `@theme inline` format    |
| Wed         | Replace `tailwindcss-animate` → `tw-animate-css`  |
| Thu         | Fix class renames (shadow-sm, ring, outline-none) |
| Fri         | Initial build test, fix compilation errors        |
| **Week 10** |                                                   |
| Mon         | Run `bunx shadcn@latest add --all --overwrite`    |
| Tue         | Update chart configurations                       |
| Wed         | Update Radix UI and other dependencies            |
| Thu         | Fix component-specific styling issues             |
| Fri         | forwardRef removal (optional)                     |
| **Week 11** |                                                   |
| Mon         | Update Calendar component                         |
| Tue         | Update DatePicker and date-related components     |
| Wed         | Update remaining custom components                |
| Thu         | Dark mode verification (OKLCH colors)             |
| Fri         | Responsive testing                                |
| **Week 12** |                                                   |
| Mon         | Cross-browser testing (Chrome, Firefox, Safari)   |
| Tue         | Mobile testing                                    |
| Wed         | Visual regression review                          |
| Thu         | Fix any remaining issues                          |
| Fri         | Final QA, merge to main                           |

---

## Risk Mitigation

### Pre-Migration Checklist (All Phases)

- [ ] Create feature branch from main
- [ ] Ensure all tests pass before starting
- [ ] Document current behavior with screenshots (UI changes)
- [ ] Create rollback plan
- [ ] Schedule migration during low-traffic period
- [ ] Notify team of planned changes

### Rollback Strategy

```bash
# If issues are found post-deployment:

# Option 1: Revert commit
git revert <commit-hash>

# Option 2: Reset to previous state
git reset --hard <previous-commit>
bun install  # Restore previous dependencies
```

### Testing Strategy

1. **Unit Tests:** Run full test suite after each package update
2. **Integration Tests:** Test critical user flows
3. **E2E Tests:** Run Playwright tests for visual/functional regression
4. **Manual QA:** Test in staging environment before production

---

## Dependencies Between Phases

```
Phase 1 (Schema/Analytics)
    │
    ├── Zod 4 ─────────────┐
    │                      │
    └── @hookform/resolvers ◄──┘ (depends on Zod 4)

Phase 2 (Email/Database)
    │
    ├── Drizzle ORM ◄────── (standalone)
    │
    ├── @react-email ◄───── (standalone)
    │        │
    └── resend ◄───────────┘ (depends on @react-email)

Phase 3 (Payments)
    │
    └── Stripe ◄─────────── (standalone, high risk)

Phase 4 (Frontend) - MUST BE DONE TOGETHER
    │
    ├── TailwindCSS 4 ◄───────── (core framework)
    │        │
    │        ├── tailwind-merge ◄──┘ (requires TailwindCSS 4)
    │        │
    │        └── tw-animate-css ◄──┘ (replaces tailwindcss-animate)
    │
    ├── shadcn/ui ◄────────────── (depends on TailwindCSS 4)
    │        │
    │        └── @radix-ui/* ◄───┘ (peer dependency)
    │
    └── Calendar ◄─────────────── (shadcn/ui component)
             │
             └── react-day-picker ◄──┘ (styling depends on Tailwind v4)
```

**⚠️ Phase 4 Warning:** All Phase 4 packages MUST be migrated together. You cannot upgrade TailwindCSS without also updating shadcn/ui components, as the class names and CSS variable formats are interdependent.

---

## Post-Migration Tasks

After all phases complete:

1. **Documentation Updates**
   - [ ] Update README with new version requirements
   - [ ] Update CHANGELOG.md
   - [ ] Update any affected API documentation

2. **CI/CD Updates**
   - [ ] Update GitHub Actions if needed
   - [ ] Verify Vercel deployment works

3. **Monitoring**
   - [ ] Watch Sentry for new errors
   - [ ] Monitor performance metrics
   - [ ] Check analytics for anomalies

4. **Team Communication**
   - [ ] Announce completion to team
   - [ ] Share any new patterns/conventions
   - [ ] Update onboarding documentation

---

## References

### Phase 1 (Schema/Analytics)

- [Zod v4 Migration Guide](https://zod.dev/v4/changelog)
- [date-fns Changelog](https://github.com/date-fns/date-fns/blob/main/CHANGELOG.md)
- [React Hook Form Resolvers](https://react-hook-form.com/docs)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)

### Phase 2 (Email/Database)

- [Drizzle ORM Relations v1 to v2](https://orm.drizzle.team/docs/relations-v1-v2)
- [React Email Documentation](https://react.email/docs)
- [Resend Node.js SDK](https://resend.com/docs/sdks/nodejs)
- [Novu Self-Hosted Migration](https://docs.novu.co/community/self-hosting-novu/v0-to-v2-migration)

### Phase 3 (Payments)

- [Stripe Node.js Migration Guides](https://github.com/stripe/stripe-node/wiki)
- [Stripe API Changelog](https://stripe.com/docs/upgrades)

### Phase 4 (Frontend)

- [TailwindCSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [shadcn/ui Tailwind v4 Migration](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui Next.js 15 + React 19](https://ui.shadcn.com/docs/react-19)
- [shadcn/ui Calendar Component](https://ui.shadcn.com/docs/components/calendar)
- [React DayPicker Upgrade Guide](https://daypicker.dev/upgrading)
- [tw-animate-css](https://github.com/JoeJohnston24/tw-animate-css)
- [tailwind-merge v3](https://github.com/dcastil/tailwind-merge)
