# 15 — Clerk → WorkOS Branch Learnings

> The `clerk-workos` branch (https://github.com/rodrigobarona/eleva-care-app/tree/clerk-workos) contains months of validated experimentation toward v2. This chapter is the **adopt / adapt / override** matrix that decides what we lift wholesale, what we lift with edits, and what we throw away.

## How to use this chapter

For each design area in the branch:

- **ADOPT** — lift the design and the prose docs as-is into v2 (and into `apps/docs`).
- **ADAPT** — keep the spirit, change specific details that conflict with the v2 architecture chosen in this blueprint.
- **OVERRIDE** — branch made an incorrect call (usually because of a constraint that no longer applies in the monorepo). Use the v2 design instead.

The branch's own docs live under `_docs/` on that branch. Paths below reference branch-relative paths (prefix `_docs/...` is implied).

## Adopt / adapt / override matrix

| Area | Branch artifact(s) | Decision | Rationale |
|---|---|---|---|
| **Org-per-user multi-tenancy** | `04-development/org-per-user-model.md`, `02-core-systems/workos-sync-architecture.md` | **ADOPT** | Cleanest tenancy model; lets us add real organizations later (clinics) without schema migration. Already validated end-to-end on the branch. |
| **WorkOS RBAC: ~132 permissions × 5 roles** | `_WorkOS RABAC implemenation/WORKOS-RBAC-IMPLEMENTATION-GUIDE.md`, `WORKOS-ROLES-PERMISSIONS-CONFIGURATION.md`, `generated/workos-rbac-config.json`, `generated/workos-rbac-constants.ts` | **ADOPT WITH RENAME** | Already enumerated, matrixed, and exported as a TS constant. Lift the constants file into `packages/auth/permissions.ts`. The branch's matrix uses the legacy six-role names (`superadmin`, `partner_admin`, `user`); v2 generation step renames to `admin` (WorkOS default), `clinic`, `member` (WorkOS default), keeping `expert_top` and `expert_community`. The destructive permissions previously gated by `superadmin` move to a permission-only operator subset of `admin`. See [18-rbac-and-permissions.md](18-rbac-and-permissions.md). |
| **RBAC sidebar driven by permissions** | `_WorkOS RABAC implemenation/RBAC-SIDEBAR-IMPLEMENTATION.md` | **ADOPT** | Sidebar items hide/show purely from JWT claims — no extra fetch. |
| **WorkOS RBAC + Neon RLS pairing** | `_WorkOS RABAC implemenation/WORKOS-RBAC-NEON-RLS-REVIEW.md` | **ADOPT** | Validates the four-layer enforcement model (proxy → layout → action → RLS). |
| **WorkOS dashboard quick setup** | `_WorkOS RABAC implemenation/WORKOS-DASHBOARD-QUICK-SETUP.md` | **ADOPT** | Step-by-step for provisioning roles in the WorkOS dashboard. Move into `apps/docs/operations/workos-setup.md`. |
| **FGA evaluation** | `_WorkOS RABAC implemenation/FGA-EVALUATION.md`, `FGA-FUTURE-MIGRATION-ANALYSIS.md` | **ADOPT** as future-roadmap doc | Concludes RBAC + RLS is enough for v2; FGA is a Phase 3 consideration when clinics arrive. |
| **WorkOS Vault for Google OAuth tokens** | `_WorkOS Vault implemenation/CAL-COM-CALENDAR-SELECTION.md`, `WORKOS-SSO-VS-CALENDAR-OAUTH.md`, `MIGRATION-COMPLETE.md`, `NEON-DATABASE-VERIFICATION.md` | **ADOPT** | Critical for fixing single-key encryption issue (lessons learned row 14/15). See [17-encryption-and-vault.md](17-encryption-and-vault.md). |
| **WorkOS Vault: org-scoped envelope encryption for PHI** | `_WorkOS Vault implemenation/IMPLEMENTATION-COMPLETE.md`, `SIMPLIFIED-SUMMARY.md`, `workos-vault-migration-plan.md` | **ADOPT** | Mirrors the same pattern for healthcare records. |
| **WorkOS sync architecture (non-blocking)** | `02-core-systems/workos-sync-architecture.md` | **ADOPT** | Best-effort immediate sync + webhook eventual consistency. Auth path never blocks on DB. |
| **Stripe lookup keys (no hardcoded price IDs)** | `LOOKUP-KEYS-ACTION-PLAN.md`, `LOOKUP-KEYS-IMPLEMENTATION-SUMMARY.md`, `LOOKUP-KEYS-MIGRATION.md`, `STRIPE-LOOKUP-KEYS-DATABASE-ARCHITECTURE.md`, `COMMIT-LOOKUP-KEYS.md` | **ADOPT** | Solves price-rotation pain. Lift into `packages/payments/lookup-keys.ts`. |
| **Stripe expert subscriptions** | `02-core-systems/STRIPE-SUBSCRIPTION-SETUP.md`, `SUBSCRIPTION-IMPLEMENTATION-STATUS.md` | **ADOPT** | Pricing tiers + lookup keys + DB mirror. See [16-subscriptions-and-three-party-revenue.md](16-subscriptions-and-three-party-revenue.md). |
| **Three-party clinic revenue model** | `02-core-systems/THREE-PARTY-CLINIC-REVENUE-MODEL.md` | **ADAPT** (Phase 2, feature-flagged) | Spec is good; implementation gated on `FF_THREE_PARTY_REVENUE` — only one expert is in a clinic in MVP. |
| **Pricing tables** | `PRICING-TABLES-IMPLEMENTATION.md`, `PRICING-MODEL-CORRECTED.md`, `PRICING-TABLE-OPTIMIZATION.md`, `COMMIT-PRICING-TABLES.md` | **ADOPT** | Visual pricing component implemented; reuse with v2 lookup keys. |
| **Become Partner application form + admin queue** | `BECOME-PARTNER-IMPLEMENTATION.md` | **ADOPT** | First-class onboarding pipeline (replaces ad-hoc email). |
| **Patient Portal specification** | `_rethink folder and menu structure/PATIENT-PORTAL-SPECIFICATION.md` | **ADOPT** | Lift wholesale; this is the single biggest UX gap in MVP. |
| **Dashboard menu architecture redesign** | `_rethink folder and menu structure/DASHBOARD-MENU-ARCHITECTURE.md`, `DASHBOARD-MENU-IMPLEMENTATION.md`, `DASHBOARD-MENU-VISUAL-HIERARCHY.md`, `DASHBOARD-REDESIGN-SUMMARY.md`, `COMPLETE-REDESIGN-SUMMARY.md` | **ADOPT** | Permission-driven menus; consistent with RBAC sidebar pattern. |
| **Availability schedules redesign** | `_rethink folder and menu structure/AVAILABILITY-SCHEDULES-SPECIFICATION.md` | **ADOPT** | Resolves the legacy single-schedule limitation; supports per-event-type schedules. Live in `packages/scheduling`. |
| **Bun runtime migration (dev only)** | `03-infrastructure/BUN-RUNTIME-MIGRATION.md` | **ADOPT** | Bun for local dev, Node 24 on Vercel. Documented in [14-v2-target-monorepo.md](14-v2-target-monorepo.md). |
| **`src/` migration** | `04-development/src-migration.md` | **ADOPT** | Closes the duplicate-`MeetingForm` trap. v2 is `src/`-only. |
| **Composable proxy middleware** | `04-development/PROXY-MIDDLEWARE.md` | **ADOPT** | The exact architecture used in [04-routing-and-app-structure.md](04-routing-and-app-structure.md): orchestrator + handler chain. |
| **Route constants** | `04-development/ROUTE-CONSTANTS.md` | **ADOPT** | Centralized route registry; eliminates magic strings in proxy and links. |
| **Component architecture review** | `04-development/component-architecture-review.md`, `component-migration-summary.md`, `shared-components-reorganization.md` | **ADAPT** | Most decisions hold. Re-evaluate any conclusions that assume Clerk; restate them for WorkOS in `apps/web/README.md`. |
| **Server/client composition standards** | `04-development/server-client-composition.md` | **ADOPT** | Codifies "default server, opt into client". Carries forward verbatim. |
| **Database conventions** | `04-development/standards/01-database-conventions.md` | **ADAPT** | Adopt naming/casing rules. Override anything that assumed `clerkUserId` columns; v2 uses `org_id` / `actor_user_id`. |
| **i18n standards** | `04-development/standards/02-internationalization.md` | **ADOPT** | Aligned with [12-internationalization.md](12-internationalization.md). |
| **Server actions standards** | `04-development/standards/03-server-actions.md` | **ADOPT** | Specifies validation, return-shape, audit hooks. |
| **Bundle / build / Web Vitals optimization** | `standards/04-bundle-optimization-report.md`, `05-build-optimization-guide.md`, `06-core-web-vitals-optimization.md` | **ADOPT** | Concrete wins; carry into `apps/web` build config. |
| **Server audit (Feb 2026)** | `standards/07-server-audit-feb2026.md` | **ADOPT** as a one-off audit baseline | Useful comparison point as v2 evolves. |
| **Sentry observability standards** | `standards/08-sentry-observability.md` | **ADOPT** | Tag conventions, breadcrumb patterns, release versioning. |
| **Testing strategy & roadmap** | `04-development/testing-strategy.md`, `testing-roadmap.md`, `testing/01-testing-guide.md`, `02-webhook-testing.md`, `03-email-testing-guide.md`, `04-testing-overview.md`, `05-testing-summary.md`, `06-webhook-testing-detailed.md` | **ADOPT** | Vitest + Playwright + Stripe local; mirrored in [09-workflows-and-async-jobs.md](09-workflows-and-async-jobs.md) and [14-v2-target-monorepo.md](14-v2-target-monorepo.md). |
| **Calendar creation idempotency** | `02-core-systems/payments/11-calendar-creation-idempotency.md` | **ADOPT** | Closes the duplicate-event bug (lessons learned row 3). Lift into `packages/calendar`. |
| **Race-condition fixes (slot reservation)** | `02-core-systems/payments/05-race-condition-fixes.md` | **ADAPT** | Adopt the fix; v2 also requires real DB transactions (not branch's `neon-http` workarounds). |
| **Multibanco reminder system** | `02-core-systems/payments/06-multibanco-integration.md`, `07-multibanco-reminder-system.md`, `08-policy-v3-customer-first-100-refund.md`, `09-multibanco-refund-flow-audit.md` | **ADAPT** | Adopt the policy + UX. **Replace** QStash polling with Vercel Workflows (see [09-workflows-and-async-jobs.md](09-workflows-and-async-jobs.md)). |
| **Enhanced payout processing** | `02-core-systems/payments/03-enhanced-payout-processing.md` | **ADAPT** | Adopt eligibility logic. Implement as `payoutEligibility` workflow, not a polling cron. |
| **Payment restrictions** | `02-core-systems/payments/04-payment-restrictions.md` | **ADOPT** | Country/method gating logic moves to `packages/payments/restrictions.ts`. |
| **Payment flow analysis** | `02-core-systems/payments/01-payment-flow-analysis.md` | **ADOPT** as reference doc | Comprehensive narrative; lift into `apps/docs/payments/overview.md`. |
| **Stripe integration baseline** | `02-core-systems/payments/02-stripe-integration.md` | **ADAPT** | Adopt code patterns; **override** any code that uses three webhook routes — v2 is one route. |
| **Payments consolidation summary** | `02-core-systems/payments/10-consolidation-summary.md` | **ADOPT** | Confirms the unification direction (one webhook). |
| **Stripe identity / payouts integrations** | `04-development/integrations/01-stripe-identity.md`, `02-stripe-payouts.md`, `05-identity-verification-fix.md` | **ADOPT** | Lift verbatim into `packages/payments/identity.ts` and `payouts.ts`. |
| **Private layout** | `04-development/integrations/03-private-layout.md` | **ADAPT** | Adopt structure; rewire any Clerk hooks to WorkOS. |
| **Email templates inventory** | `04-development/integrations/04-email-templates.md` | **ADOPT** | Template list reused by `packages/email`. |
| **Stripe notifications doc** | `02-core-systems/notifications/03-stripe-notifications.md` | **ADAPT** | Logic carries; **replace** Novu workflow IDs with Resend Automation triggers ([08-notifications-email-resend-crm.md](08-notifications-email-resend-crm.md)). |
| **Novu integration / framework setup / production-ready** | `02-core-systems/notifications/01-novu-integration.md`, `04-novu-framework-setup.md`, `07-novu-workflows-production-ready.md` | **OVERRIDE** | Whole stack is being removed. Keep these only as historical reference. |
| **Notification workflows catalog** | `02-core-systems/notifications/02-notification-workflows.md` | **ADAPT** | Use the catalog as the source list of triggers; re-implement on Resend. |
| **Email templates implementation** | `02-core-systems/notifications/05-email-templates.md` | **ADOPT** | React Email templates carry as-is into `packages/email/templates`. |
| **Redis caching / Clerk user cache / Stripe customer cache / rate limiting** | `02-core-systems/caching/01-redis-caching.md`, `02-clerk-user-cache.md`, `03-stripe-customer-cache.md`, `04-rate-limiting.md` | **ADAPT** | Patterns carry. **Rename** "clerk-user-cache" → "workos-user-cache"; logic identical. |
| **Redis implementation deep-dive** | `02-core-systems/caching/01-redis-implementation.md` | **ADOPT** | Lift into `packages/cache`. |
| **Redis integration guide** | `03-infrastructure/caching/04-redis-integration-guide.md` | **ADOPT** | Operator-facing doc. |
| **Encryption architecture** | `03-infrastructure/ENCRYPTION-ARCHITECTURE.md` | **ADAPT** | Adopt requirements + threat model. **Override** the AES-only implementation; v2 uses WorkOS Vault. |
| **Cron jobs / QStash / automation systems** | `03-infrastructure/cron-jobs.md`, `automation-systems.md`, `scheduling/01-cron-jobs.md`, `02-qstash-integration.md`, `04-development/LOCAL-QSTASH-SETUP.md`, `QSTASH-AUTO-STARTUP-SUMMARY.md` | **OVERRIDE** | All async work moves to Vercel Workflows; periodic-only stays in `vercel.ts`. |
| **BetterStack monitoring + unified monitoring** | `03-infrastructure/monitoring/01-betterstack-monitoring.md`, `04-monitoring-guide.md`, `07-unified-monitoring-architecture.md` | **ADOPT** | Heartbeat patterns carry; expand to cover workflows. |
| **Health-check monitoring + keep-alive** | `03-infrastructure/monitoring/01-health-check-monitoring.md`, `05-keep-alive-enhancements.md` | **ADAPT** | Adopt; collapse to single `/api/health` (lessons learned row 33). |
| **Sentry monitoring** | `03-infrastructure/monitoring/06-sentry-error-monitoring.md` | **ADOPT** | |
| **PostHog analytics + dashboard** | `03-infrastructure/monitoring/02-posthog-analytics.md`, `03-posthog-dashboard.md` | **OVERRIDE** | PostHog is dropped (per user direction). Keep as historical context only. |
| **Authentication: Clerk configuration** | `02-core-systems/authentication/01-clerk-configuration.md` | **OVERRIDE** | Replaced by WorkOS — keep the file as a "what was" reference; new doc lives in `apps/docs/auth/workos.md`. |
| **Authentication: role / permission / route protection / fixes changelog** | `02-core-systems/authentication/02-role-management.md`, `03-permission-system.md`, `04-route-protection.md`, `06-fixes-changelog.md` | **ADAPT** | Logic patterns carry; switch every Clerk reference to WorkOS. The 89-permission matrix is canonical. |
| **Authentication overview README** | `02-core-systems/authentication/00-README.md` | **ADAPT** | Rewrite for WorkOS; keep the section structure. |
| **Naming conventions glossary** | `02-core-systems/NAMING-CONVENTIONS-GLOSSARY.md` | **ADOPT** | Carry into `apps/docs/conventions/glossary.md`. |
| **Role progression system** | `02-core-systems/ROLE-PROGRESSION-SYSTEM.md`, `ROLE-PROGRESSION-SUMMARY.md` | **ADOPT** | The expert-onboarding state machine; reuse exactly. |
| **CI/CD integration** | `03-infrastructure/ci-cd/01-ci-cd-integration.md` | **ADAPT** | Adopt CI structure; add new gates (i18n parity, idempotency wrapper lint, RBAC drift). |
| **Architecture overview & v0.5 release summary** | `01-getting-started/04-architecture-overview.md`, `05-v0.5.0-release-summary.md` | **ADAPT** | Use as the structural skeleton for `apps/docs/architecture/overview.md`; update integration list to reflect v2 stack. |
| **API overview** | `01-getting-started/02-api-overview.md` | **ADOPT** | Endpoint catalog. |
| **Quick start + expert user guide** | `01-getting-started/01-quick-start.md`, `03-expert-user-guide.md` | **ADAPT** | Adopt; refresh commands for monorepo. |
| **Codebase cleanup (2025-12)** | `04-development/CODEBASE-CLEANUP-2025-12.md`, `root-cleanup-complete.md`, `root-cleanup-plan.md` | **ADOPT** as historical | Pre-monorepo cleanup; useful diff context. |
| **Package migration plan 2025** | `04-development/PACKAGE-MIGRATION-PLAN-2025.md` | **ADAPT** | Use as the seed for v2 migration sequencing in [19-rebuild-roadmap.md](19-rebuild-roadmap.md). |
| **Footer refactoring summary** | `04-development/footer-refactoring-summary.md` | **ADOPT** | Trivial, but useful pattern (`packages/ui` candidate). |
| **WorkOS-Stripe integration** | `_WorkOS-Stripe/WORKOS-STRIPE-INTEGRATION-GUIDE.md`, `WORKOS-STRIPE-QUICK-ANSWER.md` | **ADOPT** | How WorkOS user IDs map to Stripe Customer IDs and Connect accounts. |
| **Eleva color system update** | `ELEVA-COLOR-SYSTEM-UPDATE.md` | **ADOPT** | Token system for `packages/ui`. |
| **Environment variables cleanup** | `ENVIRONMENT-VARIABLES-CLEANUP.md` | **ADAPT** | Adopt cleanup principles; the v2 env list in [14-v2-target-monorepo.md](14-v2-target-monorepo.md) supersedes the specific names. |
| **MDX locale fix + metadata migration** | `MDX-LOCALE-FIX.md`, `MDX-METADATA-MIGRATION.md` | **ADOPT** | Carry into `packages/content`. |
| **Next.js 16 architecture** | `NEXTJS-16-ARCHITECTURE.md` | **ADOPT** | Validates server-component-first defaults. |
| **Stripe pricing review** | `STRIPE-PRICING-REVIEW.md` | **ADOPT** | Pricing decisions documented; v2 lookup keys honor them. |
| **Username reserved routes** | `USERNAME_RESERVED_ROUTES.md` | **ADOPT** | Reserved-list logic moves to `packages/content/reserved-usernames.ts`. |
| **ERS Portugal docs** | `ERS_portugal/Implementation Plan Payments and Billing.md`, `alinhamento.md`, `email-ers.md`, `ers-memo.md`, `readline.md`, `translation-reference.md` | **ADOPT** | Compliance + alignment docs; move to `apps/docs/compliance/portugal/`. |
| **Evidence-based care improvements + reference example** | `EVIDENCE-BASED-CARE-IMPROVEMENTS.md`, `evidence-based-care-reference-example.md` | **ADOPT** | Content guidelines for clinical articles. |
| **Collapsible references guide** | `collapsible-references-guide.md` | **ADOPT** | Content/MDX component pattern. |
| **WorkOS setup checklist** | `workos-setup-checklist.txt` | **ADOPT** | Operator runbook. |
| **`_WorkOS RABAC implemenation_backup_*` folder** | (snapshot from 2025-11-13) | **OVERRIDE** | Stale snapshot — ignore; the non-backup folder is the source of truth. |
| **`_archive.zip`** | branch root | **OVERRIDE** | Don't include in v2; archive externally if needed. |
| **Changelog & commit notes** | `CHANGELOG.md`, `COMMIT-*.md`, `ROOT-PAGE-FIX.md` | **ADOPT** as historical | Useful provenance; not part of the v2 active doc set. |

## Specific lifts (file-level)

These files lift directly into v2 with **at most cosmetic edits**:

- `_docs/_WorkOS RABAC implemenation/generated/workos-rbac-constants.ts` → `packages/auth/src/permissions.generated.ts` (regenerated by script).
- `_docs/_WorkOS RABAC implemenation/generated/workos-rbac-config.json` → `infra/workos/rbac-config.json` (input to `infra/workos/scripts/sync-rbac.ts`).
- `_docs/_WorkOS Vault implemenation/workos-vault-migration-plan.md` → `apps/docs/operations/vault-migration.md`.
- `_docs/04-development/PROXY-MIDDLEWARE.md` → `apps/docs/architecture/proxy.md`.
- `_docs/04-development/ROUTE-CONSTANTS.md` → `apps/docs/architecture/route-constants.md`.
- `_docs/02-core-systems/payments/11-calendar-creation-idempotency.md` → `apps/docs/calendar/idempotency.md`.
- `_docs/_rethink folder and menu structure/PATIENT-PORTAL-SPECIFICATION.md` → `apps/docs/specs/patient-portal.md`.
- `_docs/_rethink folder and menu structure/AVAILABILITY-SCHEDULES-SPECIFICATION.md` → `apps/docs/specs/availability-schedules.md`.
- `_docs/_rethink folder and menu structure/DASHBOARD-MENU-ARCHITECTURE.md` → `apps/docs/specs/dashboard-menu.md`.
- `_docs/BECOME-PARTNER-IMPLEMENTATION.md` → `apps/docs/specs/become-partner.md`.
- `_docs/02-core-systems/THREE-PARTY-CLINIC-REVENUE-MODEL.md` → `apps/docs/specs/three-party-revenue.md`.
- `_docs/STRIPE-LOOKUP-KEYS-DATABASE-ARCHITECTURE.md` → `apps/docs/specs/stripe-lookup-keys.md`.
- `_docs/02-core-systems/workos-sync-architecture.md` → `apps/docs/architecture/workos-sync.md`.

## Specific overrides (file-level)

These files in the branch must NOT shape v2 design:

- `_docs/02-core-systems/notifications/01-novu-integration.md`, `04-novu-framework-setup.md`, `07-novu-workflows-production-ready.md` — Novu is gone.
- `_docs/03-infrastructure/scheduling/02-qstash-integration.md`, `04-development/LOCAL-QSTASH-SETUP.md`, `QSTASH-AUTO-STARTUP-SUMMARY.md` — QStash is gone.
- `_docs/03-infrastructure/monitoring/02-posthog-analytics.md`, `03-posthog-dashboard.md` — PostHog is dropped.
- `_docs/02-core-systems/authentication/01-clerk-configuration.md` — Clerk is gone.
- `_docs/_WorkOS RABAC implemenation_backup_20251113_043831/` — superseded snapshot.

## Conflict resolution rules

When a branch doc conflicts with this blueprint:

1. **Architecture choices in this blueprint win.** The blueprint represents the user's explicit v2 direction (WorkOS, Resend, Workflows, no PostHog/Dub).
2. **Branch implementations win on tactics.** When the branch already worked out a battle-tested pattern (idempotency, RBAC sidebar, sync architecture), use that pattern.
3. **Lessons learned (Chapter 13) win on bug fixes.** If the branch documents a fix that the blueprint hasn't accounted for, surface it back into Chapter 13.

## Inputs to other chapters

This adoption matrix specifically informs:

- [03-data-model.md](03-data-model.md): `org_id` columns, RLS, organizations/memberships mirror tables.
- [05-identity-auth-rbac.md](05-identity-auth-rbac.md): WorkOS sync architecture, JWT claim shape.
- [06-payments-stripe-connect.md](06-payments-stripe-connect.md): single webhook, lookup keys, Multibanco workflows.
- [07-scheduling-booking-calendar.md](07-scheduling-booking-calendar.md): calendar idempotency, race fixes.
- [09-workflows-and-async-jobs.md](09-workflows-and-async-jobs.md): retire QStash, retain reminder/payout logic on Workflows.
- [16-subscriptions-and-three-party-revenue.md](16-subscriptions-and-three-party-revenue.md): subscriptions, lookup keys, three-party model.
- [17-encryption-and-vault.md](17-encryption-and-vault.md): WorkOS Vault for tokens + PHI.
- [18-rbac-and-permissions.md](18-rbac-and-permissions.md): 5 roles × ~132 permissions matrix (2 WorkOS defaults + 3 custom).
- [19-rebuild-roadmap.md](19-rebuild-roadmap.md): milestones explicitly cite branch docs to lift on each step.
