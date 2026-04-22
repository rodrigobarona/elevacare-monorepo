# 04 — Routing & App Structure

> Complete route map of the MVP plus the v2 reorganization (`src/` layout, Patient Portal, Become-Partner, simplified `proxy.ts`).

## What we built

Three top-level segments under [app/](../../app/), plus a flat `app/api/` tree for HTTP handlers, all behind one [proxy.ts](../../proxy.ts).

```text
app/
├── (private)/                  # authenticated app shell, locale-free
│   ├── layout.tsx
│   ├── account/
│   ├── admin/
│   ├── appointments/
│   ├── booking/
│   ├── dashboard/
│   └── setup/
├── [locale]/
│   ├── (public)/               # localized marketing + booking funnel
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── [username]/         # public expert profile + event pages
│   │   ├── about/
│   │   ├── history/
│   │   ├── legal/
│   │   ├── my-packs/
│   │   ├── pack-purchase/
│   │   └── trust/
│   ├── (auth)/                 # sign-in / sign-up / onboarding
│   │   ├── layout.tsx
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   ├── onboarding/
│   │   └── unauthorized/
│   ├── error.tsx
│   ├── layout.tsx
│   └── not-found.tsx
├── api/
│   ├── admin/                  # admin operations
│   ├── appointments/
│   ├── auth/
│   ├── categories/
│   ├── create-pack-checkout/
│   ├── create-payment-intent/
│   ├── cron/                   # all QStash and Vercel cron handlers
│   │   ├── appointment-reminders/
│   │   ├── appointment-reminders-1hr/
│   │   ├── check-upcoming-payouts/
│   │   ├── cleanup-blocked-dates/
│   │   ├── cleanup-expired-reservations/
│   │   ├── keep-alive/         # the only Vercel cron
│   │   ├── process-expert-transfers/
│   │   ├── process-pending-payouts/
│   │   ├── process-tasks/
│   │   └── send-payment-reminders/
│   ├── customers/
│   ├── diagnostics/
│   ├── expert/
│   ├── experts/
│   ├── health/
│   ├── healthcheck/
│   ├── internal/
│   ├── meetings/
│   ├── novu/                   # Novu Framework bridge
│   ├── og/                     # Open Graph image generation
│   ├── profile/
│   ├── qstash/                 # QStash signed-event ingress
│   ├── records/
│   ├── scheduling-settings/
│   ├── stripe/
│   ├── test-email/
│   ├── test-sentry/
│   ├── upload/                 # Vercel Blob uploads
│   ├── user/
│   ├── users/
│   └── webhooks/
│       ├── clerk/
│       ├── stripe/
│       ├── stripe-connect/
│       └── stripe-identity/
├── PostHogPageView.tsx          # to be deleted in v2
├── i18n.ts
├── layout.tsx                   # root layout
├── not-found.tsx
├── providers.tsx
├── robots.ts
├── sitemap.ts
└── theme-provider.tsx
```

## Why three top segments

- **`app/(private)/*`** — authenticated app shell, **locale-free**. The dashboard, admin, and appointment surfaces are not localized in the URL. Internal tooling targets one team and one locale (Portuguese-speaking team operating in English UI). Cuts route fanout by 4×.
- **`app/[locale]/(public)/*`** — locale-prefixed for SEO. Expert profiles, marketing, packs are all here. `[locale]` ∈ `{en, pt, br, es}`.
- **`app/[locale]/(auth)/*`** — sign-in / sign-up / onboarding; localized so the auth UX matches the visitor's language at the moment of capture.

## Layouts

| Layout                                  | Wraps                                           | Provides                                            |
| --------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `app/layout.tsx`                        | Everything                                      | `html`/`body`, providers, fonts, theme, Sentry      |
| `app/[locale]/layout.tsx`               | All localized routes                            | `next-intl` provider, locale-specific metadata     |
| `app/[locale]/(public)/layout.tsx`      | Marketing + booking funnel                      | Public header, footer, marketing nav                |
| `app/[locale]/(auth)/layout.tsx`        | Auth flows                                      | Auth-specific shell, language switch                |
| `app/(private)/layout.tsx`              | Authenticated shell                             | Sidebar, dashboard nav, role-aware menu             |

## Public booking funnel route map

```text
/                                     marketing landing
/[username]                            public expert profile
/[username]/[event-slug]               event page (calls MeetingForm)
/pack-purchase/[pack-id]               pack checkout
/my-packs                              authenticated patient pack list
/about                                 about + team
/history                               company history
/trust                                 trust + safety + credentials
/legal/*                               terms / privacy / cookies
```

## Authenticated app surfaces

```text
/dashboard                            home shell, role-aware
/appointments                         expert + patient appointments
/setup                                expert onboarding wizard
/account/*                            settings (profile, calendar, billing)
/booking/*                            booking-related authenticated views
/admin/*                              admin only (destructive actions further gated by per-permission operator subset)
```

## API & webhook surfaces

| Route                              | Auth source                                     | Notes                                                             |
| ---------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| `/api/admin/*`                     | Clerk session + role check                      | Admin operations                                                  |
| `/api/appointments`                | Clerk session                                   | Authenticated user's appointments                                 |
| `/api/create-payment-intent`       | Public + Stripe + Redis lock                    | Booking checkout entry                                            |
| `/api/create-pack-checkout`        | Public + Stripe                                 | Pack checkout entry                                               |
| `/api/cron/*`                      | `CRON_SECRET` header from QStash or Vercel cron | All scheduled jobs (10 endpoints)                                 |
| `/api/qstash`                      | QStash signature verification                   | Generic QStash ingress                                            |
| `/api/novu`                        | Novu signature verification                     | Novu Framework bridge                                             |
| `/api/og`                          | Public                                          | Open Graph image generation                                       |
| `/api/upload`                      | Clerk session                                   | Vercel Blob uploads                                               |
| `/api/webhooks/clerk`              | Clerk webhook signature                         | User lifecycle sync to local `users` table                        |
| `/api/webhooks/stripe`             | Stripe webhook signature                        | Payments + Connect + Identity events (currently overlapping)      |
| `/api/webhooks/stripe-connect`     | Stripe webhook signature                        | Connect-specific account events                                   |
| `/api/webhooks/stripe-identity`    | Stripe webhook signature                        | Identity verification status                                      |
| `/api/healthcheck`                 | Public                                          | BetterStack endpoint                                              |
| `/api/test-email`, `/api/test-sentry` | Internal                                     | Manual integration smoke tests                                    |

## The proxy in detail

[proxy.ts](../../proxy.ts) is wired as the entry point. Important branches:

1. **Static asset bypass** — file extensions skipped before any work.
2. **Webhook bypass** — `SPECIAL_AUTH_ROUTES` (Stripe, Clerk, Novu, QStash) skip Clerk auth (they verify their own signatures).
3. **Cron bypass with `CRON_SECRET`** check.
4. **Public route allowlist** — `PUBLIC_ROUTES` includes `/`, `/[username]`, `/about`, `/legal/*`, etc.
5. **Locale handling** — custom country-based detection, `ELEVA_LOCALE` cookie persistence (1-year max-age).
6. **Clerk middleware** wraps everything else.
7. **Role gate** — `ADMIN_ROUTES` / `EXPERT_ROUTES` checked against Clerk `public_metadata.role`.
8. **Setup-incomplete redirect** — experts with `expert_setup` flag missing get pushed to `/setup`.

## Locale strategy

- `defaultLocale = 'en'`.
- `localePrefix: 'as-needed'` — `/about` is English; `/pt/about`, `/br/about`, `/es/about` are localized.
- Custom country-based detection in `lib/i18n/utils.ts` — Portuguese visitors from Portugal get `pt`, not `pt-BR`. Brazilian Portuguese maps to `br` (filename `br.json`).
- Locale persisted to `ELEVA_LOCALE` cookie for 1 year; subsequent visits skip detection.
- Email templates also localized via `emails/utils/i18n.ts`.

## What worked

- **Three-segment split** keeps the URL space clean (private vs public-localized vs api).
- **`(private)` route group** elides the `/private` prefix from URLs while still grouping in code.
- **Per-locale layouts** make i18n contextually correct on every page.

## What didn't

| Issue                                | Detail                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **God-file `proxy.ts`**              | 740+ lines mixing 10 concerns. Hard to test, hard to reason about ordering of branches.                         |
| **Three Stripe webhook routes**      | `/stripe`, `/stripe-connect`, `/stripe-identity` overlap. Some events handled twice, some dropped.              |
| **No Patient Portal**                | Patients can buy packs but get no first-class app surface — they live in the public funnel forever.             |
| **No Become-Partner application**    | Expert acquisition is manual, off-platform email. Should be a first-class capture form with admin queue.        |
| **`/api/cron/*` untested**           | Zero test coverage on cron handlers, despite their being the load-bearing async runtime.                        |
| **`api/users` and `api/user`**       | Both exist with overlapping handlers. Naming convention drift.                                                  |
| **`api/healthcheck` AND `api/health`** | Two health endpoints. Pick one in v2.                                                                         |
| **No `/api/workflows/*` namespace**  | Future Vercel Workflows handlers need a clean home.                                                             |

## v2 prescription

### 1. New top-level location: `src/app/`

The branch already moved everything under `src/`. Adopt-as-is. This signals "the runtime is one app inside a monorepo" and keeps `apps/web` clean.

### 2. Compose `src/proxy.ts` from handlers

Replace the god-file with composition:

```text
src/proxy.ts                       # 30 lines: orchestrator
src/lib/proxy/
├── webhookBypass.ts
├── cronAuth.ts
├── publicAllowlist.ts
├── workosAuth.ts                  # was: clerkMiddleware
├── i18n.ts
├── rbac.ts                        # JWT-claims-based, no DB hit
└── setupGate.ts
```

Each module exports `(req, ctx) => Promise<NextResponse | null>`. Compose with short-circuit `??`.

### 3. New top segments in v2

```text
src/app/
├── (private)/
│   ├── dashboard/
│   ├── appointments/
│   ├── account/
│   ├── setup/
│   └── admin/
├── (patient)/                     # NEW: Patient Portal (per branch spec)
│   ├── visits/
│   ├── documents/
│   ├── invoices/
│   └── records/
├── (public)/[locale]/
│   ├── page.tsx
│   ├── [username]/
│   ├── about/
│   ├── insights/                  # NEW: blog + podcast under Fumadocs
│   ├── become-partner/            # NEW: capture form
│   └── legal/
├── (auth)/[locale]/
│   ├── sign-in/
│   ├── sign-up/
│   └── onboarding/
└── api/
    ├── stripe/
    │   └── webhook/               # SINGLE Stripe webhook entrypoint
    ├── workos/
    │   └── webhook/               # WorkOS Directory + sync events
    ├── workflows/                 # Vercel Workflows handlers
    │   ├── booking-confirmation/
    │   ├── appointment-reminders/
    │   ├── multibanco-reminders/
    │   ├── payout-pipeline/
    │   └── ...
    ├── resend/
    │   └── webhook/               # delivery + bounce events from Resend
    ├── upload/
    └── og/
```

### 4. One Stripe webhook + typed router

Single endpoint at `/api/stripe/webhook` that:

1. Verifies signature with `STRIPE_WEBHOOK_SECRET`.
2. Inserts into `stripe_processed_events` (idempotency choke point).
3. Switches on `event.type` and dispatches to a typed handler in `packages/payments`.
4. Each handler enriches the PaymentIntent **before** any early return so Resend notifications fire even on disputes/refunds (current MVP bug; documented in `AGENTS.md`).

### 5. WorkOS replaces Clerk in the proxy

Switch from `clerkMiddleware` to WorkOS AuthKit session validation. RBAC checks read **JWT claims** (no DB hit) — see [05-identity-auth-rbac.md](05-identity-auth-rbac.md) and [18-rbac-and-permissions.md](18-rbac-and-permissions.md).

### 6. Patient Portal

Branch spec at `_docs/_rethink folder and menu structure/PATIENT-PORTAL-SPECIFICATION.md`. Adopt-as-is. Delivers booking history, upcoming visits, document uploads, downloadable invoices, and (eventually) shared records.

### 7. Become-Partner capture

Replace ad-hoc emailing with a first-class form at `/become-partner` → admin queue at `/admin/become-partner`. Status states: `submitted` → `under_review` → `invited` → `accepted` / `rejected`.

### 8. Locale strategy unchanged but cleaner

Keep `defaultLocale = 'en'`, `localePrefix: 'as-needed'`, `ELEVA_LOCALE` cookie. Document the `pt-BR` ↔ `br.json` asymmetry permanently in [12-internationalization.md](12-internationalization.md).

## Concrete checklist for the new repo

- [ ] All app code lives under `src/app/`.
- [ ] `src/proxy.ts` is < 50 lines and composes handlers from `src/lib/proxy/`.
- [ ] Single `/api/stripe/webhook` endpoint handles all Stripe events.
- [ ] Single `/api/workos/webhook` endpoint handles all WorkOS events.
- [ ] `/api/workflows/*` namespace exists for Vercel Workflows handlers.
- [ ] `/api/resend/webhook` for Resend delivery/bounce events.
- [ ] Patient Portal scaffolded at `(patient)/visits`, `(patient)/documents`, `(patient)/invoices`, `(patient)/records`.
- [ ] Become-Partner form at `(public)/[locale]/become-partner` and admin queue at `(private)/admin/become-partner`.
- [ ] No PostHog page view tracker.
- [ ] No `/api/test-*` endpoints in production env (gated by `process.env.NODE_ENV !== 'production'`).
- [ ] Removed redundant `api/users` vs `api/user` and `api/health` vs `api/healthcheck`.
