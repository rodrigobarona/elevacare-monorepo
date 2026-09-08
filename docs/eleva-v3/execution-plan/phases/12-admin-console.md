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
- **Step-up authentication (P1)**: every staff session must have 2FA (TOTP or passkey) enrolled
  — `requireStaff` refuses otherwise — and every `[R]` route additionally requires a **fresh
  step-up** (passkey or TOTP re-verification within the last 10 minutes, tracked as
  `session.stepUpAt` via the Better Auth `twoFactor`/`passkey` plugins); the admin UI prompts
  inline. Staff sessions expire after 12 h idle, are bound to the `admin.eleva.care` host only,
  and IP/user-agent changes force re-authentication.
- **Dual control (P1)** for the irreversible money and identity actions: refunds above
  `ADMIN_DUAL_CONTROL_REFUND_CENTS` (default 200 EUR), payout release from `held`, commission
  override, partner approval of a clinical specialty, ban of an expert with future bookings, and
  **break-glass decrypt** of a record. Each is a two-step `admin_action_requests` row
  (`requested_by`, `approved_by` must differ, `expires_at` 24 h, `status
pending|executing|approved|rejected|expired|executed`); the second staff member approves from a queue,
  execution happens on approval inside `withAudit` with both actors; a single `platform_admin`
  cannot self-approve. Everything else stays single-actor with reason.
- **Users**: search (email/name/id), detail (orgs, roles, sessions, 2FA/passkeys, bookings,
  payments), actions: ban/unban (`admin.banUser`), revoke sessions, disable 2FA, resend
  verification, **impersonate** (`admin.impersonateUser`, 1h, banner shown in the impersonated
  apps, audited start/stop, blocked for other staff), delete account (schedules Phase 5 flow).
- **Become-Partner queue**: `become_partner_applications` (from expert onboarding completion):
  review checklist (Connect KYC complete — `details_submitted` + `payouts_enabled` + `transfers` active (D-05); Stripe Identity only if `ff.expert_identity_verification` is on —, invoicing choice, profile quality, ERS
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

1. Migrations: `admin_notes`, `impersonation_sessions`, `admin_action_requests` (dual control)
   bookkeeping — `become_partner_applications` **already exists from Phase 4B** with its reviewer
   columns (`reviewer_id`, `reviewed_at`, `reason`); this phase adds no columns to it; audit unions (`admin: user_banned|user_unbanned|
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
- [ ] Ban user -> sessions revoked -> user cannot sign in; unban restores; both audited with
      actor, target and route — ban with a mandatory reason (`[R]`), unban with an optional one
      (`[O]`), matching the `adminRoute` reason policy in the implementation prompt.
- [ ] Impersonate -> banner visible in `apps/app`; actions performed carry `actorUserId = staff`
      and `impersonatedUserId` in audit; auto-expires in 1h; cannot impersonate staff.
- [ ] Become-Partner approve -> expert listed publicly within 1 min (cache tag revalidated);
      reject sends Lane 1 kind `partner.rejected` with reason.
- [ ] Payout approve/hold/retry, refund, dispute views work against Phase 6 endpoints; every action
      requires a reason and appears in audit search.
- [ ] Webhook event replay re-processes idempotently; DLQ replay succeeds/fails visibly.
- [ ] Staff user without 2FA cannot open the console; `[R]` route without a fresh step-up -> 401
      `STEP_UP_REQUIRED`; after passkey re-verification the same call succeeds (test).
- [ ] Dual-control action requested by A cannot be approved by A (403); approved by B executes
      once with both actors in audit; expired request cannot be approved.
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
- Single compromised staff account: step-up + dual control bound the blast radius to non-money,
  non-identity actions; Phase 13 verifies, it does not introduce, these controls.

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

Workflow (mandatory) — this is the outer loop; the "PHASE 12 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-12.1/admin-users-partners
- Second PR (opened after the first merges): phase-12.2/admin-money-ops. Each PR: <= 30 files / 400 lines where possible; split above 60 / 800 and always before 100 reviewable files.
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

PHASE 12 TASK — Build the Eleva staff admin console.

PR 12.1 — access, users, partners, experts, bookings:
1. Access model: apps/admin/src/proxy.ts (< 50 LOC) uses @eleva/auth/proxy optimistic check and
   redirects non-authenticated to account login with return-to; server layout calls
   requireStaff(["platform_admin","staff_support","staff_finance"]) from @eleva/auth/server
   (reads admin plugin role on the user); apps/api/src/lib/auth.ts requireApiAuth gains
   { staffRoles } option; helper adminRoute(handler, { roles, reason: "required" | "optional" })
   that wraps withAudit with actor (+ impersonation context) and reason; reason: "required" rejects (400) any
   POST/PATCH/DELETE without a non-empty reason and is used by every destructive or
   member-affecting write (ban, impersonate, schedule-deletion, approve/reject/needs-changes,
   commission override, suspend/unsuspend, cancel booking, refund, payout
   approve/hold/release/retry, clinic verification approve/reject, Tier 1 invoice retry);
   reason: "optional" is used by the low-impact writes (unban, revoke-sessions, disable-2fa,
   resend-verification, stop-impersonating) which still audit actor, target and route as
   metadata. The route list below marks each with [R] or [O] and the UI dialogs follow the same
   split (reason field mandatory vs optional).
   Step-up: requireStaff refuses sessions without an enrolled second factor (twoFactor or
   passkey); adminRoute({ stepUp: true }) — set on every [R] route — requires session.stepUpAt
   within 10 min else 401 STEP_UP_REQUIRED; the admin shell catches it and opens the passkey/TOTP
   re-verify dialog then retries. Staff sessions: 12 h idle expiry, cookie scoped to
   admin.eleva.care (not .eleva.care), re-auth on IP or UA change. Dual control:
   admin_action_requests (id, kind, target, payload jsonb, requested_by, approved_by nullable,
   status pending|executing|approved|rejected|expired|executed, reason, created_at, expires_at 24h,
   claimed_at nullable, claim_token uuid nullable, claim_seq int default 0,
   executed_at) with adminRoute({ dualControl: true }) creating the request instead of
   executing; POST /admin/action-requests/[id]/approve [R, stepUp] first CLAIMS the request atomically —
   UPDATE admin_action_requests SET status = 'executing', approved_by = $actor, claimed_at = now(),
   claim_token = gen_random_uuid(), claim_seq = claim_seq + 1
   WHERE id = $id AND status = 'pending' AND expires_at > now() AND requested_by <> $actor
   RETURNING * — and only the caller that gets a row executes the side effect inside withAudit
   with both actors, passing claim_token as the vendor idempotency key suffix ("admin-action:" +
   id + ":" + claim_seq), then completes with UPDATE ... SET status = 'executed', executed_at =
   now() WHERE id = $id AND claim_token = $token (a stale worker whose token no longer matches gets
   zero rows, logs admin.action_request.stale_completion and must NOT retry the side effect);
   zero rows on claim -> 409 ALREADY_CLAIMED (or 403 when requested_by = actor, 410 when expired).
   Recovery: an 'executing' row older than 10 min with no executed_at is NOT blindly reopened —
   the sweep first reconciles with the provider for money kinds (stripe.refunds.list / transfers
   by the idempotency key of the current claim_seq: if the side effect exists, mark 'executed'
   and alert; only if it provably does not exist flip to 'pending' with a new claim_seq so the
   next approval uses a fresh idempotency key that cannot collide with the in-flight one) and for
   non-money kinds (ban, decrypt, override) the side effect is idempotent by request id and may
   be reopened directly. Tests: two concurrent approvals -> one executes, one 409; stale worker
   completion after sweep -> zero rows, no second side effect; timed-out claim with the refund
   already at Stripe -> reconciled to 'executed' with exactly one refund; kinds: refund above
   ADMIN_DUAL_CONTROL_REFUND_CENTS (default 20000), payout release from held, commission
   override, partner approval for a clinical specialty, ban expert with future bookings,
   break-glass record decrypt (the only path that lets staff read body_encrypted; audited
   record: decrypted with purpose "break_glass" and both actors).
   Route -> dual-control kind map (SSOT in packages/auth/src/admin-actions.ts, imported by
   adminRoute and by the tests; one test per row asserting single-actor attempt -> 202 request
   row and NO side effect, dual approval -> exactly one side effect):
   | route | condition | kind |
   | POST /admin/payments/[id]/refund | amount_cents > ADMIN_DUAL_CONTROL_REFUND_CENTS | payment.refund_large |
   | POST /admin/payouts/[id]/release | payout_states.status = held | payout.release |
   | PATCH /admin/experts/[id]/commission | always | expert.commission_override |
   | POST /admin/partners/[id]/approve | SPECIALTIES[slug].clinical = true | partner.approve_clinical |
   | POST /admin/experts/[id]/ban | exists booking with start_at > now() | expert.ban_with_future_bookings |
   | POST /admin/records/[id]/decrypt | always | record.break_glass_decrypt |
   Any other admin mutation is single-actor with a mandatory reason; adding a kind requires a
   row here, a test and an audit-union entry. Admin routes tagged "admin" in OpenAPI and hidden
   from the public docs listing unless the requester is staff.
2. Users: GET /admin/users?q&cursor (auth.api.listUsers), GET /admin/users/[id] (profile, orgs +
   roles, sessions, 2FA/passkeys flags, bookings summary, payments summary), POST
   /admin/users/[id]/ban [R] { reason, expiresAt? } (auth.api.banUser + revokeUserSessions),
   POST /unban [O], POST /revoke-sessions [O], POST /disable-2fa [O], POST /resend-verification
   [O], POST /impersonate [R] { reason } (auth.api.impersonateUser; refuse if target has a staff
   role; impersonation_sessions row; 1h), POST /stop-impersonating [O], POST /schedule-deletion
   [R] { reason }. @eleva/dashboard:
   <ImpersonationBanner /> rendered in every app shell when session.impersonatedBy is set, with a
   Stop button calling the API.
3. Partners: become_partner_applications exists since Phase 4B (id, expert_org_id, submitted_at,
   status pending|approved|rejected|needs_changes, checklist jsonb, reviewer_id, reviewed_at,
   reason) — this phase adds no columns; rows are created by the Phase 4B onboarding
   completion route, never by this phase. GET /admin/partners?status,
   GET /admin/partners/[id] (checklist computed: Connect details_submitted + payouts_enabled +
   capabilities.transfers active (D-05; Stripe Identity status only when
   ff.expert_identity_verification is on),
   invoicing choice, profile completeness, ERS bio check flags), POST /approve [R, stepUp]
   { reason } — TWO paths by the application's specialty class (packages/config
   SPECIALTIES[slug].clinical boolean, SSOT): non-clinical -> executes directly:
   expert_profiles.status = active + revalidateTag("public-experts") + Lane 1 partner.approved;
   clinical (any ERS-regulated specialty) -> adminRoute({ dualControl: true }) creates an
   admin_action_requests row of kind partner.approve_clinical and returns 202 { requestId } —
   the same side effect runs only from the dual-control approve endpoint (item 1) with both
   actors in the audit event; tests cover both paths and assert a clinical application can never
   reach status = active with a single actor,
   POST /reject [R] { reason } -> Lane 1 partner.rejected, POST /needs-changes [R] { reason,
   items }.
   Clinic verification queue: GET /admin/clinics/verifications, POST
   /admin/clinics/verifications/[id]/approve [R] { reason } (sets verification_status verified +
   revalidates the clinic page; Lane 1 kind clinic.verified), POST .../reject [R] { reason }
   (Lane 1 kind clinic.rejected with reason) — both kinds are registered by Phase 11 in
   NOTIFICATION_KINDS (template, channel policy, i18n copy, delivery test). Missing-reason test for every [R] route in this phase (table-driven over the route
   list: ban, impersonate, schedule-deletion, approve/reject/needs-changes, commission override,
   suspend/unsuspend, cancel booking, refund, payout approve/hold/release/retry, clinic
   approve/reject, invoice retry -> 400 REASON_REQUIRED).
4. Experts & orgs: GET /admin/experts?q&status, GET /admin/organizations?q&type, PATCH
   /admin/experts/[orgId] [R] { categories, visibility, topExpertOverride, commissionOverrideBps,
   commissionOverrideExpiresAt, reason }, POST /admin/experts/[orgId]/suspend [R] and
   /unsuspend [R] { reason }. Categories CRUD /admin/categories [O]. Bookings: GET
   /admin/bookings?q&status&from&to, GET /admin/bookings/[id] (payment, payout, session,
   invoices), POST /admin/bookings/[id]/cancel [R] { reason, refundPolicy full|partial|none,
   amountCents? }. The [R]/[O] markers in this list ARE the policy: implement them as one
   exported ADMIN_ROUTE_POLICY table in apps/api (path pattern -> "required" | "optional"),
   have adminRoute read its reason mode from that table (a route missing from the table fails
   at startup), and drive the missing-reason test from the same table so the route list, the
   handler policy and the tests cannot drift.
5. apps/admin UI (@eleva/dashboard shell, enableOrgSwitcher false, nav: Overview, Users,
   Partners, Experts, Clinics, Bookings, Money, Accounting, Ops, Content, Flags): DataTable with
   server pagination/filters, detail drawers, action dialogs with mandatory reason, command
   palette (Cmd+K) searching users/experts/bookings. Messages en + pt.

PR 12.2 — money, accounting, ops, flags:
6. Money: pages and routes over Phase 6/7/11 endpoints: payouts queue (approval_required, held,
   failed) with approve/hold/release/retry — POST /admin/payouts/[id]/approve [R], /hold [R],
   /release [R] (removes the manual hold reason; the row leaves held only when no dispute hold
   remains — the response reports the remaining reasons), /retry [R]
   { reason } (retry re-uses the existing transfer_idempotency_key — Stripe returns the original
   transfer for the same key, so a lost response can never double-transfer; a NEW key is minted
   only in the Phase 6 case, after a confirmed reversed transfer, or when the route first
   reconciles with `stripe.transfers.list({ transfer_group: bookingId })` and proves no transfer
   exists for that payout — a failed state alone never mints a key; test both branches);
   refunds dialog (full/partial, reason) [R]; disputes list;
   subscriptions (teams) with Stripe dashboard deep links (test/live aware). Roles: staff_finance
   and platform_admin only (table-driven test).
7. Accounting: Tier 1 invoices list + retry (POST /admin/invoices/[id]/retry [R] { reason }),
   Tier 2 invoices list (status per expert), failed
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
    403), reason enforcement (400 without reason), step-up (401 then 200 after re-verify),
    dual control (self-approve 403, expired 409, executes once), replay idempotency;
    e2e/admin.spec.ts: seeded
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
