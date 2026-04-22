# Eleva.care v3 Vendor Decision Matrix

Status: Authoritative

## Purpose

This document captures the current vendor choices, why they are being considered, what they should own, and which risks or validation items remain open.

It should be used by:

- engineering
- product
- operations
- compliance/legal review

This is not a procurement file. It is a technical decision matrix for implementation planning.

## Decision Principles

- Prefer vendors that fit the EU-first compliance posture.
- Keep vendor responsibilities explicit and bounded.
- Avoid using one vendor outside its natural boundary just because it is available.
- Record open risks before implementation hardens around assumptions.

## Matrix

### Package manager and build tooling

#### pnpm + Turborepo

Decision status: **locked**

Expected role:

- single installer and lockfile source of truth
- workspace and task orchestration
- remote build cache via Vercel

Why it fits:

- consistent dependency resolution between local dev and CI/Vercel
- mature monorepo story
- widely used across next-forge/cal.com/shadcn ecosystems

Rules:

- pin `"packageManager": "pnpm@<version>"` in root `package.json`
- bun is allowed as a task/script runner (`bun run`, `bun test`) but **never** for `install`
- CI verifies no `bun.lock` exists

### Authentication, organizations, and secure identity

#### WorkOS

Decision status: **locked**

Expected role:

- authentication and SSO
- organizations and memberships
- session model
- RBAC primitives (combined with Eleva-side permission layer and Neon RLS)
- Vault for sensitive/encrypted fields (OAuth tokens, encrypted PHI references)

Why it fits:

- B2B and organization-aware identity primitives
- Vault simplifies encrypted-at-rest handling without rolling custom KMS

Region: **EU**.

Open validations:

- final permission-model boundary between WorkOS RBAC, Eleva app permissions, and Neon RLS
- DPA + subprocessor posture for EU tenants

### Database and core persistence

#### Neon

Decision status: **locked**

Expected role:

- primary Postgres database
- two projects: `eleva_v3_main` (application) and `eleva_v3_audit` (immutable audit stream)
- RLS enabled on every tenant-scoped table, enforced via `withOrgContext()` helper in `packages/db`

Why it fits:

- serverless-friendly, fits Vercel deployment model
- branch-per-PR DX
- strong Drizzle compatibility

Region: **EU**.

Open validations:

- point-in-time recovery and backup policy
- cross-project audit writes and retention strategy

#### Drizzle

Decision status: **locked**

Expected role:

- ORM, schema definition, migrations, typed data access

Why it fits:

- explicit schema ownership
- strong TypeScript ergonomics
- good fit for package-based monorepo architecture

### Payments, subscriptions, and payouts

#### Stripe

Decision status: **locked**

Expected role:

- checkout and payment collection via **Payment Element** (Dynamic Payment Methods enabled)
- **Stripe Connect Express** for expert and clinic payout accounts
- **Stripe Subscriptions** for expert "Top Expert" tier and clinic per-seat SaaS tiers
- **Stripe Tax** for PT/NIF rules
- **Stripe Entitlements** for plan gating via `packages/flags`
- **Stripe Identity** for expert KYC (embedded modal)
- payout rails + marketplace two-party financial lifecycle

Why it fits:

- best marketplace + subscriptions + payouts ecosystem
- Dynamic Payment Methods mean MB WAY auto-shows for PT, SEPA/iDEAL/Bancontact auto-show per EU country — no code changes to expand payment methods
- Embedded Components mean native-feeling UX without redirects

UX rules:

- **Stripe Embedded Components everywhere**: Payment Element, Connect Embedded Components (Onboarding/Payouts/Balances/Account Management/Documents/Tax/Notification Banner), Identity embedded modal
- **No redirects, no popups, no Customer Portal.** Subscription management is Eleva UI + Payment Element + Billing API.
- `AccountSession` tokens minted server-side per screen with precise permissions (`/api/stripe/account-session`), RBAC-gated
- Branded via `appearance` API mapped to Eleva design tokens; dark-mode supported; `locale` wired to next-intl
- CSP allows `js.stripe.com`, `connect-js.stripe.com`, `*.stripe.com` in `script-src` and `frame-src`

API + infra rules:

- API version pinned **≥ 2023-08-16** so Dynamic Payment Methods are on by default
- **Never hardcode `payment_method_types`** on PaymentIntents or Checkout Sessions
- Enabled payment methods managed in **Stripe Dashboard** per environment (staging + production accounts each configure their own set)
- Two accounts: `staging` and `production`, each with its own Connect platform and webhook
- **Single webhook endpoint** `/api/stripe/webhook` per environment handles every event type (Payment + Subscriptions + Connect + Identity); dispatch by `event.type` inside the handler
- Idempotency on `event.id` via Neon `stripe_event_log(id PK, type, livemode, received_at, processed_at)`

Explicit exclusions:

- **Multibanco reference vouchers** are excluded. 7-day settlement + voucher reminder workflow (D3/D6/expiry) is complexity without upside given MB WAY covers PT instant wallet payments. Revisiting requires a new ADR.

Open validations:

- final IVA/VAT matrix sign-off with accountant (PT=23%, EU-VIES=reverse-charge, EU-nonVIES=23%, non-EU=zero-rated)

### Marketplace monetization model

Decision status: **locked — segment-differentiated hybrid**

Grounded in Doctolib's EU health-marketplace pattern (~€139/user/mo, 85% subscription revenue, 340K+ practitioners), MarketplaceBeat monetization guidance, and Monetizely clinic-SaaS pricing research (3+ tiers = 26% higher ARPA).

#### Solo experts — commission

- default 15% platform fee per booking
- reduced to 8% on paid **Top Expert** subscription tier (€29/mo), gated via Stripe Entitlements
- zero-cost entry; no forced subscription

#### Clinics / Organizations — per-seat SaaS, no booking commission

- **Clinic Starter** — €99/clinic/mo + €39/seat/mo (1–5 seats)
- **Clinic Growth** — €199/clinic/mo + €29/seat/mo (6–20 seats)
- **Clinic Enterprise** — custom contract (20+ seats, multi-location, SLA, dedicated CSM)
- clinic's Stripe Connect account receives 100% of member bookings; internal clinic↔expert splits are the clinic's bookkeeping
- add-ons (drive ARPA): AI report credit bundles, premium Daily video minutes, extra CRM seats, SAF-T export automation

#### Three-party revenue (phase-2, opt-in)

- demoted behind `ff.three_party_revenue` (default off)
- shipped only when a specific clinic negotiates a commission overlay on top of SaaS
- entities `clinic_memberships`, `commission_rule`, `application_fee_breakdown` exist only for this flag path

### Video and transcripts

#### Daily.co

Decision status: **locked**

Expected role:

- video/audio sessions
- room/session infrastructure
- transcription source (via Daily's transcript feature)

Why it fits:

- strong SDK + EU region + native transcript pipeline

Region: **EU**.

Rules:

- transcripts are **Eleva-owned records**, encrypted at rest via WorkOS Vault references
- transcript retention defined per ADR-009
- no transcript content leaks into notifications, analytics, or AI-gateway logs

### Email and lifecycle messaging

#### Resend (two-lane usage)

Decision status: **locked**

Expected role:

- **Lane 1 — Transactional email** (`sendNotification` in `packages/notifications`): booking confirmation, pre/post-appointment reminders, payment confirmations, payouts, calendar disconnected, report available, etc.
- **Lane 2 — Marketing lifecycle via Resend Automations** (`triggerAutomation` in `packages/notifications`): welcome series, re-engagement, pack-expiry nurture, Become-Partner onboarding, newsletter/broadcast, abandoned-checkout. Email-only, **PHI-free payloads**.
- Neon→Resend one-way consent-gated contact sync (only contacts with `marketing_consent = true`)

Region: **EU**.

Rules:

- CI rule: no direct `resend` imports outside `packages/notifications`
- Novu is retired

### SMS

#### Twilio

Decision status: **locked**

Expected role:

- SMS delivery for high-urgency transactional notifications (booking confirmation, 24h reminder, day-of prompt, cancellation)

Region: **EU subaccount**.

Rules:

- accessed only through `packages/notifications` Lane 1
- per-user preference + quiet-hours respected
- CI rule: no direct `twilio` imports outside `packages/notifications`

### Product analytics

#### PostHog

Decision status: **locked**

Expected role:

- product analytics on `apps/app` (authenticated product)
- event taxonomy + funnels + retention for experts, patients, admins
- **optional future adapter** for Vercel Flags SDK when Eleva needs experimentation flags

Region: EU / privacy-first configuration.

Rules:

- marketing website (`apps/web`) uses GA4 instead of PostHog
- PHI and session transcripts never sent to PostHog

### Web analytics

#### Google Analytics 4

Decision status: **locked**

Expected role:

- marketing analytics on `apps/web` only

Rules:

- respects consent banner (opt-in EU default)
- never loaded on `apps/app`

### Error monitoring

#### Sentry

Decision status: **locked**

Expected role:

- error tracking
- performance tracing (scoped)
- correlation-ID propagation via `AsyncLocalStorage`

Region: **EU**.

Rules:

- sensitive payloads scrubbed
- PHI never sent

### Logging and uptime

#### BetterStack

Decision status: **locked**

Expected role:

- log aggregation (structured, redacted)
- uptime monitoring + heartbeats (paired with durable workflows)
- on-call alerting + status page

Region: **EU**.

### Rate limiting, Redis, and scheduled cron

#### Upstash (Redis + QStash)

Decision status: **locked**

Expected role:

- **Upstash Redis**: slot reservation (booking concurrency), rate limiting, ephemeral locks, short-lived caches
- **QStash**: periodic cron only (drift checks, nightly digests, monthly Stripe↔TOConline reconciliation)

Rules:

- core durable orchestration (booking, payments, payouts, transcripts, invoicing, DSAR) goes through **Vercel Workflows DevKit**, not QStash
- Upstash is for ephemeral coordination and simple periodic triggers

### Durable workflow orchestration

#### Vercel Workflows DevKit

Decision status: **locked**

Expected role:

- durable step graphs with retries, idempotency, observability
- owns: booking confirmation, reminder sequences, payment→entitlement→finalize, payout eligibility→approval→transfer, transcript→AI→review, platform-fee invoice issuance, expert-side invoice issuance + retry queue, DSAR export, Vault crypto-shredding

Rules:

- correlation ID propagated to Sentry + BetterStack + audit log
- explicit idempotency key per step (`booking_id`, `event_id`, `stripe_event_id`, etc.)

### AI abstraction

#### Vercel AI Gateway

Decision status: **locked**

Expected role:

- exclusive model router for Eleva AI pipelines (transcript summarization, AI report drafting, CRM suggestions)
- provider abstraction, cost tracking, fallback routing

Rules:

- no direct LLM provider SDKs outside `packages/ai`
- prompt contracts versioned; PHI handling governed by ADR-009

### Feature flags

#### Vercel Flags SDK + Vercel Edge Config

Decision status: **locked**

Expected role:

- **Vercel Flags SDK** — API/adapter surface used by the app code
- **Vercel Edge Config** — default provider for platform flags (kill-switches, phased rollouts, tenant-scoped toggles)
- **PostHog adapter** — reserved for future experimentation flags when product has traffic

Rules:

- all flag reads go through `packages/flags`
- no direct `@vercel/flags` or `posthog-js` flag calls outside `packages/flags`
- seed flags: `ff.clinic_subscription_tiers` (on), `ff.three_party_revenue` (off), `ff.sms_enabled`, `ff.mbway_enabled`, `ff.ai_reports_beta`, `ff.diary_share`, `ff.toconline_invoicing_enabled`, `ff.expert_invoicing_apps_enabled`, `ff.invoicing.{provider}`

### Accounting and certified invoicing

#### TOConline (OAuth, Portugal)

Decision status: **locked as Tier 1 adapter**

Expected role:

- Tier 1 — Eleva → Expert/Clinic platform-fee invoicing
- series `ELEVA-FEE-{YYYY}` for per-booking solo commission invoices
- series `ELEVA-SAAS-{YYYY}` for monthly clinic SaaS invoices
- OAuth tokens stored in WorkOS Vault
- sandbox environment → Eleva staging, production environment → Eleva production

Rules:

- accessed only through `packages/accounting/eleva-platform/toconline`
- idempotency via Neon `platform_fee_invoices(booking_id PK, toconline_invoice_id, ...)` and `clinic_saas_invoices(subscription_period PK, toconline_invoice_id, ...)`
- IVA matrix applied server-side
- monthly Stripe↔TOConline reconciliation cron (QStash) reports to `/admin/accounting`

#### Expert → Patient invoicing registry (Tier 2)

Decision status: **locked — adapter registry**

Expected role:

- optional automation of the expert's own service invoice to the patient
- cal.com-style app registry in `packages/accounting/expert-apps/adapters/`
- seed adapters (priority order):
  - **P1**: TOConline (expert-side), Moloni, Manual/SAF-T-export
  - **P2**: InvoiceXpress, Vendus
  - **P3**: Primavera Cloud
  - **Phase-2 ES**: Holded, FacturaDirecta
- `ExpertInvoicingAdapter` interface: `connect / issueInvoice / status / disconnect`
- per-expert credentials in Neon `expert_integration_credentials`, encrypted via WorkOS Vault

Rules:

- expert onboarding (Become-Partner flow) forces a choice: auto-connect or manual acknowledgment
- admin verification in Become-Partner review before expert can accept bookings
- per-adapter feature flags (`ff.invoicing.{provider}`) for staged rollout
- clinic→expert third-leg invoices are clinic's own bookkeeping, out of scope

### Calendar sync

#### Eleva-owned Google + Microsoft OAuth

Decision status: **locked**

Expected role:

- `packages/calendar` owns OAuth flows, token refresh, event read/write, webhook subscription
- tokens stored in WorkOS Vault

Rules:

- **not** WorkOS Pipes
- busy-calendar and destination-calendar concepts (per cal.com pattern)

### Internationalization

#### next-intl

Decision status: **locked**

Expected role:

- localization routing + message handling
- locale set for v3: `pt`, `en`, `es` (Portugal-first launch)

### Content and docs

#### Fumadocs

Decision status: **locked**

Expected role:

- `apps/docs` — product docs, help content, compliance pages (ERS PT documentation at `apps/docs/compliance/portugal/`)
- markdown + typed content loaders (`packages/content` when needed)

## Summary — locked stack

- Package manager: **pnpm** + Turborepo
- Auth: **WorkOS** (EU)
- DB: **Neon** (EU) + **Drizzle**, RLS + two projects
- Payments: **Stripe** (Connect Express + Subscriptions + Entitlements + Dynamic Payment Methods + Embedded Components, no Multibanco vouchers)
- Monetization: hybrid (solo=commission, clinic=SaaS)
- Video: **Daily.co** (EU)
- Transactional email: **Resend** (Lane 1)
- Marketing email: **Resend Automations** (Lane 2)
- SMS: **Twilio** (EU subaccount)
- Product analytics: **PostHog**
- Web analytics: **Google Analytics 4** (marketing only)
- Error tracking: **Sentry** (EU)
- Logs + uptime: **BetterStack** (EU)
- Redis + cron: **Upstash**
- Durable workflows: **Vercel Workflows DevKit**
- AI: **Vercel AI Gateway** (exclusive)
- Feature flags: **Vercel Flags SDK + Edge Config**
- Accounting Tier 1: **TOConline**
- Accounting Tier 2: **Adapter registry** (TOConline, Moloni, InvoiceXpress, Vendus, Primavera, Manual/SAF-T)
- Calendar OAuth: **Eleva-owned** (`packages/calendar`), not WorkOS Pipes
- i18n: **next-intl** (pt/en/es)
- Docs/CMS: **Fumadocs**

## Required Follow-Up Decisions

- IVA/VAT matrix accountant sign-off (PT=23%, EU-VIES=reverse-charge, EU-nonVIES=23%, non-EU=zero-rated)
- per-vendor DPA review and EU region confirmation for production launch
- final logging/redaction policy (BetterStack + Sentry)
- Clinic Enterprise tier pricing per deal type

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`decision-log.md`](./decision-log.md)
- [`adrs/README.md`](./adrs/README.md)
- [`compliance-data-governance.md`](./compliance-data-governance.md)
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
- [`notifications-spec.md`](./notifications-spec.md)
- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`organization-and-clinic-model.md`](./organization-and-clinic-model.md)
- [`feature-flag-rollout-plan.md`](./feature-flag-rollout-plan.md)
