# Phase 11 — Clinics: `apps/team` SaaS

| Field      | Value                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-11/team-clinics`                                                                                                                                                                                                                                                                                                                                           |
| Depends on | Phases 6, 7                                                                                                                                                                                                                                                                                                                                                       |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                                                           |
| Touches    | `apps/team/**`, `apps/web` (clinic public page), `packages/billing/src/server/{subscriptions,provisioning}.ts`, `packages/accounting` (Tier 1b activation), `packages/db/src/schema/main/{clinic-profiles,clinic-members}.ts`, `apps/api/src/app/{teams,billing}/**`, `packages/auth` (invitations, team roles), `infra/stripe/**` (products/prices/entitlements) |
| Exit gate  | A clinic admin creates a Team, subscribes (Embedded Checkout), invites 3 experts who accept and appear on the clinic page; members book a clinic expert with 0% commission; seat changes update Stripe; monthly SaaS invoice (`ELEVA-SAAS-{YYYY}`) fires on `invoice.finalized`; Customer Portal manages the plan                                                 |

## Why this phase exists

Clinics are the SaaS revenue line (ADR-005/016): per-seat tiers, no booking commission. Better
Auth `organization` invitations + hooks (Phases 2-3) give membership; this phase adds the product.

## Scope

In:

- **Team creation** from `/account/workspaces/new` (type `team`): `clinic_profiles` (legal name,
  NIF, billing address, logo via public store, public slug, description, specialties),
  Become-Partner-like review for clinics (`clinic_verifications` queue for admin, Phase 12 UI).
- **Members & seats**: invite by email (Better Auth `organization.inviteMember`, role
  `admin|member`, expiry 7d, email via Lane 1 kind `team.invitation`), accept flow in
  `apps/account`, member roles: `owner` (billing), `admin` (manage), `member` (expert working
  inside the clinic); expert-in-clinic profile link (`expert_profiles.clinic_org_id` nullable, an
  expert may also keep a solo org); seat sync (Phase 3 hook) updates Stripe subscription
  quantity; seat limit enforcement by plan (Starter 5, Growth 20, Enterprise custom).
- **Billing**: plans from `infra/stripe/seed-products.ts` (Starter 99 + 39/seat, Growth 199 +
  29/seat, Enterprise contact) with Entitlements features (`team.members`, `team.branding`,
  `team.reports`); Embedded Checkout (`POST /billing/checkout` exists — extend for team plans) and
  Customer Portal (`POST /billing/portal`); `billing_subscriptions` status webhook handlers
  (`customer.subscription.created/updated/deleted`, `invoice.paid/payment_failed/finalized`) in
  the two-file contract; Tier 1b `issueClinicSaasInvoice` activated on `invoice.finalized`.
- **Clinic dashboard** (`apps/team/[orgSlug]`): overview (upcoming sessions across experts,
  revenue, seats), members (list, roles, invite, remove), schedule view (read-only across
  experts), bookings (list/filter by expert), billing (plan, seats, invoices, portal button),
  settings (profile, public page, branding), notifications inbox (Phase 8 component).
- **Clinic public page** (`apps/web/[locale]/[username]` shared namespace): clinic profile with
  experts grid; booking any expert routes to that expert's event types with `attribution =
clinic` so `computeApplicationFee` returns 0 bps and payout goes to the clinic's or the
  expert's Connect account per `clinic_profiles.payout_mode` (`clinic|expert`) — default `expert`
  in v1; `clinic` mode requires clinic Connect account (reuse Phase 6 onboarding for orgs).
- **Attribution** on `bookings.attributed_org_id` + `booking_payments.applied_commission_bps = 0`,
  set only from the booking source (clinic page path or signed clinic parameter) — never inferred
  from the expert's clinic membership. Direct `/[username]` bookings of clinic experts pay the
  standard commission.
- Playwright `e2e/team.spec.ts`.

Out: Enterprise SSO (post-launch), three-party revenue (`ff.three_party_revenue` off), clinic ->
expert invoices (out of scope per spec).

## Deliverables

1. Migrations: `clinic_profiles`, `clinic_verifications`, `expert_profiles.clinic_org_id`,
   `bookings.attributed_org_id`, `billing_subscriptions` fields; RLS; audit unions (`team:
created|verified|member_invited|member_joined|member_removed|seats_synced`; `subscription: ...`).
2. API: `/teams` (create/update profile), `/teams/[id]/members`, `/teams/[id]/invitations`,
   `/teams/[id]/bookings`, `/teams/[id]/schedule`, `/billing/checkout` + `/billing/portal`
   extended, webhook handlers; OpenAPI + client.
3. `apps/team` pages + `proxy.ts`; `apps/web` clinic page; `apps/account` accept-invitation page;
   messages `pt/en/es`.
4. Stripe products/prices/entitlements seeded (`pnpm stripe:seed` extended) and documented.
5. Tier 1b activation + tests; `e2e/team.spec.ts`.

## Acceptance criteria

- [ ] Create Team -> subscribe Starter via Embedded Checkout (test card) -> `billing_subscriptions`
      active, entitlements readable via `@eleva/billing` `hasFeature`.
- [ ] Invite 3 experts -> accept -> `member` rows -> Stripe quantity 3 (+ owner if counted per
      spec) -> remove one -> quantity decremented.
- [ ] Seat limit: 6th invite on Starter -> 409 `SEAT_LIMIT_REACHED` with upgrade CTA.
- [ ] Member books a clinic expert from the clinic page -> `applied_commission_bps = 0`,
      `attributed_org_id = clinic`; payout to the expert's account (default mode).
- [ ] `invoice.finalized` -> `clinic_saas_invoices` row issued in `ELEVA-SAAS-2026` (test series).
- [ ] Portal opens; plan change reflected by webhook within 1 min.
- [ ] Clinic dashboard shows cross-expert sessions with RLS respected (clinic org sees only its
      experts' bookings).
- [ ] `e2e/team.spec.ts` green.

## Tests

- vitest: seat sync math, seat limit, attribution -> 0 bps, webhook handlers, Tier 1b idempotency.
- Playwright: `team.spec.ts`.

## Docs to update

- `organization-and-clinic-model.md`, `payments-payouts-spec.md` (SaaS section),
  `identity-rbac-spec.md` (team roles), `infra/stripe/README.md`, `decision-log.md`.

## Local references

- `apps/team/src/**` (stub), `apps/expert/src/**` (patterns), `apps/account/src/app/account/workspaces/**`.
- `packages/billing/src/server/{subscriptions,provisioning,webhook}.ts`, `infra/stripe/seed-*.ts`,
  `infra/stripe/setup-portal.ts`, ADR-005, ADR-016, `docs/eleva-v3/organization-and-clinic-model.md`,
  `docs/eleva-v3/payments-payouts-spec.md` (clinic tiers).
- `packages/auth/src/server/auth.ts` (organization hooks, invitations), `permissions.ts`.
- `packages/accounting/src/eleva-platform/clinic-saas-invoices.ts` (Phase 7).

## External docs

- Stripe `/websites/stripe`: subscriptions with quantity, Embedded Checkout, Customer Portal
  configuration, Entitlements, `invoice.finalized`.
- Better Auth `/better-auth/better-auth`: organization invitations, members, `membershipLimit`,
  hooks.

## Risks

- Seat counting semantics (owner counted?) — decide from `payments-payouts-spec.md`; record in
  `decision-log.md`.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(/Users/<you>/…/elevacare-monorepo). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (stripe-webhooks, better-auth, api-first-agentic,
   audit-wiring, eleva-icons) and .cursor/skills/{stripe-webhooks,better-auth,api-first-agentic,
   audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/11-team-clinics.md in full.
3. Read every file under "Local references". Pull Stripe (subscriptions quantity, Embedded
   Checkout, Customer Portal, Entitlements, invoice.finalized) and Better Auth organization
   (invitations, hooks) docs through Context7.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-11/team-clinics
- Split into phase-11.1/team-core-billing and phase-11.2/team-dashboard-public if > 150 files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review -> fix -> repeat. Conventional Commits. pnpm review:branch -> fix.
- git push -u origin <branch> && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 11 TASK — Clinic (Team) SaaS product.

1. packages/db: clinic_profiles (org_id PK FK auth.organization type team, legal_name, nif,
   billing_address jsonb, logo_url, public_slug unique (shared username namespace with experts —
   enforce via a usernames view or shared table), description, specialties text[], payout_mode
   clinic|expert default expert, verification_status pending|verified|rejected, created_at),
   clinic_verifications (id, org_id, submitted_at, reviewed_by, reviewed_at, status, notes),
   expert_profiles.clinic_org_id nullable FK, bookings.attributed_org_id nullable,
   billing_subscriptions additions (seat_quantity, plan_key starter|growth|enterprise,
   current_period_end, cancel_at_period_end). RLS; audit unions per phase file.
2. Stripe: extend infra/stripe/seed-products.ts + seed-entitlements.ts with team plans (Starter
   99 EUR/mo base + 39 EUR/seat, Growth 199 + 29/seat, Enterprise contact) as one subscription with
   two items (base fixed, seat metered by quantity), features team.members, team.branding,
   team.reports; run pnpm stripe:seed and document ids in infra/stripe/README.md. Customer Portal
   configuration via infra/stripe/setup-portal.ts allows plan switch and quantity view only.
3. @eleva/billing: subscriptions.ts createTeamCheckoutSession(orgId, planKey) for Embedded
   Checkout (ui_mode embedded, return_url to apps/team billing), createPortalSession(orgId);
   provisioning.ts syncSeatQuantity(orgId) counts members with role in (owner, admin, member) — if
   payments-payouts-spec.md says owner is not a seat, implement that and record in decision-log;
   enforce seat limits per plan (Starter 5, Growth 20, Enterprise unlimited) in the invitation
   endpoint -> 409 SEAT_LIMIT_REACHED. Webhooks (two-file contract): customer.subscription.created,
   customer.subscription.updated, customer.subscription.deleted, invoice.paid,
   invoice.payment_failed, invoice.finalized -> billing_subscriptions + emitDomainEvent; on
   invoice.finalized call @eleva/accounting issueClinicSaasInvoice (flag
   ff.toconline_invoicing_enabled). hasFeature(orgId, feature) reads Stripe Entitlements with
   cache.
4. Attribution: set bookings.attributed_org_id ONLY when the booking originates from the clinic
   surface — path /[clinicSlug]/[expertUsername]/[eventSlug] or a signed clinic attribution
   parameter issued by the clinic page (validate the clinic is active, the expert is a current
   member of that clinic, and the parameter is not older than 24h). The expert's
   clinic_org_id membership alone NEVER sets attribution: a direct booking on /[username] of a
   clinic-affiliated expert is a marketplace booking and pays the normal commission. Pass
   buyerContext { attributedOrgId } to computeApplicationFee -> 0 bps only for attributed
   bookings; add unit tests for both paths; destination Connect account = expert's (payout_mode expert) or clinic's (payout_mode
   clinic requires clinic Connect onboarding — reuse Phase 6 flows for org accounts).
5. apps/api: POST/PATCH /teams (profile), POST /teams/[id]/submit-verification, GET /teams/[id]/
   members, POST /teams/[id]/invitations (Better Auth inviteMember + Lane 1 kind team.invitation),
   DELETE /teams/[id]/members/[userId], GET /teams/[id]/bookings?expertId, GET /teams/[id]/
   schedule?from&to, POST /billing/checkout (team plans), POST /billing/portal. Capabilities from
   permissions.ts (team:manage_members, team:billing). OpenAPI + client.
6. apps/account: /account/invitations/[id] accept/decline page (Better Auth acceptInvitation);
   /account/workspaces/new type "team" collects clinic_profiles fields.
7. apps/team: layout on @eleva/dashboard (nav: Overview, Members, Schedule, Bookings, Billing,
   Settings, Notifications), proxy.ts < 50 LOC. Pages: overview (KPIs, upcoming sessions across
   experts), members (table, roles, invite dialog, remove, seat usage bar), schedule (week view
   across experts, read-only), bookings (filters), billing (plan card, seats, invoices list from
   Stripe + clinic_saas_invoices, Embedded Checkout mount for first purchase, Portal button),
   settings (profile, public page preview, branding logo upload to PUBLIC store, payout mode).
   Messages pt/en/es.
8. apps/web: clinic public page at /[locale]/[clinicSlug] (profile + experts grid) and expert
   booking path with clinic attribution; sitemap entries.
9. Tests: seat sync + limits, attribution -> 0 bps, webhook handlers, Tier 1b idempotency,
   RLS for clinic bookings view. e2e/team.spec.ts: create team -> checkout (test card) -> invite ->
   accept -> member visible -> book clinic expert -> 0 fee.
10. Docs: organization-and-clinic-model.md, payments-payouts-spec.md (SaaS), identity-rbac-spec.md
    (team roles), infra/stripe/README.md, decision-log.md (seat semantics).

Acceptance (paste evidence): team + subscription active with entitlements; invitations/seat sync
up and down; seat limit 409; 0% attribution booking; ELEVA-SAAS invoice on invoice.finalized
(test series); portal plan change reflected; RLS-respecting dashboard; e2e green.

Report: migrations, endpoints, Stripe object ids, tests, CodeRabbit CLI counts, PR URL(s).
```
