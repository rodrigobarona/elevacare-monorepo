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

### 2026-09-09: Domain-events outbox for booking guest activation

- Owner: engineering
- Status: accepted
- Summary: Phase 04.2d adds `domain_events_outbox` + `domain_event_deliveries`
  (service-only, org-scoped writes plus `eleva.platform_admin` /
  `eleva.service = 'domain_events_publisher'`). Confirm and the Stripe
  `payment_intent.succeeded` webhook flip `pending_payment` → `confirmed`
  and enqueue `booking.guest_activation_required`. The publisher claims
  deliveries (`processing` + stale reclaim), runs subscribers outside the
  claim transaction, and never stores guest email/name in the durable
  payload. Guest activation reads contact fields from `bookings` under
  `withOrgContext` and sends a Better Auth magic link once
  (`guest_activation_sent_at`). Cancel/reschedule and refund execution
  stay out of this slice.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md),
  [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)

### 2026-09-09: Remove internal `apps/poc` playground

- Owner: engineering
- Status: active
- Summary: Deleted `@eleva/poc` (`apps/poc`) and companion specs in
  `_context/PoCs`. Wizard/map UI lived only inside that app (not shared
  packages). Dropped cataloged Leaflet deps (`leaflet`, `react-leaflet`,
  `@types/leaflet`) and CI exclusions (`turbo --filter=!@eleva/poc`,
  lint-staged / CodeRabbit / i18n-parity / proxy-test skips).
  `_context/mobbin/` stays as design screenshot references.
- Reference: [`contribution-workflow.md`](./contribution-workflow.md)

### 2026-09-08: Local Better Auth e2e capture stays out of production Redis

- Owner: engineering
- Status: active
- Summary: Playwright auth (`pnpm e2e:auth`) reads verify/reset/magic URLs
  from Upstash only when `E2E_AUTH_CAPTURE=1` **and** the runtime is not
  production (`VERCEL_ENV` / `NODE_ENV`). Keys are `e2e:auth-url:{kind}:{sha256(email)}`
  with a 5-minute TTL so KV never stores a raw address or a production
  one-time link. Direct Neon `email_verified` writes stay behind
  `E2E_ALLOW_DB_WRITES=1` and are unused when capture works. Auth rate
  limiting stays on for Vercel production and preview even if the capture
  flag is set. Operators set `E2E_AUTH_CAPTURE=1` in local `.env.local`
  only; never on the production Vercel project.
- Reference: [`environment-matrix.md`](./environment-matrix.md),
  [`../../e2e/AUTH-USER-TESTING.md`](../../e2e/AUTH-USER-TESTING.md)

### 2026-05-21: v3 icon SSOT / import boundary policy

- Owner: design/platform
- Status: active
- Summary: Product iconography uses **`@eleva/icons`** as the single source of truth ([Phosphor Icons](https://phosphoricons.com)). Apps import SSR-safe icons from `@eleva/icons`; client wrappers (`NavIcon`, `ElevaIcon`, `getNavIcon`) from `@eleva/icons/client`. **Never** import `lucide-react` or `@phosphor-icons/react` outside `packages/icons`. Server layouts pass `NavIconName` string literals (not icon components) across the RSC boundary. **Weights:** `light` for idle sidebar nav, `duotone` for active nav and illustrations ≥ 32px, `regular` for UI chrome. **`expert-verified-icon.svg`** is a trust/marketing asset, not part of the icon registry.
- Reference: [brand book §Iconography](./brand-book/README.md#iconography), `.cursor/rules/eleva-icons.mdc`, `packages/icons/`

### 2026-05-19: Stripe Phase 1+2 cutover — PRODUCTION READY (audit complete)

- Owner: platform/billing
- Status: active
- Summary: 8-phase production-readiness audit completed evening of 2026-05-19, grounded in current Stripe + WorkOS docs via Context7. All 11 original done-criteria remain PASS. New evidence: real-customer happy path verified end-to-end (first non-fixture event in lifetime hit dispatcher as `processed`, mirror + audit + ordering protection all healthy); 5/5 adversarial webhook security tests passed (missing/wrong/stale/tampered signatures all 400); subscription lifecycle full coverage (create/upgrade/cancel-AP/cancel-now); F3 ordering protection refuses stale replays correctly; idempotency under 5-replay storm produced 0 duplicate audit rows; audit pipeline coherence (outbox shipped count == audit_events count exactly); webhook p95 = 1999ms (within Stripe-recommended ack budget). Bonus: a real user provisioned a real org during the audit window with full pipeline working end-to-end with no agent intervention. Two non-blocking findings flagged for backlog: **N7** Stripe Entitlements API returns empty in Sandbox (re-test on live to confirm WorkOS Add-on JWT-claim path); **N8** webhook handler error column lacks PG diagnostic detail (one-line fix). ADR-016 can flip from `Accepted` to `Active` immediately.
- Reference: [`operator-tasks/stripe-phase-1-2-cutover.md`](./operator-tasks/stripe-phase-1-2-cutover.md), [`adrs/ADR-016-subscription-ux-direction.md`](./adrs/ADR-016-subscription-ux-direction.md)
- Next review: only triggered by a P1+ incident or major Stripe API version migration

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
- Summary: Stripe API pinned ≥ 2023-08-16. `payment_method_types` never hardcoded for booking checkout — Dynamic Payment Methods auto-show the right set per country (PT = card + MB WAY + wallets; EU = SEPA/iDEAL/Bancontact per country). Subscription Checkout limited to `card + sepa_debit` per ADR-016 (MB WAY/Multibanco are one-time-only). Enabled methods managed in Stripe Dashboard per environment. Two accounts (staging + production). Single `/webhooks/stripe` endpoint per env handles all event types (Payment + Subscriptions + Connect + Identity) with idempotency via `stripe_webhook_events`. UX uses Embedded Checkout for SaaS purchase + Customer Portal for management per ADR-016, plus Connect/Identity Embedded Components, Payment Element for booking checkout. `appearance` API themed to Eleva tokens. CSP allows Stripe domains.
- Superseded in part (2026-09-07): the booking-checkout method set is now fixed by D-14 (Payment Method Configuration `STRIPE_PMC_BOOKING`: `card` incl. wallets, `link`, `mb_way` only; Multibanco, SEPA Direct Debit, Klarna and every delayed-notification method off) and the launch currency by D-02 (EUR only). The "never hardcode `payment_method_types`" rule stands — the configuration decides, not a list in code.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-005, ADR-016

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
- Summary: Daily.co EU region for video sessions and transcripts. Transcripts are Eleva-owned records encrypted at rest (originally via WorkOS Vault references; **superseded in part 2026-09-07** — now `@eleva/encryption` envelope encryption per ADR-020). Transcript content never leaks into notifications, analytics, or AI-gateway logs.
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md), ADR-009

### 2026-04-22: Calendar OAuth ownership — Eleva, not WorkOS Pipes (reaffirmed)

- Owner: platform
- Status: superseded (see [2026-05-06: Calendar OAuth — WorkOS Pipes for credential management](#2026-05-06-calendar-oauth--workos-pipes-for-credential-management-supersedes-2026-04-22))
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
- Status: superseded in part (2026-09-07, ADR-021): the `admin`/`member` seniority model and `(org_type, role)` label derivation stay; WorkOS as the role store and `infra/workos/rbac-config.json` are replaced by Better Auth `organization` roles + `packages/auth/src/permissions.ts`
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
- Status: superseded in part (2026-09-07, ADR-017): credential management moves from WorkOS Pipes to Better Auth `account` rows (`getProviderAccessToken` in `@eleva/auth`); `packages/calendar` still owns the Google/Microsoft API surface
- Supersedes: [2026-04-22: Calendar OAuth ownership — Eleva, not WorkOS Pipes](#2026-04-22-calendar-oauth-ownership--eleva-not-workos-pipes-reaffirmed)
- Summary: Calendar OAuth credential management (token storage, refresh, revocation) is delegated to WorkOS Pipes. `packages/calendar` retains ownership of the Google/Microsoft API surface (event create/read/delete, freebusy, webhook subscriptions) but no longer manages raw tokens directly — instead it requests access tokens from WorkOS Pipes via the user's `workosUserId` and provider slug. This aligns with the ADR-004 amendment (2026-05) and the scheduling-booking-spec §Calendar Integration. The April decision's rationale about needing fidelity for booking-critical flows remains valid for the API layer; the change is purely about who stores/refreshes the OAuth credentials, not who calls the calendar APIs.
- Reference: [`adrs/ADR-004-scheduling-and-calendar-oauth.md`](./adrs/ADR-004-scheduling-and-calendar-oauth.md) (amended 2026-05), [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)

### 2026-05-06: Tech-debt backlog governance — PR #7 code review triage

- Owner: platform
- Status: active
- Summary: Triaged 20+ findings from the PR #7 code review against [`tech-debt-backlog.md`](./tech-debt-backlog.md). Fixed 11 still-valid issues (auth proxy SDK primitives, slot-picker race conditions and missing deps, timezone input validation, calendar busy-source whitelist, email JSON-LD rendering, booking-context email guard, accounting error logging, reserve-slot error fallback). Deferred 5 items requiring infrastructure or schema migrations: (1) accounting callback PKCE server-side opaque state (Sprint 7+), (2) persist `expertIntegrationId`/`externalCalendarId` in sessions table (Sprint 7), (3) composite FK on `expert_integrations` child tables (Sprint 7), (4) ICS VTIMEZONE generation (Sprint 7+), (5) external busy-time cache for public booking funnel (Sprint 5+). Skipped 4 items already tracked or assessed: `scheduleId` composite FK (Item #5), WorkOS disconnect lifecycle (Item #12), `findPart` throw-vs-fallback (verify step catches mismatches), duplicate outside-diff comments. RLS policy updates (Items #2–4) and composite-FK changes (Items #5, #15–17) are planned for batched migrations per the schema-and-migration-rules policy.
- Reference: [`tech-debt-backlog.md`](./tech-debt-backlog.md), [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)

### 2026-05-18: Subscription UX — Embedded Checkout + Customer Portal (supersedes ADR-005 UX)

- Owner: payments
- Status: active
- Supersedes: 2026-04-22 Stripe UX subsection of ADR-005 ("Custom Eleva UI + Payment Element + no Customer Portal redirect").
- Summary: Subscription purchase flow uses Stripe **Embedded Checkout** + **Customer Portal** for management instead of a custom Eleva UI + Payment Element. Multi-admin attribution closed via `withAudit({ entity: "billing_portal", action: "session_minted" })` correlated with webhook events. Subscription `payment_method_types` pinned to `["card", "sepa_debit"]` (MB WAY/Multibanco are one-time-only). Booking checkout, Connect Embedded Components, Identity, and the Appearance API mapping remain unchanged from ADR-005.
- Reference: [`adrs/ADR-016-subscription-ux-direction.md`](./adrs/ADR-016-subscription-ux-direction.md), [`adrs/ADR-005-payments-and-monetization.md`](./adrs/ADR-005-payments-and-monetization.md)

### 2026-05-18: API-First, Agentic-First, and Secure Architecture

- Owner: engineering
- Status: active
- Summary: Adopted an API-first, agentic-first, and secure-by-default architecture. All mutating business logic is callable via HTTP endpoints in `apps/api`, every endpoint supports dual auth (session + Bearer) with deterministic JSON error codes, and every route explicitly declares its auth model with rate limiting and Zod validation required. BotID is enforced on public-facing mutations.
- Core principles: API-first, Agentic-first, Secure-by-default
- Key consequences: migration of inline DB writes from Server Actions to domain package functions or API calls; standardized error envelope; OpenAPI spec as source of truth.
- Reference: [`api-first-architecture.md`](./api-first-architecture.md)
- Primary affected artifacts: `apps/api/src/lib/auth.ts` (requireApiAuth), `apps/api/src/lib/rate-limit.ts`, `apps/api/src/lib/bot-protection.ts`, `apps/api/src/lib/openapi.ts`, `packages/api-client` schemas

### 2026-09-07: Execution plan supersedes roadmap and sprint plan for sequencing

- Owner: engineering
- Status: active
- Supersedes: `roadmap-and-milestones.md` and `implementation-sprints.md` as the sequencing source of truth (both kept for history).
- Summary: `docs/eleva-v3/execution-plan/` is the authoritative build plan: phases 0-16, one branch (`phase-NN/<slug>`) = one PR = one CodeRabbit loop (CLI before the PR via `pnpm review` / `pnpm review:branch`, GitHub App on the PR) per phase, and a self-contained copy-paste prompt per phase. `index.html` is generated from the Markdown (`pnpm docs:execution-plan:html`). commitlint gains scopes `plan`, `p0`-`p16`, `p16.1`-`p16.16`.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md), [`contribution-workflow.md`](./contribution-workflow.md)

### 2026-09-08: Better Auth spike 02.0 pins 1.7.3 and disables implicit Google linking

- Owner: engineering
- Status: active
- Summary: PR 02.0 proved Better Auth **1.7.3** on Neon branch
  `spike-02-better-auth` / database `auth_spike`. Catalog pins for 02.1:
  `better-auth`, `@better-auth/passkey`, `@better-auth/api-key`,
  `@better-auth/drizzle-adapter` at 1.7.3. `accountLinking.disableImplicitLinking`
  is required (ADR-017) — the Phase 2 prompt now includes it. Default JWT alg is
  EdDSA; JWTs from `/auth/token` are short-lived (`15m`) and
  **non-revocable** (JWKS only — no session-table check after verify);
  `GET /auth/ok` is not a vendor route; `adminRoles: ["platform_admin"]`
  requires `roles.platform_admin`; `@better-auth/cli` 1.4.22 must not generate
  1.7 schema. The throwaway `packages/auth/spikes/` instance is exempt from
  `withAudit` (isolated `auth_spike` has no `audit_outbox`); 02.1 deletes the
  folder and wraps the real hook. Passkey attestation is 02.2, not a 02.0
  gate.
- Reference: [`spikes/02-better-auth.md`](./spikes/02-better-auth.md),
  [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### 2026-09-08: Better Auth clients and account UI (Phase 02.2)

- Owner: engineering
- Status: active
- Summary: Frontends use `@eleva/auth/client` (`createAuthClient` against
  `${NEXT_PUBLIC_API_URL}/auth`) and `getSession()` via
  `@eleva/api-client` `GET /auth/get-session`. Proxy optimistic auth uses
  `getSessionCookie` (no DB). Account hosts `/login`, `/signup`,
  `/verify-email`, `/reset-password`, `/two-factor`, `/logout`. Org switch
  calls `POST /organizations/active`. WorkOS Widgets CSS/config is removed
  from `@eleva/dashboard`. Residual WorkOS provisioning helpers stay until
  Phase 3.
- Reference:
  [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### 2026-09-08: Phase 1.2 CI merge gates

- Owner: engineering
- Status: active
- Summary: required checks on `main` now include `lockfile-guard`, `lint`,
  `typecheck`, `build`, `test`, `i18n-parity`, `gitleaks`, `e2e-smoke`, and
  `neon-branch-migrate-and-rls` (plus `coderabbit`). Same-repo PRs fail the
  Neon job when `NEON_API_KEY` / `NEON_PROJECT_ID` are missing so tenant
  isolation cannot skip. Fork PRs skip the live branch (secrets unavailable).
- Reference: [`contribution-workflow.md`](./contribution-workflow.md),
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml),
  [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml),
  [`.github/workflows/neon-branch.yml`](../../.github/workflows/neon-branch.yml)

### 2026-09-08: Phase 1.1 authored ADR-017..021 and ADR-023

- Owner: engineering
- Status: active
- Summary: Phase 1.1 (`phase-01.1/adrs-handbook`) writes the ADR documents that
  formalise the 2026-09-07 direction (this does not reopen those decisions),
  rewrites `identity-rbac-spec.md`, updates the handbook Current Canon, replaces
  WorkOS Cursor rules/skills with Better Auth / Daily / encryption, and adds the
  RLS taxonomy + localized-column contract + `security-traceability.md` skeleton.
  Canonical staging host is `dev.eleva.care` (API `api.dev.eleva.care`);
  `staging.eleva.care` is a historical alias to retire (callbacks, CORS,
  webhooks). The former `rbacDriftCheck` QStash job is not in the catalog
  (RBAC is code, ADR-021). Calendar workers persist Better Auth `account.id` and
  call `auth.api.getAccessToken({ body: { accountId, userId } })`
  (`calendar-integration-spec.md`). CI foundations (Playwright, Neon branch,
  gitleaks, i18n parity, audit migrations) are Phase 1.2.
- Reference: [`adrs/ADR-017-better-auth-identity.md`](./adrs/ADR-017-better-auth-identity.md)
  through [`ADR-023-plate-rich-text-editor.md`](./adrs/ADR-023-plate-rich-text-editor.md),
  [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md)

### 2026-09-07: Identity, video, encryption, RBAC and migration direction for v3 (ADR-017..021 authored in Phase 1)

- Owner: engineering
- Status: **accepted** — decided 2026-09-07 and locked for the execution plan; Phase 1 only writes the ADR documents (ADR-017..021) that formalise it, it does not reopen the decision. Earlier entries that assume WorkOS are superseded in part **as of this entry**, not once the ADRs land: [2026-04-22 Video — Daily.co EU region](#2026-04-22-video--dailyco-eu-region) (transcripts encrypted with `@eleva/encryption` envelope encryption, not WorkOS Vault; ADR-009 references to WorkOS Vault read as ADR-020), [2026-04-22 RBAC backbone](#2026-04-22-rbac-backbone--workos-adminmember-defaults--capability-bundles) (roles/capabilities come from Better Auth `organization` + `packages/auth/src/permissions.ts`, not `infra/workos/rbac-config.json`), and [2026-05-06 Calendar OAuth — WorkOS Pipes](#2026-05-06-calendar-oauth--workos-pipes-for-credential-management-supersedes-2026-04-22) (tokens now managed by Better Auth `account` rows).
- Supersedes **in part**: ADR-004 — only its WorkOS Pipes credential transport and its Google Meet link assumption; the Eleva-owned Google/Microsoft calendar OAuth and the cal.com-inspired scheduling model stay and Phase 4 builds on them; ADR-015 — only the "single WorkOS Application" assumption; the role-focused multi-app split stays; plus the WorkOS Vault/Pipes assumptions in `compliance-data-governance.md` and `calendar-integration-spec.md`. Phase 1 adds "Superseded in part by ADR-017/018/020" banners to ADR-004 and ADR-015 rather than retiring them.
- Summary:
  - **ADR-017 Identity**: self-hosted Better Auth in `apps/api` (`api.eleva.care/auth/*`), Drizzle adapter, `auth` schema on the main Neon project, plugins `organization`, `admin`, `twoFactor`, `passkey`, `magicLink`, `bearer`, `jwt`, `apiKey`, `openAPI`, `nextCookies`; session cookie on `.eleva.care`; frontend apps never instantiate the auth server. Neon managed Better Auth rejected (Beta, partial organization plugin, no MFA/hooks).
  - **ADR-018 Video**: Daily.co only (HIPAA-enabled domain, branded `sessions.eleva.care`); Google/Microsoft calendars remain for busy-time and destination sync.
  - **ADR-019 Migration**: import MVP data (users, orgs, experts, bookings, payout ledger, records) into v3 with a DNS cutover; same Stripe platform account.
  - **ADR-020 Encryption**: envelope encryption in `@eleva/encryption` (AES-256-GCM, per-org DEK wrapped by a versioned KEK from env, `org_data_keys`, crypto-shred = delete DEK); OAuth tokens encrypted by Better Auth.
  - **ADR-021 RBAC**: single source of truth in code (`packages/auth/src/permissions.ts`); product label derived from `(organization.type, member.role)`.
  - **Staff-only locale exception**: `apps/admin` ships `en` + `pt` only (Eleva staff surface); all member/expert/clinic-facing surfaces keep `pt`/`en`/`es`. Enforcement lives in `packages/config/src/i18n-locales.ts` (`REQUIRED_LOCALES_BY_APP`), which `scripts/check-i18n-parity.mjs` (Phase 1) reads instead of assuming `pt`/`en`/`es`; the universal prompt hard constraint in `execution-plan/README.md` section 7 names this exception.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md) section 2, [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md), [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### 2026-09-07: `@eleva/ui` primitives move from Radix UI to React Aria Components (ADR-022)

- Owner: engineering
- Status: active
- Summary: `@eleva/ui` regenerated from the shadcn `aria-luma` style on `react-aria-components`; `radix-ui`, `cmdk`, `react-hook-form` dropped; `navigation-menu`/`form` deleted, `field` + `checkbox-field` added. `@eleva/dashboard` mounts `AppRouterProvider` (relative hrefs → `router.push`, absolute → hard navigation for cross-zone). Consumers in `apps/web`, `apps/account`, `apps/expert` migrated to React Aria props (`isDisabled`, `onPress`, `isOpen`, `selectedKey`). Done before Phase 2 so all new v3 UI is written once against the final primitive layer.
- Reference: [`adrs/ADR-022-react-aria-ui-primitives.md`](./adrs/ADR-022-react-aria-ui-primitives.md), [`design-system-spec.md`](./design-system-spec.md)

### 2026-09-07: Rich text = Plate in a single `@eleva/editor` package (ADR-023, authored in Phase 1)

- Owner: engineering + product
- Status: accepted
- Summary: every rich-text surface (expert bios, event-type descriptions, location instructions, clinical notes, reports, the template library, clinic pages) uses Plate through `packages/editor`; Plate JSON stored in `jsonb` with server-derived sanitized HTML and plain text; `platejs`/`@platejs/*`/`slate*` are importable only inside `packages/editor`, and `@radix-ui/*` is allowed there as an ADR-022 exception (the other ADR-022 exception, `@radix-ui/themes` as the WorkOS Widgets peer, is transitional and ends in Phase 3). AI writing help (improve, shorten, fix grammar, translate) runs through `@eleva/ai` over the Vercel AI Gateway with the `approved-models` allow-list; the clinical context is enabled only in Phase 10 with zero-retention models. Tiptap (Pro licensing for AI/comments), Lexical (thinner ecosystem) and per-app Markdown textareas were rejected.
- Reference: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md), [`execution-plan/phases/10-records-crm-ai.md`](./execution-plan/phases/10-records-crm-ai.md), [`monorepo-structure.md`](./monorepo-structure.md)

### 2026-09-07: Offer model — event type = service, delivery modes carry how/where/language/price/schedule

- Owner: product + engineering
- Status: accepted
- Summary: health licences are national while video consultations are not, and one practice mixes online, phone and several physical addresses with different calendars and prices. `event_types` keeps the service (kind `clinical|non_clinical`, defaults, policies, visibility); one or more `event_type_modes` carry `mode online|phone|in_person`, location, schedule, price/duration overrides, `country_scope` (worldwide or ISO list) and `languages`. Expert practice scope (`practice_country`, `service_countries`, `languages`, `worldwide_remote`, `accepting_bookings`) is the legal universe modes must fit; invariants live in `@eleva/scheduling` and are enforced on publish and at booking time (`assertModeBookable`). Busy time is shared across all modes of one expert. Private booking links (`booking_links`, hashed token, expiry, uses, schedule and price overrides) bypass a closed agenda but never the invariants. Experts own an Eleva calendar with a read-only ICS feed and may connect zero or many external calendars (per-calendar busy toggle; destination default overridable per event type and per mode). Supersedes the single `session_mode`/`worldwide_mode`/`languages` columns on `event_types` and the per-event-type `event_locations` table (folded into `expert_practice_locations`).
- Reference: [`scheduling-booking-spec.md`](./scheduling-booking-spec.md), [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md), [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md)

### 2026-09-07: CodeRabbit review loop cap and PR size targets

- Owner: engineering
- Status: accepted
- Summary: the CLI loop is bounded — `pnpm review` max 3 rounds, `pnpm review:branch` max 2, GitHub App max 2 fix-and-push rounds. Exit early on a clean round or when fewer than 3 Minor/Trivial findings remain; exit at the cap only with zero Critical/Major (a Critical/Major still open at the cap means the PR is too big: split and restart). Leftover Minor/Trivial go to the PR body "Deferred findings" table and, when real work, a Phase 16 row. PR size target <= 400 changed lines / <= 30 files; split above 800 / 60. Rationale: after 14 rounds on the plan PR each round kept surfacing 8-10 wording findings on freshly touched text; reviews are generative on large diffs and never reach a literal zero, while small PRs converge in 1-2 rounds. The design quality bar (rule 10) was recorded in the same change.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md) section 4 rules 1, 4, 6, 10; [`contribution-workflow.md`](./contribution-workflow.md); `.cursor/skills/coderabbit-review/SKILL.md`

### 2026-09-07: Execution-plan contract tightenings from the Phase 0 review loop

- Owner: engineering
- Status: accepted
- Summary: the Phase 0 CodeRabbit loop locked several cross-phase contracts that previous documents left ambiguous. (1) Payout states: `payout_states.status` = `pending|scheduled|approval_required|transferred|paid_out|failed|held|reversal_pending|reversed` is the SSOT (`reversal_pending` added by the 2026-09-07 amendment: refund succeeded, transfer reversal not yet confirmed) (Phase 6 and `payments-payouts-spec.md` identical); a hold records `held_from_status` and a dispute won or a hold release restores it — there is no `released` state. (2) Notifications: one `sendNotification({ kind, recipient, orgId?, ctx, idempotencyKey, channelsOverride? })` contract; urgency belongs to `NOTIFICATION_KINDS[kind]`; e-mail is an idempotent provider submission (Resend `Idempotency-Key` = delivery row id, 24 h dedupe), SMS is at-least-once with Twilio status callback + per-delivery `Ref` body-fingerprint reconciliation; disputes and manual holds go to `held` (never `approval_required`) as a `hold_reasons` set, and the row returns to `held_from_status` only when every reason is cleared. (3) Tier 1 invoice retry policy is two-stage (5 fast attempts -> `failed` + alert; 10 sweep attempts -> `dead_lettered` + admin flag). (4) Daily: delegate removal ejects + bans at the provider; webhook transitions are ordered by event time (`sessions.last_event_at`, monotonic status); room creation reconciles lost responses from Eleva-owned intent (`room_create_attempt_at`, `room_attempt_seq`, `room_fingerprint_exp`) matched against the listed rooms' `nbf`/`exp` — Daily HIPAA mode rejects custom room names and room properties have no `meta`, so there is no provider-side handle (supersedes the earlier `room_request_id`-in-`meta` design, 2026-09-07 amendment) — and otherwise lands in `room_unresolved`. (5) Private booking links claim a use inside the durable reservation transaction, after the slot lock. (6) Migration deltas key on the MVP source snapshot (`migration_runs.source_watermark`), never the target completion time; Phase 15 production configuration is gated one mutation at a time (ADR-019). (7) CodeRabbit: the App's 100-file cap is the only file cap; the loop caps are 3 `pnpm review` rounds, 2 `pnpm review:branch` rounds and 2 GitHub App rounds, exiting only with zero open Critical/Major and every remaining Minor/Trivial recorded in the PR body "Deferred findings" table; the PR-size targets of `execution-plan/README.md` section 4 rule 1 (<= 30 files / 400 lines) apply to every prompt; hourly allowance recorded (Advanced trial 10/dev/h until 21 Sep 2026, then Team 8 or Essentials 5).
- Reference: execution-plan phases 4, 6, 7, 8, 9, 12, 14, 15; [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Payout States"; [`notifications-spec.md`](./notifications-spec.md) entrypoint.

### 2026-09-07: Execution-plan amendment from the external engineering review (D-01..D-14)

- Owner: engineering (plan), named owners per decision below
- Status: active — accepted 2026-09-07 by Rodrigo Barona (founder); this entry records the
  amendment itself, the D-NN entries below carry their own sign-off
- Summary: an external engineering evaluation of the execution plan (kept verbatim at
  [`execution-plan/reviews/2026-09-07-external-engineering-review.md`](./execution-plan/reviews/2026-09-07-external-engineering-review.md),
  disposition per finding in
  [`execution-plan/reviews/2026-09-07-review-response.md`](./execution-plan/reviews/2026-09-07-review-response.md))
  was folded into the plan as one amendment PR. Structural changes: PR-level dependencies and
  approval gates (README section 4 rules 11-13, including environment mutation rules and the
  no-vendor-call-inside-a-transaction rule), spike PRs 02.0 / 06.0 / 07.0 / 09.0, the security
  baseline moved to the phases that create the risk (Phase 13 verifies, does not introduce),
  recording/transcription stripped from Phase 10 into Phase 16.8, refund + transfer-reversal
  contract corrected for separate charges and transfers, `computeSettlement` as the financial
  calculation contract, DB exclusion constraint as the booking consistency boundary,
  `consents` / `public_handles` / per-subscriber outbox deliveries created in Phase 4 PR 04.1,
  rollback narrowed to an acceptance point. The decisions below are the **approval gates**; each
  is `proposed` until its owner signs, and the phase file names the PR that cannot open before
  that. Sign-off is recorded by editing the status and adding the date and name in place.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md) section 4 rule 12 (gate table)

### 2026-09-07: Phase 1 security baseline contracts (RLS policy classes, secret scanning, traceability, localized columns)

- Owner: engineering (security), DPO informed
- Status: accepted (documentation + CI contracts; the controls themselves are implemented by the phases named in `security-traceability.md`)
- Summary: Phase 1 fixes four contracts that later phases build on. (1) **RLS policy classes**: every tenant table declares one of the seven classes (`tenant-owned`, `dual-organization`, `owner-user-visible`, `participant-visible`, `staff-only`, `public-read`, `service-only`) documented in `schema-and-migration-rules.md`; `rls-classes.test.ts` (Phase 1.2) proves each class with a fixture and positive/negative assertions. (2) **Secret scanning**: `gitleaks` runs in CI with the repo `.gitleaks.toml`; a hit fails the job (Phase 1.2). (3) **Security traceability**: `docs/eleva-v3/security-traceability.md` maps every control to the phase that introduces it, the test that enforces it and the evidence link; Phase 13 CI fails when a control row has no enforcing check. (4) **Localized columns**: `LocalizedText` / `LocalizedRichText` (JSONB keyed by `Locale`, one row per entity, Zod-validated, sibling `_source_locale`) are the only storage shape — the duplicate `LocalizedString` type is deleted in PR 04.1.
- Reference: [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md), [`security-hardening-checklist.md`](./security-hardening-checklist.md)

### 2026-09-07: Admin dual-control kinds, distinct `analytics` consent, imported-consent semantics, rollback acceptance point

- Owner: engineering (Phase 12/13/14 contracts); finance for the refund threshold (D-06); DPO for consent semantics (informed)
- Status: accepted (plan contracts — implementation is verified by the phase tests named below)
- Review date: 2026-09-21 for the dual-control threshold default (`ADMIN_DUAL_CONTROL_REFUND_CENTS = 20000`) and the analytics-consent default (denied); the rest is structural
- Summary: (1) **Dual control (Phase 12)** is required for exactly six admin action kinds, mapped route-by-route in `packages/auth/src/admin-actions.ts`: `payment.refund_large` (above the threshold), `payout.release` (from `held`), `expert.commission_override`, `partner.approve_clinical` (clinical specialties), `expert.ban_with_future_bookings` (suspend/ban with confirmed future bookings), `record.break_glass_decrypt`; every other admin mutation is single-actor with a mandatory reason. Adding a kind = map row + table-driven test + audit-union entry. (2) **`analytics` is a distinct consent kind** (Phase 13), separate from `marketing`: PostHog/GA4 stay off until it is granted; it is never inferred from marketing or from a legacy field. (3) **Imported consents (Phase 14)** keep their MVP acceptance timestamp, `source = import`, document version tagged `legacy`; `analytics`, `ai_processing` and `session_recording` are never imported; the mapper (`infra/migration/src/map/consents.ts`) is deny-by-default and fails the run on an unmapped legacy field. (4) **Rollback boundary (Phase 14/15)**: `CUTOVER_ACCEPTANCE_TS = min(CUTOVER_TS + 48 h, first executed payout)`; before it, rollback to the MVP is a rehearsed runbook; after it, issues are fixed forward — no rollback path exists once money has moved.
- Reference: [`execution-plan/phases/12-admin-console.md`](./execution-plan/phases/12-admin-console.md), [`execution-plan/phases/13-hardening-observability.md`](./execution-plan/phases/13-hardening-observability.md), [`execution-plan/phases/14-mvp-migration.md`](./execution-plan/phases/14-mvp-migration.md), [`execution-plan/phases/15-launch-cutover.md`](./execution-plan/phases/15-launch-cutover.md)

### D-01 (2026-09-07): `pt-BR` retired as a locale; alias to `pt`; no `fr` now

- Owner: product (founder)
- Status: active — decided 2026-09-07 by Rodrigo Barona (founder, product owner) during the
  review of the external evaluation; recorded by engineering
- Summary: the `Locale` union in `@eleva/config` is `pt | en | es`; `apps/web/src/proxy.ts`
  answers `/pt-BR/*` with a 301 to `/pt/*` (query preserved) so indexed MVP URLs keep working;
  hreflang `pt/en/es` + `x-default`; no `pt-BR` message files anywhere (the i18n parity checker
  fails on a stray one). `fr` is not added: no content, experts, legal pages or native reviewer;
  adding a locale later is message files plus a reviewer, not architecture. Brazil returns as a
  content + payments discovery item (Phase 16.2). Blocks: Phase 4 PR 04.2.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md) (SEO), [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md) (parity checker)

### D-02 (2026-09-07): EUR-only launch

- Owner: founder + finance
- Status: active — working pre-launch decision recorded 2026-09-09 by Rodrigo
  Barona (founder, product owner). Not a production finance sign-off. Re-sign
  before go-live.
- Review date: 2026-09-21 (re-sign with finance before production)
- Summary: `CHECK (currency = 'EUR')` on `event_types` and `event_type_modes`; the Stripe call
  still reads `currency` from the reservation snapshot, so lifting the CHECK later is the whole
  multi-currency change on the payment path. Blocks: Phase 4 PR 04.2.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md), [`payments-payouts-spec.md`](./payments-payouts-spec.md) settlement matrix

### D-03 (2026-09-07): Commission is VAT-inclusive — the expert nets the headline

- Owner: finance (accountant)
- Status: proposed (sign before PR 06.1)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: the advertised commission (15% / 8% / 0%) is the gross platform fee; IVA is carved out
  of it per the Phase 7 IVA matrix (PT B2B 15.00 = 12.20 + 2.80; intra-EU reverse charge 15.00 net).
  100 EUR booking -> 15.00 fee -> 85.00 expert transfer. Implemented once in `computeSettlement`.
  Blocks: Phase 6 PR 06.1 (and Phase 7 Tier 1 coding).
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Settlement matrix", [`execution-plan/phases/06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md)

### D-04 (2026-09-07): Processing-fee bearer

- Owner: finance
- Status: proposed (sign before PR 06.1)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: marketplace bookings — Eleva absorbs Stripe's processing fee out of its commission
  (`expertTransfer = gross − platformFeeGross`); clinic-attributed 0% bookings — the clinic bears
  the processing fee (`expertTransfer = gross − processingFeeCents`). `processing_fee_cents` is
  stored on `booking_payments` from `balance_transaction.fee`. Blocks: Phase 6 PR 06.1.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Settlement matrix"

### D-05 (2026-09-07): Connect capability model — `transfers` only, Identity behind a flag

- Owner: finance + legal
- Status: proposed (confirm with Stripe/legal in PR 06.0, sign before PR 06.1)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: with separate charges and transfers the connected account only receives transfers, so
  request the `transfers` capability only — no `card_payments`; `charges_enabled` never gates
  anything. Connect's own KYC is the identity check. Publish gate = `details_submitted &&
payouts_enabled && capabilities.transfers = active`. Stripe Identity stays implemented behind
  `ff.expert_identity_verification` (default off) in case legal requires a second verification
  for clinical experts. Blocks: Phase 6 PR 06.1; Phase 12 partner checklist reads the same fields.
- Reference: [`execution-plan/phases/06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md), [`execution-plan/phases/12-admin-console.md`](./execution-plan/phases/12-admin-console.md)

### D-06 (2026-09-07): Refund, dispute and no-show policy

- Owner: finance + product
- Status: proposed (sign before PR 06.2)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: cancellation-window refund rules, dispute handling (hold payout, reverse on loss) and
  the no-show policy (Phase 9 records attendance only; this decision says refund / keep / partial
  per attendance outcome). Refunds above `ADMIN_DUAL_CONTROL_REFUND_CENTS` (default 200 EUR) need
  dual control in the admin console. Blocks: Phase 6 PR 06.2.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Refunds", [`execution-plan/phases/09-video-daily.md`](./execution-plan/phases/09-video-daily.md) (attendance)

### D-07 (2026-09-07): Daily HIPAA domain, BAA/DPA and EU processing position

- Owner: founder + DPO
- Status: proposed (evidence from PR 09.0; sign before Phase 9 opens)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: the Daily plan tier with HIPAA enabled, the executed BAA/DPA, the documented EU
  media-processing position (stated only as Daily documents it — no stronger claim on `/trust`),
  `sessions.eleva.care` verified, recording confirmed off for the domain. Blocks: Phase 9.
- Reference: [`execution-plan/phases/09-video-daily.md`](./execution-plan/phases/09-video-daily.md) (PR 09.0), `docs/eleva-v3/spikes/09-daily-account.md`

### D-08 (2026-09-07): Session-recording storage — S3 EU landing zone, private Blob system of record

- Owner: DPO + founder
- Status: proposed (decide before Phase 16.8 is promoted)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: Daily HIPAA recording writes only to a customer-owned AWS S3 bucket via IAM role trust;
  Vercel Blob, Neon object storage and Cloudflare R2 are not accepted destinations. Design: a
  disposable EU S3 bucket (SSE-KMS, 72 h lifecycle) as a mailbox, a workflow that pulls, encrypts
  per org and stores through `@eleva/storage` in the private Blob store (EU region confirmed),
  then deletes the S3 object. Recording lives only in 16.8. Blocks: 16.8.
- Reference: [`execution-plan/phases/16-post-launch-backlog.md`](./execution-plan/phases/16-post-launch-backlog.md) "16.8 design note"

### D-09 (2026-09-07): Historical MVP invoices — `legacy` / `legacy_missing`, never reissued

- Owner: accountant
- Status: proposed (sign before PR 07.1)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: migrated MVP paid bookings are imported as `platform_fee_invoices.status = legacy`
  (+ `legacy_document_ref`) or `legacy_missing`; v3 never issues a Tier 1 document for a booking
  paid before cutover; the accountant decides any lawful backfill outside the system. Phase 14
  reports the `legacy_missing` count. Blocks: Phase 7 PR 07.1.
- Reference: [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md), [`execution-plan/phases/14-mvp-migration.md`](./execution-plan/phases/14-mvp-migration.md)

### D-10 (2026-09-07): Public-site parity dispositions

- Owner: product (founder)
- Status: active — working pre-launch decision recorded 2026-09-09 by Rodrigo
  Barona (founder, product owner). Draft legal pages and `CONSENT_DOCUMENTS`
  version `dev-2026-09-09` are not DPO-approved. Re-sign before go-live.
- Review date: 2026-09-21 (legal + DPO re-sign before production)
- Summary: every surface of the live MVP site has a disposition tested by `e2e/legacy-urls.spec.ts`:
  expert URLs preserved via `public_handles`; `/pt-BR/*` 301; health quiz retired (301 to the
  experts directory); community links kept as external footer links; Help Center replaced by
  `apps/docs` guides with 301s; contact migrated to `/{locale}/contact`; legal pages migrated as
  versioned `/{locale}/legal/*` (their versions are the `CONSENT_DOCUMENTS` versions); trust
  claims rewritten only with Phase 13 evidence. Blocks: Phase 4 PR 04.2.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md) "Public-site parity"

### D-11 (2026-09-07): Clinical access model

- Owner: DPO + product
- Status: proposed (sign before PR 10.1)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: expert-authored records are readable by the authoring expert; by other experts of the
  same clinic organization only when the clinic admin enabled `clinic_shared_records` (default
  off, reason required, audited) and the member has not opted out (`record_access_optouts`);
  by Eleva staff never in plaintext (metadata only; break-glass decrypt is a Phase 12 dual-control
  action). Phase 10 enforces it in RLS; Phase 11 only adds the toggle. Blocks: Phase 10 PR 10.1.
- Reference: [`execution-plan/phases/10-records-crm-ai.md`](./execution-plan/phases/10-records-crm-ai.md), [`execution-plan/phases/11-team-clinics.md`](./execution-plan/phases/11-team-clinics.md)

### D-12 (2026-09-07): Account deletion vs legal retention of clinical records

- Owner: DPO + legal
- Status: proposed (sign before the Phase 5 account-deletion work)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: member-authored data is erased on schedule (grace period, then crypto-shred);
  expert-authored clinical records stay under the expert organization's legal retention duty —
  pseudonymised (identity replaced by a retention token) and kept for the period recorded in
  `data-retention-export-matrix.md` (working default: the Portuguese clinical-record minimum),
  then crypto-shredded by the Phase 10 job. The member deletion UI says so in plain language.
  Blocks: Phase 5 deletion flow.
- Reference: [`execution-plan/phases/05-member-app.md`](./execution-plan/phases/05-member-app.md), [`data-retention-export-matrix.md`](./data-retention-export-matrix.md)

### D-13 (2026-09-07): Cookie, CSRF and subdomain threat model

- Owner: founder acting as security owner (working pre-launch); engineering lead
  re-signs before production
- Status: active — working pre-launch decision recorded 2026-09-09 by Rodrigo
  Barona (founder). CSRF/session model as written in Phase 2. Unblocks PR 04.2
  for development. Not a production security sign-off.
- Review date: 2026-09-21 (engineering-lead security owner re-sign before production)
- Summary: Product-app session cookies are `better-auth.session_token` or
  `__Secure-better-auth.session_token` with `Domain=.eleva.care`, `Secure`,
  `HttpOnly`, `SameSite=Lax`. Admin (Phase 12) uses a host-only `__Host-` cookie
  and rejects the shared cookie. Cookie-authenticated mutations require a trusted
  `Origin` or `Sec-Fetch-Site` of `same-origin`/`same-site`, and reject
  `cross-site` and missing provenance (`403 CSRF_ORIGIN_MISMATCH`). Duplicate
  session cookies are `401 SESSION_COOKIE_AMBIGUOUS` and both values are cleared
  on the parent domain and host. `__Secure-` does not stop cookie tossing.
  Bearer and API-key paths are exempt. Previews never mint `.eleva.care` cookies.
  `*.eleva.care` DNS inventory lives in `environment-matrix.md`. This working
  pre-launch record unblocks PR 04.2; the engineering-lead security owner
  re-signs before go-live.
- Reference:
  [`security/cookie-csrf-threat-model.md`](./security/cookie-csrf-threat-model.md),
  [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### D-14 (2026-09-07): Launch payment-method set

- Owner: finance + product
- Status: active — working pre-launch decision recorded 2026-09-09 by Rodrigo
  Barona (founder, product owner). Launch set: card (incl. wallets), Link, MB WAY.
  Not a production finance sign-off. Re-sign before go-live.
- Review date: 2026-09-21 (finance re-sign before production)
- Summary: booking PaymentIntents use a Stripe Payment Method Configuration (`STRIPE_PMC_BOOKING`,
  owned by `infra/stripe/setup-payment-methods.ts`) with `card` (incl. Apple Pay / Google Pay),
  `link`, `mb_way`; Multibanco, SEPA Direct Debit, Klarna and every delayed-notification method are
  off for one-time bookings (a 5-minute hold cannot outlive a days-long settlement). MB WAY is
  `async_short`: hold extended to 10 min while `processing`. SEPA DD remains allowed for SaaS
  subscriptions (ADR-016 carve-out). Blocks: Phase 4 PR 04.2.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Dynamic Payment Methods", `packages/billing/src/server/payment-method-policy.ts`

### D-15 (2026-09-08): Phase 03.2 leftover-identity contract

- Owner: platform
- Status: active
- Summary: After the Phase 03.2 exit-gate grep, migration `0024_drop_legacy_identity`
  drops `main.users` / `organizations` / `memberships` / `roles` / `permissions`,
  leftover identity-provider columns, and the read-only write triggers. Locale
  SSOT is the `ELEVA_LOCALE` cookie (`getAuthenticatedLocale`); do not read a
  leftover IDP `user.locale`. Session fields are `user.id`, `orgId`, and
  `membershipRole: "admin" | "member"` (Better Auth `owner` maps to `admin`).
  Keep `apps/account/.../settings-widgets.tsx` — it is the live React Aria
  settings UI, not leftover widgets. Keep the `org_type` enum. Calendar tokens
  stay on Better Auth `account` rows. Vercel Hobby deploy checks are not a merge
  gate.
- Reference: [`execution-plan/phases/03-remove-workos.md`](./execution-plan/phases/03-remove-workos.md), ADR-017, ADR-020

### D-16 (2026-09-09): public_handles is a global namespace

- Owner: platform
- Status: active
- Summary: `public_handles` is the public `/[handle]` resolution table. It has no
  `org_id` because handles are a single citext namespace across experts and (later)
  clinics. ADR-003 still holds for tenant-scoped tables. This table is the documented
  split: SELECT is public-read (`USING true`); writes are staff-only
  (`eleva.platform_admin`). Phase 4B onboarding claims handles through audited domain
  code, not a tenant WITH CHECK.
- Reference: [`schema-and-migration-rules.md`](./schema-and-migration-rules.md),
  ADR-003, [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md)

## Related Docs

- [`adrs/README.md`](./adrs/README.md)
- [`master-architecture.md`](./master-architecture.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`contribution-workflow.md`](./contribution-workflow.md)
