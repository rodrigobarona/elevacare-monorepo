# Eleva.care v3 Decision Log

Status: Living

## Purpose

This document is the lightweight companion to the ADR system.

Use it to track:

- notable decisions that do not yet justify a full ADR
- temporary decisions that need later confirmation
- decision status changes that should stay visible to the team

## How To Use This Log

Each entry should include:

- date
- decision summary
- owner
- status
- related docs or ADRs
- next review date if the decision is provisional

## Status Values

- `proposed`
- `active`
- `needs-review`
- `superseded`

## Current Entries

### 2026-04-22: Start with one authenticated product app

- Owner: architecture/product
- Status: active
- Summary: Eleva v3 will begin with one authenticated `apps/app` using route groups and RBAC rather than splitting into separate expert/patient/admin apps on day one.
- Reference: [`adrs/ADR-001-app-topology.md`](./adrs/ADR-001-app-topology.md)

### 2026-04-22: Bring `Eleva Diary` into the same monorepo later

- Owner: architecture/product
- Status: active
- Summary: The Expo mobile app should join the Eleva monorepo after shared auth/API/domain contracts are stable.
- Reference: [`mobile-integration-spec.md`](./mobile-integration-spec.md)

### 2026-04-22: Multi-zone routing is progressive, not day-one

- Owner: architecture/platform
- Status: active
- Summary: Keep multi-zone as a future optimization once routing/SEO/team needs justify it.
- Reference: [`master-architecture.md`](./master-architecture.md)

### 2026-04-22: Package manager — pnpm installer, bun as task runner (bun install banned)

- Owner: platform
- Status: active
- Summary: `pnpm` + Turborepo is the only installer and lockfile source of truth. Pin `"packageManager": "pnpm@<version>"`. Bun is allowed for `bun run` and `bun test`, never for install, to prevent lockfile drift between local and Vercel. Migration from current `bun.lock` + shadcn template is the first Phase 1 task.
- Reference: [`monorepo-structure.md`](./monorepo-structure.md), ADR-002

### 2026-04-22: Web analytics split — GA4 on apps/web, PostHog on apps/app

- Owner: product/platform
- Status: active
- Summary: Google Analytics 4 instruments the marketing website only. PostHog instruments the authenticated product only. No overlap. Consent banner gates both.
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)

### 2026-04-22: Feature flags — Vercel Flags SDK + Edge Config

- Owner: platform
- Status: active
- Summary: Vercel Flags SDK is the API/adapter surface. Vercel Edge Config is the default backend provider. PostHog adapter reserved for experimentation flags. All flag reads go through `packages/flags`. Drops WorkOS as flag provider.
- Reference: [`feature-flag-rollout-plan.md`](./feature-flag-rollout-plan.md), ADR-008

### 2026-04-22: Notifications — two-lane architecture, Novu retired

- Owner: platform
- Status: active
- Summary: Lane 1 (transactional, PHI-aware) = Vercel Workflows → Resend + Twilio EU + Neon inbox + Expo push, owned by `packages/notifications` with `sendNotification` entrypoint. Lane 2 (marketing, PHI-free) = Resend Automations triggered via `triggerAutomation` with consent-gated Neon→Resend contact sync. No direct `resend`/`twilio` imports outside `packages/notifications`. Novu is retired.
- Reference: [`notifications-spec.md`](./notifications-spec.md), ADR-006

### 2026-04-22: SMS provider — Twilio EU subaccount

- Owner: platform
- Status: active
- Summary: Twilio EU subaccount is the SMS provider for Lane 1 high-urgency transactional notifications (booking confirmation, 24h reminder, day-of prompt, cancellation). Per-user preferences and quiet hours enforced in `packages/notifications`.
- Reference: [`notifications-spec.md`](./notifications-spec.md)

### 2026-04-22: Durable workflow orchestration — Vercel Workflows DevKit

- Owner: platform
- Status: active
- Summary: Vercel Workflows DevKit handles every durable flow (booking confirmation, reminders, payment→entitlement, payout, transcript→AI→review, invoice issuance, DSAR, crypto-shredding). Upstash QStash is scoped to periodic cron only (drift checks, nightly digests, monthly reconciliation). Upstash Redis handles slot reservation and rate-limit locks.
- Reference: [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md), ADR-007

### 2026-04-22: Stripe — Connect Express + Dynamic Payment Methods + Embedded Components + single webhook

- Owner: payments
- Status: active
- Summary: Stripe API pinned ≥ 2023-08-16. `payment_method_types` never hardcoded — Dynamic Payment Methods auto-show the right set per country (PT = card + MB WAY + wallets; EU = SEPA/iDEAL/Bancontact per country). Enabled methods managed in Stripe Dashboard per environment. Two accounts (staging + production). Single `/api/stripe/webhook` endpoint per env handles all event types (Payment + Subscriptions + Connect + Identity) with idempotency via `stripe_event_log`. UX uses Embedded Components everywhere (Payment Element, Connect Onboarding/Payouts/Balances/Account Management/Tax/Notification Banner, Identity embedded modal). No redirects, no popups, no Customer Portal. `appearance` API themed to Eleva tokens. CSP allows Stripe domains.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-005

### 2026-04-22: Multibanco reference vouchers — excluded

- Owner: payments
- Status: active
- Summary: Multibanco voucher payments (7-day settlement + D3/D6/expiry reminder workflow) are out of scope for v3. MB WAY wallet (instant, Stripe-native) covers PT market. Revisiting requires a new ADR.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-005

### 2026-04-22: Marketplace monetization — hybrid (solo=commission, clinic=SaaS)

- Owner: product/commercial
- Status: active
- Summary: Segment-differentiated hybrid model grounded in Doctolib's EU health-marketplace precedent (€139/user/mo, 85% subscription revenue). Solo experts pay 15% commission per booking (reduced to 8% on Top Expert tier via Stripe Entitlements). Clinics/Orgs pay per-seat SaaS (Starter €99 + €39/seat; Growth €199 + €29/seat; Enterprise custom) with **zero commission** on member bookings (clinic Connect account receives 100% of booking, internal distribution is clinic's bookkeeping). Three-party revenue (clinic + Eleva + expert commission split) demoted to phase-2 opt-in behind `ff.three_party_revenue`.
- Reference: [`organization-and-clinic-model.md`](./organization-and-clinic-model.md), [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-005

### 2026-04-22: Accounting — two-tier invoicing, TOConline + adapter registry

- Owner: payments/compliance
- Status: active
- Summary: Tier 1 (Eleva→Expert/Clinic) uses TOConline OAuth — series `ELEVA-FEE-{YYYY}` for per-booking solo commission invoices, series `ELEVA-SAAS-{YYYY}` for monthly clinic SaaS invoices, idempotency via Neon. Tier 2 (Expert→Patient) uses a cal.com-style adapter registry in `packages/accounting/expert-apps/` with adapters for TOConline, Moloni, InvoiceXpress, Vendus, Primavera, Manual/SAF-T (P1 seed = TOConline + Moloni + Manual). Expert onboarding forces a choice (auto or manual). Clinic→Expert third-leg invoicing = clinic's own bookkeeping, out of scope. IVA matrix: PT=23%, EU-VIES=reverse-charge, EU-nonVIES=23%, non-EU=zero-rated (requires accountant sign-off).
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-013

### 2026-04-22: Tenancy isolation — Neon RLS with `withOrgContext()`

- Owner: platform/security
- Status: active
- Summary: Neon Postgres with RLS enabled on every tenant-scoped table, enforced via `withOrgContext()` in `packages/db`. Two Neon projects: `eleva_v3_main` (application) and `eleva_v3_audit` (immutable audit stream). All queries set `org_id` via `SET LOCAL` inside the helper; RLS policies verify per-role access.
- Reference: [`compliance-data-governance.md`](./compliance-data-governance.md), ADR-003

### 2026-04-22: Video — Daily.co EU region

- Owner: platform
- Status: active
- Summary: Daily.co EU region for video sessions and transcripts. Transcripts are Eleva-owned records encrypted at rest via WorkOS Vault references. Transcript content never leaks into notifications, analytics, or AI-gateway logs.
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md), ADR-009

### 2026-04-22: Calendar OAuth ownership — Eleva, not WorkOS Pipes

- Owner: platform
- Status: active
- Summary: `packages/calendar` owns Google + Microsoft OAuth, token refresh, event read/write, and webhook subscription. Tokens stored in WorkOS Vault. WorkOS Pipes is explicitly not used for calendar sync.
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md), ADR-004

### 2026-04-22: Launch market — Portugal-first

- Owner: product/compliance
- Status: active
- Summary: v3 launches Portugal-first. Launch requirements: PT/EN/ES locales, MB WAY + Stripe Tax PT, NIF collection, TOConline Tier 1 invoicing with pilot expert green, consent banner, ERS PT compliance docs published at `apps/docs/compliance/portugal/`, Daily/Neon/Resend/WorkOS EU regions confirmed, DSAR workflow tested, Vault crypto-shredding test passing, Tier 2 invoicing registry with ≥2 adapters (TOConline expert-side + Moloni) production-tested, Become-Partner admin verification enforcing invoicing choice.
- Reference: [`compliance-data-governance.md`](./compliance-data-governance.md), [`roadmap-and-milestones.md`](./roadmap-and-milestones.md), ADR-012

## Related Docs

- [`adrs/README.md`](./adrs/README.md)
- [`master-architecture.md`](./master-architecture.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`contribution-workflow.md`](./contribution-workflow.md)
