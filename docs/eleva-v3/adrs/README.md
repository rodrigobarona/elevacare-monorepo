# Eleva.care v3 ADR Index

Status: Living

## Purpose

This folder stores Architecture Decision Records for Eleva.care v3.

ADRs should capture:

- the context behind a major decision
- the chosen direction
- the alternatives that were considered
- the consequences of the decision

## How To Use ADRs

Write an ADR when the team makes a decision that would be expensive or confusing to reverse later.

Examples:

- app topology
- auth strategy
- RBAC model
- scheduling model
- payments/payouts model
- transcript and AI data handling
- mobile sync/share model

## ADR Status Values

- `Proposed`
- `Accepted`
- `Superseded`
- `Deprecated`

## Naming Convention

Use sequential files: `ADR-<3-digit>-<kebab-title>.md`.

## Current ADRs

- [`ADR-001-app-topology.md`](./ADR-001-app-topology.md) — ~~one authenticated product app first~~ (superseded by ADR-015)
- [`ADR-002-package-manager.md`](./ADR-002-package-manager.md) — pnpm installer + bun as task runner; bun install banned
- [`ADR-003-tenancy-and-rls.md`](./ADR-003-tenancy-and-rls.md) — Neon RLS with `withOrgContext()`; two Neon projects (main + audit)
- [`ADR-004-scheduling-and-calendar-oauth.md`](./ADR-004-scheduling-and-calendar-oauth.md) — Eleva-owned Google/Microsoft OAuth in `packages/calendar`; cal.com-inspired scheduling model with online/in-person/phone modes
- [`ADR-005-payments-and-monetization.md`](./ADR-005-payments-and-monetization.md) — Stripe Connect Express + Dynamic Payment Methods + Embedded Components + single webhook; hybrid monetization (solo=commission, clinic=SaaS tiers); Multibanco vouchers excluded; three-party revenue demoted to phase-2 (UX subsection superseded by ADR-016)
- [`ADR-006-notifications-two-lane.md`](./ADR-006-notifications-two-lane.md) — Lane 1 transactional (Vercel Workflows + Resend + Twilio + Neon inbox + Expo push) and Lane 2 marketing (Resend Automations); Novu retired
- [`ADR-007-durable-workflows.md`](./ADR-007-durable-workflows.md) — Vercel Workflows DevKit for durable orchestration; QStash scoped to periodic cron only
- [`ADR-008-feature-flags.md`](./ADR-008-feature-flags.md) — Vercel Flags SDK + Edge Config; PostHog adapter reserved for experimentation
- [`ADR-009-ai-and-transcripts.md`](./ADR-009-ai-and-transcripts.md) — Vercel AI Gateway exclusive; transcripts as Eleva records; AI reports draft→review→publish with consent and retention
- [`ADR-010-mobile-sync-model.md`](./ADR-010-mobile-sync-model.md) — Eleva Diary in monorepo after v1 contracts; explicit per-expert time-bounded sharing; consent-gated AI feed
- [`ADR-011-observability.md`](./ADR-011-observability.md) — Sentry + BetterStack (EU); correlation-ID propagation; redaction policy
- [`ADR-012-portugal-first-launch.md`](./ADR-012-portugal-first-launch.md) — PT-first launch with ERS, Stripe Tax PT/NIF, MB WAY, TOConline; ES deferred to phase 2
- [`ADR-013-accounting-integration.md`](./ADR-013-accounting-integration.md) — Two-tier invoicing; Tier 1 TOConline; Tier 2 adapter registry (TOConline, Moloni, InvoiceXpress, Vendus, Primavera, Manual/SAF-T)
- [`ADR-014-multi-zone-rewrites.md`](./ADR-014-multi-zone-rewrites.md) — Single canonical public domain (`eleva.care`) with Vercel multi-zone rewrites; gateway app owns root; authenticated app served at root (no `/app` prefix), API on `api.eleva.care` subdomain (no `/api` prefix), docs at `/docs`; internal Vercel URLs redirected/noindexed
- [`ADR-015-multi-app-split.md`](./ADR-015-multi-app-split.md) — Split `apps/app` into role-focused micro-apps (member, account, expert, team, admin, academy) on `eleva.care` via gateway proxy rewrites + subdomains; Vercel Microfrontends rejected on cost
- [`ADR-016-subscription-ux-direction.md`](./ADR-016-subscription-ux-direction.md) — Embedded Checkout for SaaS subscription purchase + Customer Portal for management as the steady-state ("embedded widgets, no custom UI" paradigm; the WorkOS Widgets comparison is historical); multi-admin audit closed via `withAudit` on Portal session-mint correlated with webhook events; custom in-app management UI is contingency-only, not a planned migration; supersedes ADR-005's UX subsection; `payment_method_types` for subscriptions is `card + sepa_debit` only (MB WAY/Multibanco are one-time-only)
- [`ADR-017-better-auth-identity.md`](./ADR-017-better-auth-identity.md) — **Accepted (2026-09-07)** self-hosted Better Auth in `apps/api` at `/auth/*`; Drizzle `auth` schema; plugins organization/admin/twoFactor/passkey/magicLink/bearer/jwt/apiKey/openAPI/nextCookies; Neon managed Better Auth rejected
- [`ADR-018-daily-video-only.md`](./ADR-018-daily-video-only.md) — **Accepted (2026-09-07)** Daily.co is the only video provider (HIPAA domain branded `sessions.eleva.care`); calendars stay busy-time/destination only
- [`ADR-019-mvp-migration-and-cutover.md`](./ADR-019-mvp-migration-and-cutover.md) — **Accepted (2026-09-07)** import live MVP data; same Stripe platform; magic-link welcome; Google link only from WorkOS `idp_id`; rollback only before `CUTOVER_ACCEPTANCE_TS`
- [`ADR-020-envelope-encryption.md`](./ADR-020-envelope-encryption.md) — **Accepted (2026-09-07)** `@eleva/encryption` AES-256-GCM envelope (per-org DEK, versioned KEK); crypto-shred = delete DEK; OAuth tokens encrypted by Better Auth
- [`ADR-021-rbac-ssot-in-code.md`](./ADR-021-rbac-ssot-in-code.md) — **Accepted (2026-09-07)** `packages/auth/src/permissions.ts` (`createAccessControl`); product label = `(organization.type, member.role)`
- [`ADR-022-react-aria-ui-primitives.md`](./ADR-022-react-aria-ui-primitives.md) — `@eleva/ui` primitives move from Radix UI to Adobe React Aria Components via shadcn `aria-luma`; `radix-ui`/`cmdk`/`react-hook-form` removed; `AppRouterProvider` bridges React Aria `href`s to the Next.js router (absolute URLs hard-navigate for cross-zone); React Aria prop vocabulary (`isDisabled`/`onPress`/`isOpen`) is mandatory in consumers; `@radix-ui/themes` stays only as a WorkOS Widgets peer until Phase 3
- [`ADR-023-plate-rich-text-editor.md`](./ADR-023-plate-rich-text-editor.md) — **Accepted (2026-09-07)** Plate in `@eleva/editor`; `LocalizedRichText` JSONB; AI assist via `@eleva/ai`; Radix allowed only inside `packages/editor`

## ADR Template

```md
# ADR-XXX: Decision Title

## Status

Accepted

## Date

YYYY-MM-DD

## Context

Why this decision matters and what constraints exist.

## Decision

What we decided.

## Alternatives Considered

### Option A

- Pros
- Cons

### Option B

- Pros
- Cons

## Consequences

- Positive consequence
- Tradeoff
- Operational implication
```
