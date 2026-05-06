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

### 2026-04-22: Calendar OAuth ownership — Eleva, not WorkOS Pipes (reaffirmed)

- Owner: platform
- Status: active
- Summary: `packages/calendar` owns Google + Microsoft OAuth, token refresh, event read/write, and webhook subscription. Tokens stored in WorkOS Vault. WorkOS Pipes is explicitly not used for calendar sync. Re-evaluated: keeping Eleva-owned protects booking-critical flows that need idempotent event creation with client-supplied IDs, multi-calendar busy/destination modeling, real-time freebusy, explicit token-expiry surfacing, and Pub/Sub cache invalidation — none of which Pipes exposes with the fidelity we need. WorkOS Pipes remains valid for identity-side integrations (SCIM, directory sync, SSO federation).
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md), ADR-004

### 2026-04-22 (revision): Public surface — app at root + API on subdomain + docs at `/docs`

- Owner: platform
- Status: active (supersedes the earlier 2026-04-22 multi-zone entry below)
- Summary: Revised the multi-zone model to match vercel.com / resend.com / linear.app conventions. Authenticated routes live at the `eleva.care` **root** (`/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout`) — rewritten individually from the gateway to `apps/app`, which runs without a `basePath`. APIs (external webhooks, OAuth callbacks, session-aware endpoints like Stripe AccountSession) live on the dedicated **`api.eleva.care`** subdomain — separation of concerns, no `/api` path collisions with the product. Docs stay at `eleva.care/docs/*` for SEO authority (zone rewrite to `apps/docs`, `basePath: '/docs'`). Context-sensitive root: `/` with session 302-redirects to role home; `/` without session serves marketing; `/home` is the always-marketing escape hatch. Cookies scoped to `.eleva.care` keep gateway/app same-origin; CORS + credentials handle cross-origin calls to `api.eleva.care`. Reserved-paths list expanded (add `patient`/`expert`/`org`/`admin`/`settings`/`callback`/`logout`/`home`); `app` and `api` removed from the reserved list. ADR-014 revised in place.
- Reference: [`adrs/ADR-014-multi-zone-rewrites.md`](./adrs/ADR-014-multi-zone-rewrites.md), [`environment-matrix.md`](./environment-matrix.md), [`monorepo-structure.md`](./monorepo-structure.md), [`identity-rbac-spec.md`](./identity-rbac-spec.md), [`_context/blueprints/multi-zone-monorepo.md`](../../_context/blueprints/multi-zone-monorepo.md)

### 2026-04-22 (superseded): Public surface architecture — multi-zone rewrites, single canonical domain

- Owner: platform
- Status: superseded (see revision above, same day)
- Summary: Original multi-zone entry proposed `/app/*`, `/api/*`, `/docs/*` all as zone-rewrite prefixes under `eleva.care`. Revised on the same day to move APIs to `api.eleva.care` subdomain and drop the `/app` prefix so authenticated routes live at the root. Original text preserved below for historical reference.
- Original text: `eleva.care` is the only public domain. Gateway app `apps/web` owns the root and rewrites `/app/*`, `/api/*`, `/docs/*` to sibling Vercel projects via multi-zone. Sub-apps declare matching `basePath`. Internal Vercel project URLs (`elevacare-app.vercel.app`, etc.) serve `noindex` + `robots.txt` disallow OR 301 to canonical. Third-party-hosted surfaces (`status.eleva.care` BetterStack, `sessions.eleva.care` Daily) stay as subdomains. Single-domain cookies on `.eleva.care` eliminate CORS and cross-subdomain auth friction.

### 2026-04-22: Short URLs — cal.com style, username-first, `as-needed` locale

- Owner: product/platform
- Status: active
- Summary: Public profile URLs at `eleva.care/[username]` (experts and clinics share the root namespace), booking URLs at `eleva.care/[username]/[event-slug]`. Locale prefix `as-needed`: EN at root, PT/ES prefixed. Drop the `/e/` segment. Reserved-paths list in `@eleva/config/reserved-usernames.ts` (Sprint 1) enforced at signup, DB CHECK constraint, and admin tooling. Username format: 3-30 chars, lowercase `[a-z0-9-]`, no leading/trailing/consecutive hyphens. Event slugs case-insensitive unique per expert. Collision prevention across expert/clinic namespaces via shared unique constraint and reserved list.
- Reference: [`identity-rbac-spec.md`](./identity-rbac-spec.md), [`scheduling-booking-spec.md`](./scheduling-booking-spec.md), [`search-and-discovery-spec.md`](./search-and-discovery-spec.md)

### 2026-04-22: PR review gate — CodeRabbit AI required before merge

- Owner: platform
- Status: active
- Summary: `.coderabbit.yaml` at repo root drives default review config. GitHub branch protection on `main` requires the `coderabbit` status check in addition to lint/typecheck/Vitest/Playwright smoke/boundary lint/i18n parity/RLS isolation test. PR author must acknowledge or address every CodeRabbit comment (reply or fix) before merge. Documented in [`contribution-workflow.md`](./contribution-workflow.md).
- Reference: [`implementation-sprints.md`](./implementation-sprints.md) Global Rules + Sprint 0

### 2026-04-22: Audit write pipeline — transactional outbox between Neon main and audit projects

- Owner: platform/security
- Status: active
- Summary: Two Neon projects stay (`eleva_v3_main` + `eleva_v3_audit`). `withAudit(action, entity, fn)` writes domain rows **and** `main.audit_outbox` row in the same main-DB transaction — atomic commit preserves transactional integrity across the physically separated audit store. `auditOutboxDrainer` Vercel Workflow (ADR-007) copies outbox rows to `eleva_v3_audit.audit_events` with at-least-once delivery (idempotent on pre-generated `audit_id` UUID); marks outbox row `shipped`. Shipped rows purged after 90 days. Audit DB RLS: INSERT via drainer credentials only; SELECT filtered by `org_id` OR `audit:view_all` capability; UPDATE/DELETE revoked. Hash-chain option (prev_hash + row_hash) additive in Sprint 7 for ISO 27001 / SOC 2 integrity evidence. Compliance-control mapping (GDPR Art. 30/17, HIPAA 164.312(b)/(c), ISO 27001 A.12.4, SOC 2 CC7.3) recorded in compliance spec.
- Reference: [`adrs/ADR-003-tenancy-and-rls.md`](./adrs/ADR-003-tenancy-and-rls.md), [`compliance-data-governance.md`](./compliance-data-governance.md)

### 2026-04-22: DNS management — Vercel Domains for `eleva.care`

- Owner: platform
- Status: active
- Summary: Vercel manages the entire DNS for `eleva.care` (A/AAAA/CNAME/MX/TXT including SPF/DKIM/DMARC/BIMI). Locked subdomain split: `eleva.care` → `apps/web`, `app.eleva.care` → `apps/app`, `api.eleva.care` → `apps/api` (all webhooks + server callbacks), `docs.eleva.care` → `apps/docs`, `status.eleva.care` → BetterStack, `sessions.eleva.care` → Daily.co branded CNAME, `*.preview.eleva.care` wildcard for PR previews. Staging mirrors this with `staging-` prefix. Wildcard SSL on `*.eleva.care`.
- Reference: [`environment-matrix.md`](./environment-matrix.md), [`monorepo-structure.md`](./monorepo-structure.md)

### 2026-04-22: RBAC backbone — WorkOS `admin`/`member` defaults + capability bundles

- Owner: platform
- Status: active
- Summary: Eleva uses WorkOS's default `admin` and `member` roles as **org-seniority** (not product labels). Product labels are derived from `(org_type, workos_role)` plus capability bundles loaded from `infra/workos/rbac-config.json`. Patient = `admin` of personal org; solo expert = `admin` of solo org; clinic admin = `admin` of clinic org; expert-in-clinic = `member` of clinic org; Eleva staff = `admin` of a single internal `eleva-operator` org with cross-org capability grants.
- Reference: [`identity-rbac-spec.md`](./identity-rbac-spec.md), ADR-003

### 2026-04-22: Launch market — Portugal-first

- Owner: product/compliance
- Status: active
- Summary: v3 launches Portugal-first. Launch requirements: PT/EN/ES locales, MB WAY + Stripe Tax PT, NIF collection, TOConline Tier 1 invoicing with pilot expert green, consent banner, ERS PT compliance docs published at `apps/docs/compliance/portugal/`, Daily/Neon/Resend/WorkOS EU regions confirmed, DSAR workflow tested, Vault crypto-shredding test passing, Tier 2 invoicing registry with ≥2 adapters (TOConline expert-side + Moloni) production-tested, Become-Partner admin verification enforcing invoicing choice.
- Reference: [`compliance-data-governance.md`](./compliance-data-governance.md), [`roadmap-and-milestones.md`](./roadmap-and-milestones.md), ADR-012

### 2026-05-05: Onboarding, admin verification, and expert finance platform

- Owner: platform/product
- Status: active
- Summary: Expert onboarding is a multi-step wizard (Profile, Stripe Connect, Identity Verification, Invoicing Setup, First Event Type). Admin Become-Partner flow provisions org + expert profile + Stripe Connect account on approval. Finance surface exposes invoicing status and Stripe payout/balance dashboards. API layer (`apps/api`) handles OAuth callbacks, adapter status, and Stripe Identity session creation with CORS, RLS, and capability checks. Invoicing choice is enforced at onboarding via the Tier 2 adapter registry (`packages/accounting`). Multi-step wizard is the sole onboarding entry point; admin approval is required before an expert can onboard; API surface requires CORS for cross-origin `app.eleva.care` to `api.eleva.care` calls.
- Reference: [`adrs/ADR-005-payments-and-monetization.md`](./adrs/ADR-005-payments-and-monetization.md), [`adrs/ADR-013-accounting-integration.md`](./adrs/ADR-013-accounting-integration.md), [`payments-payouts-spec.md`](./payments-payouts-spec.md)

### 2026-05-06: Calendar OAuth — WorkOS Pipes for credential management (supersedes 2026-04-22)

- Owner: platform
- Status: active (supersedes "Calendar OAuth ownership — Eleva, not WorkOS Pipes" entry from 2026-04-22)
- Summary: Calendar OAuth credential management (token storage, refresh, revocation) is delegated to WorkOS Pipes. `packages/calendar` retains ownership of the Google/Microsoft API surface (event create/read/delete, freebusy, webhook subscriptions) but no longer manages raw tokens directly — instead it requests access tokens from WorkOS Pipes via the user's `workosUserId` and provider slug. This aligns with the ADR-004 amendment (2026-05) and the scheduling-booking-spec §Calendar Integration. The April decision's rationale about needing fidelity for booking-critical flows remains valid for the API layer; the change is purely about who stores/refreshes the OAuth credentials, not who calls the calendar APIs.
- Reference: [`adrs/ADR-004-scheduling-and-calendar-oauth.md`](./adrs/ADR-004-scheduling-and-calendar-oauth.md) (amended 2026-05), [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)

## Related Docs

- [`adrs/README.md`](./adrs/README.md)
- [`master-architecture.md`](./master-architecture.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`contribution-workflow.md`](./contribution-workflow.md)
