# Phase 12 — Admin console (`apps/admin`)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-12/admin-console` (split: `phase-12.1/admin-users-partners`, `phase-12.2/admin-money-ops`)                                                                                                                                                                                                                                                                                                                                                                          |
| Depends on | Phases 7, 10, 11                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Touches    | `apps/admin/**`, `apps/api/src/app/admin/**`, `packages/auth` (admin plugin usage, staff roles), `packages/db` (`become_partner_applications`, `admin_actions` views), `packages/dashboard` (admin nav), `packages/flags` (read view), `packages/observability`                                                                                                                                                                                                            |
| Exit gate  | Eleva staff (`platform_admin`, `staff_support`, `staff_finance`) can: manage users (search, ban, unban, reset 2FA, impersonate with audit), process the Become-Partner and clinic verification queues, approve/hold payouts, refund, inspect subscriptions, view accounting reconciliation and invoices, inspect Stripe webhook events and workflow DLQ with replay, search audit events by correlation id, view feature flags — every action audited and permission-gated |

## Why this phase exists

The user's requirement: "the UI console for admin ... all working as expected." Operations need
one place to run the marketplace. Better Auth's `admin` plugin provides user management primitives;
everything else composes the data endpoints built in Phases 6-11.

## Scope

In:

- **Access**: `admin.eleva.care` only for users with platform role in `admin` plugin
  (`platform_admin`, `staff_support`, `staff_finance`); `apps/admin/src/proxy.ts` optimistic check +
  server `requireStaff(role[])`; every admin API route under `apps/api/src/app/admin/*` with
  `requireApiAuth({ staffRoles })` and rate limits; all writes `withAudit({ actorUserId,
reason })` with a mandatory `reason` field on destructive actions.
- **Users**: search (email/name/id), detail (orgs, roles, sessions, 2FA/passkeys, bookings,
  payments), actions: ban/unban (`admin.banUser`), revoke sessions, disable 2FA, resend
  verification, **impersonate** (`admin.impersonateUser`, 1h, banner shown in the impersonated
  apps, audited start/stop, blocked for other staff), delete account (schedules Phase 5 flow).
- **Become-Partner queue**: `become_partner_applications` (from expert onboarding completion):
  review checklist (identity verified, Connect enabled, invoicing choice, profile quality, ERS
  compliance of bio), approve/reject with reason -> `expert_profiles.status`; clinic verification
  queue (Phase 11).
- **Experts & orgs**: list/filter, detail, edit categories/visibility, feature Top Expert override,
  commission override with expiry (Phase 6 field), suspend listing.
- **Bookings & sessions**: search, detail (payment, payout, session status, invoices), manual
  cancel with refund policy override (reason required).
- **Money**: payouts queue (`approval_required`, `held`, `failed`) with approve/hold/retry;
  refunds (full/partial) with reason; disputes list; subscriptions (teams) with Stripe links;
  accounting: Tier 1/Tier 2 invoices lists, failed invoice retries, reconciliation runs.
- **Ops**: `stripe_webhook_events` viewer (status, payload redacted, replay via
  `stripe:replay:event` equivalent endpoint), workflow DLQ (`workflow_dead_letters`) with replay,
  QStash schedules status (read via Upstash API), audit search (by correlation id, actor, entity)
  reading the audit Neon project through `@eleva/audit` read helpers, feature flags read view
  (`@eleva/flags`), system health (Neon, Redis, Stripe, Daily, Resend ping).
- **Content**: categories CRUD (`expert_categories`), reserved usernames view.
- UI: `@eleva/dashboard` shell with admin nav, data tables (`@eleva/ui` `DataTable` with server
  pagination), command palette for search, `enableOrgSwitcher: false`.
- Playwright `e2e/admin.spec.ts`.

Out: analytics dashboards (PostHog handles), CMS.

## Deliverables

1. Migrations: `become_partner_applications` (if not existing from expert onboarding), `admin_notes`,
   `impersonation_sessions` bookkeeping; audit unions (`admin: user_banned|user_unbanned|
sessions_revoked|impersonation_started|impersonation_ended|partner_approved|partner_rejected|
commission_override_set|listing_suspended|webhook_replayed|dlq_replayed|flag_viewed...`).
2. API `apps/api/src/app/admin/**` routes + OpenAPI (tagged `admin`, hidden from public docs
   unless staff) + client.
3. `apps/admin` pages, nav, proxy, messages `pt/en` (staff UI may be `en` + `pt`).
4. Impersonation banner component in `@eleva/dashboard` shown in all apps when
   `session.impersonatedBy` is set.
5. `e2e/admin.spec.ts`; playbooks updated.

## Acceptance criteria

- [ ] Non-staff user hitting `admin.eleva.care` -> redirected to gateway with 403 page; staff with
      `staff_support` cannot access money routes (403), `staff_finance` can.
- [ ] Ban user -> sessions revoked -> user cannot sign in; unban restores; both audited with reason.
- [ ] Impersonate -> banner visible in `apps/app`; actions performed carry `actorUserId = staff`
      and `impersonatedUserId` in audit; auto-expires in 1h; cannot impersonate staff.
- [ ] Become-Partner approve -> expert listed publicly within 1 min (cache tag revalidated);
      reject sends Lane 1 kind `partner.rejected` with reason.
- [ ] Payout approve/hold/retry, refund, dispute views work against Phase 6 endpoints; every action
      requires a reason and appears in audit search.
- [ ] Webhook event replay re-processes idempotently; DLQ replay succeeds/fails visibly.
- [ ] Audit search by correlation id returns the chain (API call -> domain writes -> notifications).
- [ ] Flags view shows current values per environment; no write path.
- [ ] `e2e/admin.spec.ts` green.

## Tests

- vitest: role matrix for every admin route (table-driven), impersonation guard, reason
  requirement, replay idempotency.
- Playwright: `admin.spec.ts` (login as seeded staff, approve a partner, approve a payout).

## Docs to update

- `admin-operator-playbooks.md` (one playbook per action), `support-escalation-matrix.md`,
  `identity-rbac-spec.md` (staff roles), `security-hardening-checklist.md` (impersonation
  controls), `decision-log.md`.

## Local references

- `apps/admin/src/**` (stub), `apps/expert/src/**` (dashboard patterns), `packages/dashboard/src/*`.
- `packages/auth/src/{server/auth.ts,permissions.ts}` (admin plugin config, staff roles),
  `packages/audit/src/**` (read helpers; add if missing), `packages/flags/src/**`,
  `packages/workflows/src/drainers/*`, `packages/billing/src/server/*` (Phase 6 endpoints),
  `packages/accounting` (Phase 7), `apps/api/src/app/{payouts,payments,invoicing,accounting}/**`.
- `docs/eleva-v3/admin-operator-playbooks.md`, `support-escalation-matrix.md`.
- MVP admin: `_context/clone-repo/eleva-care-app/src/app/api/admin/**`,
  `_context/clone-repo/eleva-care-app/src/app/[locale]/(private)/admin/**` (feature parity list).

## External docs

- Better Auth admin plugin `/better-auth/better-auth` (`banUser`, `impersonateUser`,
  `listUsers`, `revokeUserSessions`, `setRole`, `removeUser`, `stopImpersonating`).
- Upstash QStash REST (list schedules) `/upstash/qstash-js`.
- shadcn `DataTable` patterns (shadcn MCP `get_item_examples_from_registries`).

## Risks

- Impersonation misuse: require reason, 1h cap, banner, staff-on-staff blocked, weekly audit
  report (Phase 13 heartbeat).

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (better-auth, api-first-agentic, audit-wiring,
   stripe-webhooks, eleva-icons) and .cursor/skills/{better-auth,api-first-agentic,audit-wiring,
   coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/12-admin-console.md in full.
3. Read every file under "Local references" including the MVP admin routes for parity. Pull Better
   Auth admin plugin docs and QStash REST docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory; use the shadcn MCP for
   DataTable examples.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-12.1/admin-users-partners
  (second PR: phase-12.2/admin-money-ops). Each under 150 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review -> fix -> repeat. Conventional Commits. pnpm review:branch -> fix.
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 12 TASK — Build the Eleva staff admin console.

PR 12.1 — access, users, partners, experts, bookings:
1. Access model: apps/admin/src/proxy.ts (< 50 LOC) uses @eleva/auth/proxy optimistic check and
   redirects non-authenticated to account login with return-to; server layout calls
   requireStaff(["platform_admin","staff_support","staff_finance"]) from @eleva/auth/server
   (reads admin plugin role on the user); apps/api/src/lib/auth.ts requireApiAuth gains
   { staffRoles } option; helper adminRoute(handler, { roles, auditReason: true }) that enforces a
   non-empty reason string on POST/PATCH/DELETE bodies and wraps withAudit with actor + reason.
   Admin routes tagged "admin" in OpenAPI and hidden from the public docs listing unless the
   requester is staff.
2. Users: GET /admin/users?q&cursor (auth.api.listUsers), GET /admin/users/[id] (profile, orgs +
   roles, sessions, 2FA/passkeys flags, bookings summary, payments summary), POST
   /admin/users/[id]/ban { reason, expiresAt? } (auth.api.banUser + revokeUserSessions), POST
   /unban, POST /revoke-sessions, POST /disable-2fa, POST /resend-verification, POST /impersonate
   { reason } (auth.api.impersonateUser; refuse if target has a staff role; impersonation_sessions
   row; 1h), POST /stop-impersonating, POST /schedule-deletion. @eleva/dashboard:
   <ImpersonationBanner /> rendered in every app shell when session.impersonatedBy is set, with a
   Stop button calling the API.
3. Partners: become_partner_applications (id, expert_org_id, submitted_at, status pending|
   approved|rejected|needs_changes, checklist jsonb, reviewer_id, reviewed_at, reason) created on
   expert onboarding completion (update Phase 6/7 completion route). GET /admin/partners?status,
   GET /admin/partners/[id] (checklist computed: identity verified, Connect charges+payouts,
   invoicing choice, profile completeness, ERS bio check flags), POST /approve { reason } ->
   expert_profiles.status = active + revalidateTag("public-experts") + Lane 1 partner.approved,
   POST /reject { reason } -> Lane 1 partner.rejected, POST /needs-changes { reason, items }.
   Clinic verification queue: GET/POST /admin/clinics/verifications/[id]/approve|reject.
4. Experts & orgs: GET /admin/experts?q&status, GET /admin/organizations?q&type, PATCH
   /admin/experts/[orgId] { categories, visibility, topExpertOverride, commissionOverrideBps,
   commissionOverrideExpiresAt, reason }, POST /admin/experts/[orgId]/suspend|unsuspend { reason }.
   Categories CRUD /admin/categories. Bookings: GET /admin/bookings?q&status&from&to, GET
   /admin/bookings/[id] (payment, payout, session, invoices), POST /admin/bookings/[id]/cancel
   { reason, refundPolicy full|partial|none, amountCents? }.
5. apps/admin UI (@eleva/dashboard shell, enableOrgSwitcher false, nav: Overview, Users,
   Partners, Experts, Clinics, Bookings, Money, Accounting, Ops, Content, Flags): DataTable with
   server pagination/filters, detail drawers, action dialogs with mandatory reason, command
   palette (Cmd+K) searching users/experts/bookings. Messages en + pt.

PR 12.2 — money, accounting, ops, flags:
6. Money: pages and routes over Phase 6/7/11 endpoints: payouts queue (approval_required, held,
   failed) with approve/hold/retry; refunds dialog (full/partial, reason); disputes list;
   subscriptions (teams) with Stripe dashboard deep links (test/live aware). Roles: staff_finance
   and platform_admin only (table-driven test).
7. Accounting: Tier 1 invoices list + retry, Tier 2 invoices list (status per expert), failed
   invoices, reconciliation runs with mismatch details, CSV export (private Blob signed URL).
8. Ops: GET /admin/ops/stripe-events?status&type + POST /admin/ops/stripe-events/[id]/replay
   (re-run processStripeEvent; idempotent), GET /admin/ops/dlq + POST /replay, GET
   /admin/ops/schedules (QStash REST list, read-only), GET /admin/ops/audit?correlationId|actor|
   entity&from&to reading the audit Neon project via @eleva/audit read helpers (add
   packages/audit/src/read.ts if missing), GET /admin/ops/health (pings Neon main/audit, Redis,
   Stripe balance, Daily rooms list, Resend domains — each with timeout). UI pages accordingly;
   payloads redacted (no PHI; show keys only for record-related events).
9. Flags: GET /admin/flags read-only view from @eleva/flags (values per environment); link to
   Vercel dashboard for edits. Content: categories, reserved usernames view.
10. Tests: role matrix for every admin route (table-driven), impersonation guard (staff target ->
    403), reason enforcement (400 without reason), replay idempotency; e2e/admin.spec.ts: seeded
    platform_admin logs in, approves a pending partner, approves an approval_required payout,
    impersonates a member and sees the banner.
11. Docs: admin-operator-playbooks.md (one section per action with route + audit action names),
    support-escalation-matrix.md, identity-rbac-spec.md (staff roles), security-hardening-
    checklist.md (impersonation controls), decision-log.md.

Acceptance (paste evidence): non-staff blocked; role matrix tests; ban/unban; impersonation with
banner + audit + expiry + staff refusal; partner approve/reject with notifications and cache
revalidation; payouts/refunds/disputes/subscriptions actions audited with reasons; webhook and
DLQ replay; audit search by correlation id; flags read-only; e2e green.

Report: endpoints, migrations, tests, CodeRabbit CLI counts, PR URLs, deferred items.
```
