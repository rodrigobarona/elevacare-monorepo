# Eleva.care v3 Roadmap And Milestones

Status: Authoritative

## Purpose

This document translates the Eleva v3 architecture and product strategy into milestone-based delivery planning.

It should help the team answer:

- what comes first
- what can run in parallel
- what must be complete before the next phase starts
- what each milestone should prove

## Planning Principles

- Sequence by dependency, not by enthusiasm.
- Land foundational contracts before large feature surfaces.
- Use milestones to prove risk reduction, not just feature count.
- Keep phases outcome-based and testable.

## Milestone 0: Architecture Baseline

Goal:

- establish the shared source of truth for product, platform, and delivery

Should include:

- handbook docs
- ADR baseline
- vendor decision matrix
- domain model
- workstream ownership

Exit criteria:

- core architecture docs exist
- major early decisions are written down
- the team agrees on initial topology and scope

## Milestone 1: Monorepo Foundation

Goal:

- create the production-ready repo foundation

Should include:

- **First task — migrate from current scaffold**:
  - `bun.lock` → `pnpm-lock.yaml`
  - pin `"packageManager": "pnpm@<version>"`
  - rename `@workspace/*` → `@eleva/*`
  - preserve shadcn `components.json`
  - enable Turborepo remote cache via Vercel
  - CI guard: no `bun.lock` at repo root; no `bun install` permitted
- `pnpm` workspace + Turborepo
- `apps/web` (migrated), `apps/app` (new), `apps/api` (new), `apps/docs` (new), `apps/email` (new)
- core packages: `config`, `auth`, `db`, `ui`, `compliance`, `scheduling`, `calendar`, `billing`, `accounting`, `crm`, `notifications`, `workflows`, `flags`, `audit`, `encryption`, `ai`
- CI baseline: lint, typecheck, Vitest, Playwright smoke, i18n parity
- package-boundary lint (`eslint-plugin-import no-restricted-paths`)

Exit criteria:

- repo boots cleanly on pnpm
- packages compile and link correctly
- auth/db/config/ui package boundaries exist
- dev onboarding documented in `docs/eleva-v3/contribution-workflow.md`

## Milestone 2: Identity, Tenancy, And Compliance Core

Goal:

- establish secure product access and workspace boundaries

Should include:

- WorkOS integration
- organizations and memberships
- RBAC baseline
- consent/audit boundaries
- sensitive-data access rules

Exit criteria:

- users can authenticate
- workspace context works
- route and server-side authorization are enforced
- high-risk access paths are auditable

## Milestone 3: Public Web And Marketplace Discovery

Goal:

- launch the public discovery surface

Should include:

- marketing site
- category pages
- expert public profiles
- search and filter basics
- trust/legal pages
- metadata and SEO foundation

Exit criteria:

- marketplace browsing works
- profile pages convert to booking entry
- SEO primitives are in place

## Milestone 4: Scheduling, Booking, And Payments

Goal:

- make the marketplace operational

Should include:

- **Scheduling / Calendar**:
  - event types, schedules and availability
  - multi-calendar per expert (busy vs destination calendars)
  - slot reservation (Redis-backed atomic `reserveSlot`)
  - booking flow with online / in-person (address object) / phone modes
  - per-event language + country-license + optional worldwide-mode
  - Eleva-owned Google + Microsoft OAuth in `packages/calendar` (not WorkOS Pipes)
- **Stripe setup**:
  - staging + production accounts, API version pinned ≥ 2023-08-16
  - **Connect Express** platform for experts and clinics
  - **Dynamic Payment Methods** enabled per Dashboard (PT: card + MB WAY + wallets; other EU: regional methods)
  - NIF collection + Stripe Tax PT
  - **single `/api/stripe/webhook` endpoint** with `stripe_event_log` idempotency
  - **no hardcoded `payment_method_types`**, no Multibanco vouchers
- **Stripe Embedded Components wired**:
  - Payment Element
  - Connect Onboarding / Payouts / Balances / Account Management / Documents / Tax / Notification Banner
  - Identity embedded modal
  - `/api/stripe/account-session` endpoint minting permissioned AccountSessions
  - appearance theme mapped to Eleva design tokens
  - CSP allows Stripe iframe hosts
- **Twilio EU** subaccount provisioning + Lane 1 SMS templates (booking confirmation, 24h reminder, day-of prompt, cancellation)
- **Tier 1 invoicing (TOConline)**:
  - OAuth app registered sandbox + prod
  - `ELEVA-FEE-{YYYY}` series for per-booking solo commission
  - `ELEVA-SAAS-{YYYY}` series for clinic SaaS
  - IVA matrix accountant-reviewed and signed off
  - `issuePlatformFeeInvoice` + `issueClinicSaasInvoice` Vercel Workflow steps
  - Neon `platform_fee_invoices` + `clinic_saas_invoices` idempotency tables
- **Tier 2 invoicing registry scaffold**:
  - adapter interface + P1 seed (TOConline expert-side, Moloni, Manual/SAF-T)
  - Become-Partner onboarding "Invoicing setup" step
  - admin verification in Become-Partner queue
- pack/subscription baseline (expert Top Expert tier, clinic Starter/Growth/Enterprise)
- `ff.mbway_enabled`, `ff.toconline_invoicing_enabled`, `ff.clinic_subscription_tiers`, `ff.expert_invoicing_apps_enabled` wired via `packages/flags`

Exit criteria:

- a user can search, book, and pay inline via Payment Element with Dynamic Payment Methods
- scheduling conflicts handled correctly (100 concurrent reservations → one winner)
- booking/payment flows observable (Sentry + BetterStack + audit)
- expert completes Connect Onboarding + Identity inline (no redirect)
- Tier 1 platform-fee invoice fires end-to-end with a pilot expert
- Tier 2 seed adapters connect + issue a test invoice

## Milestone 5: Patient Portal, CRM, And Reports

Goal:

- make Eleva useful beyond a single booking

Should include:

- patient dashboard
- session history
- document/report access
- expert CRM basics
- follow-up reminders

Exit criteria:

- patient and expert longitudinal workflows work
- customer relationship state is visible to the expert

## Milestone 6: Video, Transcripts, And AI Drafting

Goal:

- accelerate expert workflows with session infrastructure

Should include:

- Daily sessions
- transcript ingestion
- AI draft reporting
- expert review/approval flow

Exit criteria:

- transcript pipeline is stable
- AI draft lifecycle is controlled and auditable

## Milestone 7: Mobile Integration

Goal:

- connect `Eleva Diary` into the shared platform

Should include:

- monorepo integration for mobile
- shared auth/contracts
- diary sync/share model
- patient visibility controls

Exit criteria:

- mobile and web share the same user/account model
- expert visibility obeys share rules

## Milestone 8: Hardening And Launch

Goal:

- move from functional platform to reliable launch candidate

Should include:

- operational runbooks
- security hardening
- support playbooks
- launch readiness verification

Exit criteria:

- launch checklist passes
- critical observability and runbooks exist
- rollback path is defined

## Parallelization Guidance

Workstreams that can often overlap:

- public web and docs
- design system and product app shell
- CRM planning and notification planning
- observability setup and workflow orchestration

Work that should stay sequential or tightly coordinated:

- schema changes
- auth and RBAC foundations
- booking/payment state design
- diary visibility model

## Related Docs

- [`master-architecture.md`](./master-architecture.md)
- [`dependency-map.md`](./dependency-map.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
