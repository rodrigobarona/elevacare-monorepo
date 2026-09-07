# Phase 11 — Clinics: `apps/team` SaaS

| Field      | Value                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-11/team-clinics`                                                                                                                                                                                                                                                                                                                                           |
| Depends on | Phases 6, 7 and **10** (the clinic shared-records toggle only flips the D-11 access model Phase 10 enforces)                                                                                                                                                                                                                                                      |
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
  inside the clinic); expert-in-clinic profile = a **second `expert_profiles` row with
  `org_id = clinic org`** (existing schema: unique `(user_id, org_id)`, team experts share the
  clinic's `org_id` — see `packages/db/src/schema/main/expert-profiles.ts`); an expert may also
  keep a solo `expert` org with its own row. There is **no** `clinic_org_id` column — clinic
  affiliation is the membership plus the per-org profile row. **Seat rule (single definition used by schema, code, tests
  and acceptance):** a billable seat is a clinic membership — any role, owner included — whose
  user has at least one _published_ event type in that clinic; owner/admin accounts without
  published event types are free. `syncSeatQuantity` (Phase 3 hook; keeps its
  `afterAddMember` / `afterAcceptInvitation` / `afterRemoveMember` triggers and is additionally
  re-run on event-type publish/unpublish) pushes that count to the Stripe subscription quantity —
  a joining member who already has a published event type in that clinic (e.g. re-invited after
  removal) becomes billable at join time, not at the next publish;
  plan caps (Starter 5, Growth 20, Enterprise custom) are enforced when the cap would be
  exceeded by a publish -> `409 SEAT_LIMIT_REACHED`.
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
- **Clinic public page** at `apps/web/[locale]/[clinicSlug]` (same `/[locale]/[handle]` slot that
  Phase 4 gives experts; `public_handles` decides whether a handle renders an expert or a clinic —
  see deliverable 1), **gated twice**: the whole clinic public surface (page, booking route,
  sitemap entries, signed clinic attribution) renders only when the rollout flag
  `ff.clinic_public_pages` is on **and** `clinic_profiles.verification_status = 'verified'`;
  `pending`/`rejected` clinics return 404 from the page and the booking route, are excluded from
  the sitemap and from `public_handles` resolution for public rendering, and
  `POST /bookings/reserve` rejects `attribution = clinic` for them with 404 (never reveal the
  status); test: pending clinic -> page 404, sitemap omits it, reserve with clinic attribution
  404; verified + flag on -> all three succeed: clinic profile with experts grid; **canonical clinic booking route** =
  `/[locale]/[clinicSlug]/[expertUsername]/[eventSlug]` (locale-prefixed like every `apps/web`
  route; Phase 4 owns `/[locale]/[username]/[eventSlug]` for marketplace bookings), which sets
  `attribution = clinic` so `computeApplicationFee` returns 0 bps and payout goes to the clinic's or the
  expert's Connect account per `clinic_profiles.payout_mode` (`clinic|expert`) — default `expert`
  in v1; `clinic` mode requires clinic Connect account (reuse Phase 6 onboarding for orgs). The
  destination is **resolved once, when the payment is confirmed**, and written to the Phase 6
  snapshot columns `payout_states.destination_org_id` / `destination_connect_account_id`;
  transfers, refunds, reconciliation and retries use only that snapshot, so a clinic flipping
  `payout_mode` after a booking is paid never redirects money already owed.
- **Attribution** on `bookings.attributed_org_id` + `booking_payments.applied_commission_bps = 0`,
  set only from the booking source (the canonical clinic route above, or a signed clinic parameter
  carried to `/[locale]/[username]/[eventSlug]`) — never inferred from the expert's clinic
  membership. Direct `/[locale]/[username]/[eventSlug]` bookings of clinic experts pay the
  standard commission.
- **Clinic clinical access (D-11, toggles only)**: the access model is defined and enforced by
  Phase 10 RLS (authoring expert; same-clinic experts only when `organizations.clinic_shared_records`
  is on and the member has not opted out; staff never in plaintext). This phase adds the **clinic
  admin toggle** (`PATCH /teams/[id]/settings { clinicSharedRecords }`, default **off**, reason
  required, audited `team: shared_records_enabled|disabled`, and a member-facing notice + opt-out
  in `apps/app` privacy settings that writes `record_access_optouts`). No new RLS policy is
  written here; the Phase 10 class tests are re-run with the toggle on and off.
- **Clinic public page** resolves through `public_handles` (owner_kind `clinic`, created in Phase 4) — this phase only inserts clinic owners into the existing table.
- Playwright `e2e/team.spec.ts`.

Out: Enterprise SSO (post-launch), three-party revenue (`ff.three_party_revenue` off), clinic ->
expert invoices (out of scope per spec).

## Deliverables

1. Migrations: `clinic_profiles`, `clinic_verifications`, `bookings.attributed_org_id`, `billing_subscriptions` fields, `organizations.clinic_shared_records boolean default false`, `record_access_optouts` (`member_user_id`, `org_id`, `created_at`, PK both); RLS; audit unions (`team:
created|verified|member_invited|member_joined|member_removed|seats_synced|shared_records_enabled|shared_records_disabled`; `subscription: ...`).
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
- [ ] Invite 3 experts -> accept -> `member` rows -> each publishes one event type -> Stripe
      quantity 3 (the owner has no published event type and is not counted) -> remove one ->
      quantity 2; unpublishing the last event type of a member also decrements.
- [ ] Seat limit: the 6th billable expert publishing an event type on Starter -> 409
      `SEAT_LIMIT_REACHED` with upgrade CTA (invitations themselves are not capped).
- [ ] Member books a clinic expert from the clinic page -> `applied_commission_bps = 0`,
      `attributed_org_id = clinic`; payout to the expert's account (default mode).
- [ ] `invoice.finalized` -> `clinic_saas_invoices` row issued in `ELEVA-SAAS-2026` (test series).
- [ ] Portal opens; plan change reflected by webhook within 1 min.
- [ ] Clinic dashboard shows cross-expert sessions with RLS respected (clinic org sees only its
      experts' bookings).
- [ ] Clinical access (D-11): a new clinic has `clinic_shared_records = false` and a same-clinic
      expert reading another expert's record gets 0 rows; `PATCH /teams/[id]/settings` without a
      reason -> 400, with a reason -> toggle on + `team: shared_records_enabled` audit row with the
      actor and reason; toggle on -> same-clinic read returns the record; member opt-out
      (`record_access_optouts` row) -> that member's records return 0 rows to other clinic experts
      while the toggle stays on; toggle off -> back to 0 rows; staff role never decrypts in any
      state; the Phase 10 `rls-classes.test.ts` suite passes with the toggle on and off.
- [ ] `e2e/team.spec.ts` green.

## Tests

- vitest: seat sync math, seat limit, attribution -> 0 bps, webhook handlers, Tier 1b idempotency;
  `clinic-shared-records.test.ts` (Neon branch): default off, reason required + audit, toggle
  on/off, member opt-out, staff never — every case in the D-11 acceptance row above.
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

- Seat rule ambiguity is closed by this phase (see Scope): billable seat = membership with >= 1
  published event type in the clinic, role-independent; `payments-payouts-spec.md` "published in
  the last 30 days" qualifier is dropped as non-deterministic. Record in `decision-log.md`.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (stripe-webhooks, better-auth, api-first-agentic,
   audit-wiring, eleva-icons) and .cursor/skills/{stripe-webhooks,better-auth,api-first-agentic,
   audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/11-team-clinics.md in full.
3. Read every file under "Local references". Pull Stripe (subscriptions quantity, Embedded
   Checkout, Customer Portal, Entitlements, invoice.finalized) and Better Auth organization
   (invitations, hooks) docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 11 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-11/team-clinics
- Keep the PR at <= 30 files / 400 lines where possible; split above 60 files / 800 lines and always before 100 reviewable files (the review cap). Split into phase-11.1/team-core-billing and phase-11.2/team-dashboard-public if needed.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean or
  the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6); request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 11 TASK — Clinic (Team) SaaS product.

1. packages/db: public_handles (handle citext PK, owner_kind expert|clinic, owner_id, created_at)
   — the ONE table that owns the /[username] namespace: expert usernames (migrate
   expert_profiles.username to reference it) and clinic slugs are both inserted here in the same
   transaction that creates the profile, so uniqueness across experts and clinics is a real
   constraint, not a view; include the reserved-word list (system routes) as a check; RLS public
   read. clinic_profiles (org_id PK FK auth.organization type team, legal_name, nif,
   billing_address jsonb, logo_url, public_slug FK public_handles.handle, description,
   specialties text[], payout_mode clinic|expert default expert, verification_status
   pending|verified|rejected, created_at),
   clinic_verifications (id, org_id, submitted_at, reviewed_by, reviewed_at, status, notes),
   bookings.attributed_org_id nullable (no expert_profiles.clinic_org_id — a clinic expert is a
   second expert_profiles row with org_id = clinic org, existing unique (user_id, org_id)),
   billing_subscriptions additions (seat_quantity, plan_key starter|growth|enterprise,
   current_period_end, cancel_at_period_end). RLS; audit unions per phase file.
2. Stripe: extend infra/stripe/seed-products.ts + seed-entitlements.ts with team plans (Starter
   99 EUR/mo base + 39 EUR/seat, Growth 199 + 29/seat, Enterprise contact) as one subscription with
   two items (base fixed, seat metered by quantity), features team.members, team.branding,
   team.reports; run pnpm stripe:seed and document ids in infra/stripe/README.md. Customer Portal
   configuration via infra/stripe/setup-portal.ts allows plan switch and quantity view only.
3. @eleva/billing: subscriptions.ts createTeamCheckoutSession(orgId, planKey) for Embedded
   Checkout (ui_mode embedded, return_url to apps/team billing), createPortalSession(orgId);
   provisioning.ts syncSeatQuantity(orgId) = count of clinic memberships (any role, owner included)
   whose user has >= 1 published event type in that clinic — the single seat rule. Implement it
   as a per-member join, never an org-level existence check: SELECT count(DISTINCT m.user_id)
   FROM auth.member m JOIN expert_profiles ep ON ep.org_id = m.organization_id AND ep.user_id =
   m.user_id JOIN event_types et ON et.expert_profile_id = ep.id AND et.org_id =
   m.organization_id AND et.published = true AND et.active = true WHERE m.organization_id =
   $orgId. This join is correct because a clinic expert's profile IS the expert_profiles row
   whose org_id is the clinic (unique (user_id, org_id)); the same user's solo-org profile and
   solo-org event types have a different org_id and are deliberately excluded (event_types is
   keyed by expert_profile_id — see packages/db/src/schema/main/{event-types,expert-profiles}.ts;
   a Drizzle query helper countBillableSeats(orgId) in @eleva/db owns the SQL and is the only
   implementation both Phase 3 and this phase call). Owner/admin accounts without their own
   published event types are free; tests: owner + 1 publishing member = 1 seat; owner with a
   published event type + 2 idle members = 1 seat; two publishing members = 2 seats; member with
   a published event type removed and re-added -> quantity drops to N-1 on removal and returns to
   N on afterAcceptInvitation without any publish; an expert with a solo org (published event
   types there) AND a clinic membership whose clinic profile has no published event type = 0 seats
   for the clinic, 1 seat once they publish a clinic event type. Called from event-type
   publish/unpublish AND
   from the Phase 3 organization hooks afterAddMember / afterAcceptInvitation / afterRemoveMember
   (keep them — do not narrow the triggers to publish events); update payments-payouts-spec.md (drop the "last 30 days" qualifier) and
   add the decision-log entry. Enforce seat caps per plan (Starter 5, Growth 20, Enterprise
   unlimited) at event-type publish time in the clinic context, concurrency-safe: inside the
   publish transaction SELECT ... FROM billing_subscriptions WHERE org_id = $orgId FOR UPDATE (the
   authoritative row — serialises concurrent publishes for one clinic), then run
   countBillableSeats(orgId) counting the publishing member as billable, and if it would exceed
   the plan cap roll back and return 409 SEAT_LIMIT_REACHED; a plain CHECK constraint cannot
   express this cross-table rule, so the lock + count IS the enforcement. Test: cap 5, four
   billable members, two idle members publish concurrently -> exactly one succeeds and one gets
   409 (with five billable members both must get 409 — test that too); the same rule drives the unit tests and the acceptance criteria. Webhooks (two-file contract): customer.subscription.created,
   customer.subscription.updated, customer.subscription.deleted, invoice.paid,
   invoice.payment_failed, invoice.finalized -> billing_subscriptions + emitDomainEvent; on
   invoice.finalized call @eleva/accounting issueClinicSaasInvoice (flag
   ff.toconline_invoicing_enabled). hasFeature(orgId, feature) reads Stripe Entitlements with
   cache.
4. Attribution: set bookings.attributed_org_id ONLY when the booking originates from the clinic
   surface — the canonical route /[locale]/[clinicSlug]/[expertUsername]/[eventSlug] (all
   apps/web routes are locale-prefixed; link generation, attribution parsing and the e2e test use
   exactly this shape) or a signed clinic attribution parameter issued by the clinic page and
   carried to the Phase 4 route /[locale]/[username]/[eventSlug] (validate the clinic is active, the expert is a current
   member of that clinic, and the parameter is not older than 24h). The expert's clinic
   membership alone NEVER sets attribution: a direct booking on
   /[locale]/[username]/[eventSlug] of a
   clinic-affiliated expert is a marketplace booking and pays the normal commission. Pass
   buyerContext { attributedOrgId } to computeApplicationFee -> 0 bps only for attributed
   bookings; add unit tests for both paths. Payout destination: resolve it exactly once in
   confirmBookingPayment when the payout_states row is created — expert's org + Connect account
   (payout_mode expert) or the clinic's (payout_mode clinic; requires clinic Connect onboarding —
   reuse Phase 6 flows for org accounts, and refuse to publish clinic event types while the clinic
   account is not chargeable) — and write it to the immutable Phase 6 snapshot columns
   destination_org_id / destination_connect_account_id; executeTransfer, refunds and
   reconciliation never re-read clinic_profiles.payout_mode. Test: flip payout_mode after payment
   -> transfer still goes to the snapshotted account.
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
8. apps/web: clinic public page at /[locale]/[clinicSlug] (profile + experts grid; the [handle]
   segment resolves via public_handles to expert or clinic) and the canonical clinic booking
   route /[locale]/[clinicSlug]/[expertUsername]/[eventSlug] with attribution; sitemap entries.
   Extend NOTIFICATION_KINDS with team.invitation (email mode — the invitee may have no
   account), team.member_joined, clinic.verified and clinic.rejected (owner-facing e-mail +
   in-app), each with template pt/en/es, channel policy and delivery test — the Phase 8 contract
   assigns all four to this phase; clinic.* are consumed by the Phase 12 verification queue.
   Every one of these (page, booking route, sitemap, attribution on reserve) is gated by
   ff.clinic_public_pages AND clinic_profiles.verification_status = 'verified'; pending/rejected
   -> 404 and no sitemap entry; tests for both gates.
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
