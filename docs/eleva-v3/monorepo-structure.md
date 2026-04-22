# Eleva.care v3 Monorepo Structure

Status: Authoritative

## Purpose

This document defines the intended monorepo structure for Eleva.care v3.

It answers:

- which apps should exist
- which packages should exist
- which boundaries each app/package owns
- how the repo should evolve over time

## Principles

- Keep app count low until product boundaries are real.
- Keep package boundaries explicit from day one.
- Share contracts across web, API, jobs, and mobile.
- Avoid duplicating domain logic inside apps.
- Make future app splitting possible without forcing it now.

## Package Manager And Tooling

- **pnpm + Turborepo** is the single installer and lockfile source of truth.
- Pin `"packageManager": "pnpm@<version>"` in root `package.json`.
- Bun is allowed as a task/script runner (`bun run`, `bun test`) but **`bun install` is banned** to prevent lockfile drift between local dev and Vercel CI.
- CI asserts no `bun.lock` exists at repo root.
- Turborepo remote cache enabled via Vercel.

## Next.js 16 Conventions (applied in every Next app)

- **`src/proxy.ts`** replaces the legacy `middleware.ts` (Next 16 rename). Entry file is `proxy.ts` and exports the default handler + optional `config.matcher`.
- **next-intl** continues to use `createMiddleware(i18nConfig)`, but it is imported and composed inside `src/proxy.ts` together with auth and secure-headers wrappers.
- The proxy file must stay thin (ideally under 50 LOC). Each concern is a composable wrapper exported from its owning package:
  - `createMiddleware` from `next-intl/middleware` (i18n)
  - `withAuth` from `@eleva/auth/proxy`
  - `withHeaders` from `@eleva/observability/proxy` (CSP + HSTS + correlation-ID)

Example shape:

```ts
import createIntl from 'next-intl/middleware';
import { i18nConfig } from '@eleva/config/i18n';
import { withAuth } from '@eleva/auth/proxy';
import { withHeaders } from '@eleva/observability/proxy';

const intl = createIntl(i18nConfig);

export default withHeaders(withAuth(intl));

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

An ESLint rule enforces that `src/proxy.ts` does not contain inline business logic — only composition.

## Vercel Platform Integration

- **Vercel CLI** is linked at repo root (see [.vercel/repo.json](../../.vercel/repo.json)). Each app is a separate Vercel project:
  - `elevacare-marketing` → `apps/web`
  - `elevacare-app` → `apps/app`
  - `elevacare-api` → `apps/api`
  - `elevacare-docs` → `apps/docs`
  - `elevacare-email` → `apps/email`
- **Vercel Marketplace integrations** provide env vars via project link (Neon, Upstash Redis, Upstash QStash, Resend, Sentry, BetterStack). Use `vercel env pull .env.local` per app instead of hand-writing secrets.
- **Vercel MCP** is used during implementation to inspect project info, deployments, env vars, and Edge Config.
- **Turborepo remote cache** is served by Vercel.
- **Vercel manages DNS** for `eleva.care`. Subdomains, DNS records (A/AAAA/CNAME/MX/TXT for SPF/DKIM/DMARC/BIMI), and wildcard SSL are controlled via Vercel Domains. Full subdomain and URL matrix in [`environment-matrix.md`](./environment-matrix.md). Locked split: `eleva.care` → `apps/web`, `app.eleva.care` → `apps/app`, `api.eleva.care` → `apps/api` (all webhooks + server callbacks), `docs.eleva.care` → `apps/docs`, `status.eleva.care` → BetterStack status page, `sessions.eleva.care` → Daily.co branded CNAME, `*.preview.eleva.care` → Vercel preview wildcard.

## Migration From Current Scaffold (Phase 1 first task)

The repo currently ships a shadcn monorepo template on Bun:

- [apps/web](../../apps/web)
- [packages/ui](../../packages/ui)
- [packages/eslint-config](../../packages/eslint-config)
- [packages/typescript-config](../../packages/typescript-config)
- `bun.lock` + `"packageManager": "bun@1.3.5"`

Phase 1 first milestone:

1. Replace `bun.lock` with `pnpm-lock.yaml`; pin `"packageManager": "pnpm@<version>"`.
2. Keep the shadcn `components.json` configuration intact.
3. Rename workspace packages from `@workspace/*` → `@eleva/*`.
4. Keep `apps/web` as the public marketing + marketplace app; scaffold `apps/app` + `apps/api` + `apps/docs` + `apps/email` alongside it.
5. Enable Turborepo remote cache.
6. Add `eslint-plugin-import` boundary rules (see "Ownership Rules" below).

## Top-Level Layout

```text
.
├── apps/
│   ├── web/                  # public marketing + marketplace + SEO
│   ├── app/                  # authenticated product (experts, patients, org admins, Eleva operators)
│   ├── api/                  # webhooks + backend integration endpoints
│   ├── docs/                 # Fumadocs product + compliance docs
│   ├── email/                # React Email templates + preview
│   ├── jobs/                 # later — only if api becomes too coupled
│   ├── diary-mobile/         # later — Expo RN patient companion app
│   └── storybook/            # later — UI verification
├── packages/
│   ├── config/               # env validation, URL helpers, shared constants
│   ├── auth/                 # WorkOS, session, RBAC, org resolution
│   ├── db/                   # Drizzle schema, migrations, withOrgContext()
│   ├── ui/                   # shared shadcn-based design system
│   ├── compliance/           # consent, audit events, retention/export
│   ├── scheduling/           # event types, schedules, availability, slot logic
│   ├── calendar/             # Google + Microsoft OAuth and sync
│   ├── billing/              # Stripe Connect, Subscriptions, Entitlements, Embedded Components
│   ├── accounting/           # two-tier invoicing (Tier 1 TOConline, Tier 2 adapter registry)
│   ├── crm/                  # contacts, lifecycle state, segmentation
│   ├── notifications/        # Lane 1 (Workflows + Resend + Twilio + inbox) and Lane 2 (Resend Automations)
│   ├── ai/                   # Vercel AI Gateway client, prompt contracts, transcript and report pipelines
│   ├── workflows/            # Vercel Workflows DevKit step definitions and shared primitives
│   ├── flags/                # Vercel Flags SDK + Edge Config boundary
│   ├── audit/                # audit log writers, correlation ID propagation
│   ├── encryption/           # WorkOS Vault helpers, crypto-shredding
│   ├── mobile/               # later — mobile-safe client contracts, sync/share DTOs
│   ├── analytics/            # later — PostHog and GA4 wrappers
│   ├── observability/        # later — Sentry and BetterStack wrappers
│   ├── content/              # later — typed content loaders for docs/blog/LLMs.txt
│   ├── eslint-config/
│   └── typescript-config/
└── docs/
    └── eleva-v3/
```

## Apps

### `apps/web`

Purpose:

- marketing
- SEO
- expert marketplace/discovery
- expert public profiles
- legal and trust content
- booking entry points

Owns:

- public information architecture
- metadata and search-facing content
- public conversion flows

Does not own:

- core business logic
- booking engine logic
- auth/session internals
- payment orchestration internals

### `apps/app`

Purpose:

- authenticated product for experts, patients, org admins, and Eleva operators

Expected route groups:

- `(expert)`
- `(patient)`
- `(org)`
- `(admin)`
- `(settings)`
- future `(academy)`

Owns:

- authenticated UX
- role-based navigation
- workspace layouts

Does not own:

- raw payment logic
- raw scheduling engine logic
- raw auth implementation details
- duplicated API/domain models

### `apps/api`

Purpose:

- webhook endpoints
- backend integration endpoints
- future stable contract for mobile and partners
- workflow triggers and backend-only orchestration

Owns:

- backend entry points
- webhook validation
- service-level API boundaries

Does not own:

- direct UI
- duplicated business rules that should live in packages

### `apps/docs`

Purpose:

- product docs
- help content
- guides
- implementation references for the team where public/internal split allows

### `apps/email`

Purpose:

- React Email templates
- preview flows
- shared lifecycle messaging artifacts

### `apps/jobs` later

Purpose:

- durable workflows
- retries
- exports
- heavy background orchestration

This should only be introduced when `apps/api` becomes too coupled to long-running or operationally heavy jobs.

### `apps/diary-mobile` later

Purpose:

- Expo / React Native patient companion app
- symptom and health-tracking data capture
- reminders and engagement
- consented sharing to Eleva dashboard/expert flows

It should join the monorepo after the shared contract layer is stable.

### `apps/storybook` later

Purpose:

- component documentation
- UI verification
- design-system collaboration

## Packages

### `packages/config`

Owns:

- environment validation
- feature/config constants
- URL helpers
- shared app/runtime config

### `packages/auth`

Owns:

- WorkOS integration
- session model
- organization resolution
- RBAC helpers
- auth-safe server/client contracts

### `packages/db`

Owns:

- Drizzle schema
- migrations
- seed helpers
- shared data-access boundaries

### `packages/ui`

Owns:

- design-system components
- tokens
- forms primitives
- app-agnostic shared components

### `packages/compliance`

Owns:

- consent model
- audit event model
- retention/export helpers
- data classification guidance

### `packages/scheduling`

Owns:

- event types
- schedules
- availabilities
- slot computation
- reservation logic

Does not own:

- calendar OAuth or sync — those live in `packages/calendar`

### `packages/calendar`

Owns:

- Google + Microsoft OAuth flows, token refresh
- event read/write with idempotent client-supplied IDs
- webhook subscription + external-change reconciliation
- busy-calendar vs destination-calendar distinctions (cal.com-inspired)

Tokens stored via `packages/encryption` → WorkOS Vault. Never env-based.

### `packages/billing`

Owns:

- Stripe Connect Express (onboarding + payouts)
- Stripe Subscriptions (Top Expert tier, clinic SaaS tiers)
- Stripe Entitlements (plan gating)
- Stripe Embedded Components wrappers (`packages/billing/stripe-embedded`)
- `AccountSession` minting (`/api/stripe/account-session`)
- single webhook dispatcher (`packages/billing/webhook`)
- commission logic (solo experts)
- invoice/payment/payout state machine

Does not own:

- invoice issuance to external fiscal systems — that lives in `packages/accounting`

### `packages/accounting`

Owns:

- Tier 1 (Eleva → Expert/Clinic) invoicing via TOConline adapter
- Tier 2 (Expert → Patient) adapter registry (cal.com-style app-store pattern)
- shared `ExpertInvoicingAdapter` interface
- per-expert credential store (Neon `expert_integration_credentials` + WorkOS Vault)
- IVA/VAT matrix logic
- reconciliation helpers (Stripe ↔ TOConline)

Directory shape:

```text
packages/accounting/
├── src/
│   ├── core/                 # IVA rules, invoice types, credential store
│   ├── eleva-platform/       # Tier 1 — TOConline-only
│   └── expert-apps/
│       └── adapters/
│           ├── toconline/
│           ├── moloni/
│           ├── invoicexpress/
│           ├── vendus/
│           ├── primavera/
│           └── manual/
```

CI rule: no direct `toconline-sdk` / `moloni-sdk` / etc. imports outside this package.

### `packages/crm`

Owns:

- customer/contact model
- lifecycle state
- segmentation
- expert-facing CRM helpers

### `packages/notifications`

Owns:

- Lane 1 — transactional multi-channel (`sendNotification`)
  - Vercel Workflows orchestration
  - Resend transactional, Twilio EU SMS, Neon in-app inbox, Expo push (later)
  - preference model, quiet hours, locale
- Lane 2 — marketing lifecycle (`triggerAutomation`)
  - Resend Automations trigger
  - consent-gated Neon → Resend contact sync
- template payload schemas

CI rules: no direct `resend` / `twilio` / `expo-server-sdk` imports outside this package.

### `packages/workflows`

Owns:

- Vercel Workflows DevKit step definitions (shared helpers, typed context, correlation-ID propagation)
- dead-letter and admin-retry surfaces

Apps compose workflow triggers; step logic lives here or in the owning domain package (`packages/billing`, `packages/accounting`, etc.).

### `packages/flags`

Owns:

- Vercel Flags SDK boundary
- Edge Config + PostHog adapter wiring
- flag catalog (`ff.<area>.<feature>`)
- kill-switch helpers

CI rule: no direct `@vercel/flags` or PostHog flag SDK imports outside this package.

### `packages/audit`

Owns:

- `withAudit` decorator for mutating server actions
- audit event writers targeting `eleva_v3_audit` Neon project
- correlation-ID `AsyncLocalStorage` propagation

### `packages/encryption`

Owns:

- WorkOS Vault primitives (`vaultPut`, `vaultGet`)
- domain helpers (`encryptRecord`, `encryptOAuthToken`)
- crypto-shredding on org deletion

CI rule: no direct `crypto.createCipheriv('aes-256-gcm', …)` outside this package; no `process.env.ENCRYPTION_KEY` anywhere.

### `packages/ai`

Owns:

- Vercel AI Gateway client (sole model router)
- prompt contracts (versioned)
- transcript summarization pipeline
- AI report drafting pipeline
- consent and retention enforcement for AI artifacts

CI rule: no direct LLM provider SDKs outside this package.

### `packages/mobile` later

Owns:

- mobile-safe client contracts
- shared validation schemas
- sync/share DTOs
- mobile API SDK helpers

### `packages/analytics` and `packages/observability` later

Owns:

- PostHog wrapper (product analytics on `apps/app`)
- GA4 wrapper (marketing on `apps/web`)
- Sentry and BetterStack wrappers
- instrumentation helpers

### `packages/content` later

Owns:

- typed content loading
- markdown/docs helpers
- LLMs.txt and metadata helpers

## Ownership Rules

### Apps should orchestrate, packages should define

Apps should compose UI and flows.
Packages should hold the reusable domain and system logic.

### Shared logic belongs in packages

If two apps need the same:

- domain model
- validation
- service logic
- API client logic
- policy logic

it should move into a package.

### Do not let packages become random utility buckets

Each package must have:

- a clear purpose
- a stable boundary
- a small number of public entry points

## Evolution Path

### Initial state (after Phase 1 migration)

Apps:

- `apps/web` (migrated from existing scaffold)
- `apps/app`
- `apps/api`
- `apps/docs`
- `apps/email`

Packages:

- `packages/config`
- `packages/auth`
- `packages/db`
- `packages/ui` (migrated + renamed)
- `packages/compliance`
- `packages/scheduling`
- `packages/calendar`
- `packages/billing`
- `packages/accounting`
- `packages/crm`
- `packages/notifications`
- `packages/workflows`
- `packages/flags`
- `packages/audit`
- `packages/encryption`
- `packages/ai`
- `packages/eslint-config` (migrated + renamed)
- `packages/typescript-config` (migrated + renamed)

### Near-term expansion

- `packages/mobile`
- `apps/diary-mobile` (once `packages/auth`, `packages/db`, `apps/api`, `packages/notifications` have shipped v1 contracts)
- `packages/analytics`
- `packages/observability`

### Later expansion only if justified

- `apps/jobs`
- `apps/storybook`
- app split into `expert`, `patient`, or `admin`
- dedicated `academy` app

## When To Split The Product App Later

The team should consider splitting `apps/app` only if one or more become true:

- expert and patient products have materially different release cadence
- product teams become independent
- runtime or security isolation needs become distinct
- bundle and performance concerns become significant
- academy becomes a genuinely separate product surface

Until then, keep one authenticated product app.

## Dependencies And Direction

Use a dependency direction like:

```text
apps/* -> packages/*
packages/feature -> packages/foundation
packages/foundation -> no app dependency
```

Never let a package depend on an app.

## Required Companion Docs

- [`master-architecture.md`](./master-architecture.md)
- [`domain-model.md`](./domain-model.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
