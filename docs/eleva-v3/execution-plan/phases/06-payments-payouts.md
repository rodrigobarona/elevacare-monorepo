# Phase 6 — Payments: Stripe Connect hardening, payout engine, refunds, schedules

| Field      | Value                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-06/payments-payouts` (split: `phase-06.1/connect-onboarding-hardening`, `phase-06.2/payout-engine-refunds`)                                                                                                                                                                                                  |
| Depends on | Phase 4                                                                                                                                                                                                                                                                                                             |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                             |
| Touches    | `packages/billing/**`, `packages/workflows/src/payments/**`, `packages/db/src/schema/main/{billing,booking-payments,payout-states}.ts`, `apps/api/src/app/{stripe,payments,payouts,workflows,webhooks}/**`, `infra/stripe/**`, `infra/qstash/**`, `apps/expert/**` (finance + onboarding), `packages/api-client/**` |
| Exit gate  | Pay -> confirm -> eligible -> transfer -> payout observable end to end in Stripe test mode with a pilot expert; refunds (full/partial) and disputes update ledger; every Stripe event in the two-file contract; expert Connect onboarding completes with Embedded Components and Identity                           |

## Why this phase exists

The user's requirement: "connect well with Stripe and make Stripe Connected accounts work
smoothly." The MVP has a working but inconsistent payout model (tiered commission ledger vs flat
15% fee). v3 must have one commission SSOT applied at charge time, a deterministic transfer
schedule, admin approval for edge cases, robust refunds/disputes, and a smooth expert onboarding.

## Scope

In:

- **Connect onboarding hardening** (`apps/expert` + `@eleva/billing`): Express account creation
  with `controller` settings per `payments-payouts-spec.md`, Embedded Components (Account
  Onboarding, Account Management, Payouts, Notification Banner) via Account Sessions, Stripe
  Identity verification step, requirements polling (`account.updated` webhook -> `billing_customers`/
  `expert_profiles.connect_status`), gating: an expert cannot publish event types until
  `charges_enabled && payouts_enabled && identity_verified`; clear status UI with next actions.
- **Funds flow (locked, shared with Phase 4)**: Stripe **separate charges and transfers**. The
  member's PaymentIntent is charged on the platform account (no `transfer_data`, no
  `application_fee_amount`); the platform fee lives in the ledger
  (`booking_payments.application_fee_cents`); the payout engine below creates one
  `stripe.transfers.create` of `amount - fee` per booking once eligible. Destination charges are
  rejected because they move funds at payment time and cannot express the delayed schedule; the
  MVP mixed both flows and this phase removes that ambiguity. Record the choice in
  `decision-log.md` and `payments-payouts-spec.md`.
- **Commission SSOT**: `packages/billing/src/server/commission.ts` is the only place computing
  the platform fee (`15%` default, `8%` Top Expert, `0%` clinic-member bookings); used by
  `POST /payments/intent` (Phase 4) and by reconciliation; store the applied rate on
  `booking_payments.applied_commission_bps`.
- **Payout engine** (port from MVP `process-expert-transfers`, `process-pending-payouts`,
  `check-upcoming-payouts`, `transfer-utils.ts`): `payout_states` table (booking_payment_id,
  status `pending|scheduled|approval_required|transferred|paid_out|failed|held|reversed`,
  `eligible_at`, `scheduled_for`, `transfer_idempotency_key` (uuid, set once), `stripe_transfer_id`,
  `stripe_payout_id`, `hold_reason`, `approved_by`, `approved_at`, attempts, last_error); eligibility = `max(paid_at + 7 days,
session_end + 24h)` snapped to 04:00 Europe/Lisbon; transfers use `transfer_group` and
  `source_transaction`; approval required when `amount_cents >= PAYOUT_APPROVAL_THRESHOLD_CENTS`
  (inclusive; default 50000; the single boundary rule used by the state machine, the prompt and
  the tests), first payout for an account,
  dispute open, or manual hold; retries with backoff and DLQ.
- **Workflows** (`packages/workflows/src/payments/*`, routes under `apps/api/src/app/workflows/*`,
  QStash schedules in `infra/qstash`): `process-expert-transfers` (every 2h),
  `process-pending-payouts` (06:00), `check-upcoming-payouts` (daily notice), `cleanup-expired-
reservations` (every 15 min, existing), `stripe-stuck-events` (existing).
- **Refunds and disputes**: `POST /payments/[bookingPaymentId]/refund` (admin or policy-driven;
  full or partial; refund the platform charge, `reverse_transfer: true` when a transfer was
  already made, and reduce the ledger fee proportionally — there is no Stripe application fee
  object in this funds flow);
  webhook handlers for `charge.refunded`, `charge.dispute.created/closed`, `transfer.created/
reversed`, `payout.paid/failed`, `account.updated`, `identity.verification_session.verified/
requires_input`, `payment_intent.succeeded/payment_failed/canceled` — all added to **both**
  `packages/billing/src/server/webhook.ts` and `infra/stripe/setup-webhooks.ts`.
- **Expert finance UI** (`apps/expert/[orgSlug]/finance`): earnings summary, per-booking table
  (gross, fee, net, state, eligible date), payouts (Embedded Payouts component), export CSV.
- **Admin hooks** (data only; UI in Phase 12): approval endpoint `POST /payouts/[id]/approve`,
  `POST /payouts/[id]/hold`, `GET /payouts?status=`.
- Stripe test clocks / fixtures for tests; `infra/stripe/README.md` updated.

Out: TOConline invoices (Phase 7), clinic SaaS billing (Phase 11), admin UI (Phase 12).

## Deliverables

1. Migration: `payout_states`, `booking_payments` additions (`applied_commission_bps`,
   `refunded_cents`, `dispute_status`), `billing_customers.connect_*` status fields; RLS + audit
   unions (`payout: scheduled|approval_required|approved|held|transferred|paid_out|failed|reversed`;
   `refund: requested|succeeded|failed`; `dispute: opened|closed`).
2. `@eleva/billing/server`: `commission.ts` (SSOT + tests), `payouts.ts` (eligibility, schedule,
   transfer, approval), `refunds.ts`, `connect.ts` updates (controller, requirements),
   `webhook.ts` handlers + tests, `identity.ts` updates.
3. `packages/workflows/src/payments/*` + `apps/api` workflow routes + `infra/qstash` setup
   scripts and root scripts (`qstash:setup:payouts`).
4. API routes: `/payments/[id]/refund`, `/payouts`, `/payouts/[id]/approve|hold`,
   `/stripe/account-session` (extend components), `/stripe/identity` (existing) — OpenAPI + client.
5. `apps/expert` onboarding gating + finance pages; messages `pt/en/es`.
6. `infra/stripe/setup-webhooks.ts` event list updated and applied to staging.

## Acceptance criteria

- [ ] New expert completes Connect onboarding + Identity in Embedded Components; `account.updated`
      flips `connect_status` and unlocks publishing.
- [ ] Test booking paid at T: `payout_states.eligible_at = max(T+7d, session_end+24h)` at 04:00
      Lisbon; `process-expert-transfers` creates a Stripe Transfer with `transfer_group`; payout
      appears in the expert's Embedded Payouts component; `payout.paid` marks `paid_out`.
- [ ] Refund before transfer: charge refunded, ledger fee reduced, state `reversed`; refund after
      transfer: `reverse_transfer` executed; ledger consistent; audit rows present.
- [ ] Dispute opened -> payout `held`; dispute closed won -> released; lost -> `reversed`.
- [ ] Approval-required path: first payout goes to `approval_required`; `POST /payouts/[id]/approve`
      schedules it; audited with actor.
- [ ] `WEBHOOK_EVENTS` in `infra/stripe/setup-webhooks.ts` equals the dispatcher switch cases
      (unit test asserting parity).
- [ ] Idempotency: replaying any webhook event (`pnpm stripe:replay:event`) does not double-transfer.
- [ ] Commission SSOT unit tests cover default, Top Expert, clinic member, grandfathered override.

## Tests

- vitest: commission, eligibility (DST + Lisbon snap), transfer idempotency (mock Stripe),
  refund paths, webhook parity test, state machine transitions.
- Integration on staging: Stripe test mode, one pilot expert, one full cycle with test clock
  where possible.

## Docs to update

- `payments-payouts-spec.md` (final state machine, thresholds), `integration-runbooks.md`
  (stuck transfer runbook), `infra/stripe/README.md`, `infra/qstash/README.md`,
  `admin-operator-playbooks.md` (approval/hold), `decision-log.md` (commission SSOT decision).

## Local references

- `packages/billing/src/server/*` (`commission.ts`, `connect.ts`, `account-session.ts`,
  `identity.ts`, `webhook.ts`, `subscriptions.ts`, `provisioning.ts`).
- `packages/workflows/src/drainers/stripe-stuck-events.ts` (pattern), `infra/qstash/*`,
  `infra/stripe/*`, `.cursor/rules/stripe-webhooks.mdc`, `.cursor/skills/stripe-webhooks/SKILL.md`.
- `apps/api/src/app/{stripe,webhooks/stripe,workflows}/**`, `apps/expert/src/app/**` (setup,
  finance).
- MVP: `_context/clone-repo/eleva-care-app/src/lib/integrations/stripe/transfer-utils.ts`,
  `src/app/api/cron/{process-expert-transfers,process-pending-payouts,check-upcoming-payouts}/route.ts`,
  `src/app/api/webhooks/stripe/handlers/payment.ts`, `src/lib/integrations/qstash/schedules.ts`,
  `drizzle/schema.ts` (`PaymentTransfersTable`, `TransactionCommissionsTable`).
- `docs/eleva-v3/payments-payouts-spec.md`, ADR-005, ADR-016.

## External docs

- Stripe `/websites/stripe`: Connect Express + controller properties, Account Sessions + Embedded
  Components (account_onboarding, account_management, payouts, notification_banner), Identity,
  separate charges and transfers (the chosen funds flow; read destination charges only to
  understand why they are rejected), `transfer_group`, `source_transaction`, refunds with
  `reverse_transfer`, disputes, payouts, test clocks,
  webhook best practices, idempotency.
- QStash `/upstash/qstash-js` (schedules, signature verification).
- `@stripe/connect-js` / `@stripe/react-connect-js` docs.

## Risks

- Transfer timing vs Stripe available balance: use `source_transaction` and handle
  `balance_insufficient` with retry.
- Double-transfer on retries: one stable idempotency key per transfer operation
  (`payout_states.transfer_idempotency_key`, generated once when the payout is scheduled and
  reused on every retry) — never key by attempt number, or a lost response followed by a retry
  creates a second transfer.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (stripe-webhooks, api-first-agentic, audit-wiring) and
   .cursor/skills/{stripe-webhooks,api-first-agentic,audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/06-payments-payouts.md in full.
3. Read every file under "Local references" including the MVP payout code. Pull Stripe docs
   (Connect Express controller, Account Sessions + Embedded Components, Identity, separate
   charges and transfers, refunds with reverse_transfer, disputes, payouts, test clocks) and QStash
   docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-06.1/connect-onboarding-hardening
  (second PR: phase-06.2/payout-engine-refunds). Each under 150 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean.
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 6 TASK — Make Stripe Connect smooth and build the payout engine.

PR 06.1 — Connect onboarding hardening:
1. @eleva/billing connect.ts: create Express accounts with controller settings from
   payments-payouts-spec.md (fees payer application, losses collector application, stripe dashboard
   type express), country from expert profile (PT first), business_type individual|company,
   capabilities card_payments + transfers; store account id + status fields on billing_customers
   (charges_enabled, payouts_enabled, details_submitted, requirements_currently_due jsonb,
   identity_status). account-session.ts: enable components account_onboarding,
   account_management, payouts, notification_banner, balances (read the current allow-list and
   extend). identity.ts: verification session creation + status mapping.
2. Webhook: add account.updated, identity.verification_session.verified,
   identity.verification_session.requires_input, capability.updated to BOTH
   packages/billing/src/server/webhook.ts and infra/stripe/setup-webhooks.ts (two-file contract);
   handlers update billing_customers inside withAudit; add the parity unit test that asserts the
   dispatcher's handled event set equals WEBHOOK_EVENTS.
3. apps/expert onboarding: step "Payments" renders Embedded Account Onboarding; step "Identity"
   renders the Identity flow; status page shows requirements due with plain-language next actions
   (pt/en/es). Gate: POST /experts/event-types/[id]/publish returns 409 CONNECT_INCOMPLETE until
   charges_enabled && payouts_enabled && identity verified; UI shows the reason.
4. Commission SSOT: packages/billing/src/server/commission.ts exports computeApplicationFee({
   amountCents, expertOrgId, buyerContext }) using expert plan tier (default 1500 bps, top_expert
   800 bps, clinic-member booking 0 bps, optional grandfathered override stored on
   billing_customers.commission_override_bps with expiry). Store applied bps on
   booking_payments.applied_commission_bps at intent creation (update Phase 4 route). Tests.

PR 06.2 — payout engine, refunds, disputes, finance UI:
5. packages/db: payout_states (id, booking_payment_id unique, expert_org_id, status enum
   pending|scheduled|approval_required|transferred|paid_out|failed|held|reversed, eligible_at,
   scheduled_for, amount_cents, transfer_idempotency_key uuid not null default gen_random_uuid(),
   stripe_transfer_id, stripe_payout_id, hold_reason, approved_by,
   approved_at, attempts, last_error, created_at, updated_at); booking_payments additions
   refunded_cents, dispute_status, stripe_charge_id; RLS (expert org read; API writes); audit
   unions per the phase file.
6. @eleva/billing payouts.ts: computeEligibleAt(paidAt, sessionEnd) = max(paidAt+7d,
   sessionEnd+24h) snapped to next 04:00 Europe/Lisbon (use Temporal polyfill or date-fns-tz;
   tests for DST); schedulePayout(bookingPaymentId) (approval_required when: first payout of the
   account, amount_cents >= PAYOUT_APPROVAL_THRESHOLD_CENTS env (default 50000; inclusive — add a
   unit test at exactly the threshold), open dispute, manual hold); executeTransfer(payoutStateId) creating stripe.transfers.create({ amount, currency,
   destination, transfer_group: bookingId, source_transaction: chargeId, metadata },
   { idempotencyKey: payoutState.transfer_idempotency_key }) — a UUID column written once when
   the row enters scheduled and reused on every retry (Stripe returns the original transfer for
   the same key), so a lost response can never produce a second transfer; a new key is only
   minted by an admin action after a reversed transfer; test: two calls with a simulated lost
   response yield one transfer — with retry/backoff and DLQ table
   workflow_dead_letters (reuse if exists); refunds.ts: refundBookingPayment({ id, amountCents?,
   reason }) refunding the platform charge, with reverse_transfer true when a transfer exists and
   the ledger fee reduced proportionally (no application fee object exists in this funds flow);
   dispute handling sets held / reversed.
7. Webhook handlers (two-file contract, idempotent, withAudit): payment_intent.succeeded (also
   creates payout_states pending), payment_intent.payment_failed, payment_intent.canceled,
   charge.refunded, charge.dispute.created, charge.dispute.closed, transfer.created,
   transfer.reversed, payout.paid, payout.failed. Re-run pnpm stripe:setup:webhooks -- --url
   <staging url> --apply and record the endpoint id in infra/stripe/README.md.
8. Workflows: packages/workflows/src/payments/{process-expert-transfers,process-pending-payouts,
   check-upcoming-payouts}.ts and routes apps/api/src/app/workflows/<name>/route.ts verifying the
   QStash signature; infra/qstash/setup-payouts.ts registering schedules (transfers every 2h,
   pending payouts 06:00 Europe/Lisbon, upcoming payouts daily 08:00) + root script
   qstash:setup:payouts and inclusion in setup:all. Each step idempotent.
9. apps/api: POST /payments/[bookingPaymentId]/refund (capability billing:refund or
   admin_payouts:*), GET /payouts?status&orgId (expert sees own; staff see all), POST /payouts/
   [id]/approve, POST /payouts/[id]/hold ({ reason }), GET /me/finance/summary for experts.
   OpenAPI + @eleva/api-client.
10. apps/expert /[orgSlug]/finance: summary cards (gross, fees, net, pending, paid), bookings
    table with payout state + eligible date, Embedded Payouts component, CSV export (server
    action -> API). Messages pt/en/es.
11. Tests: eligibility incl. DST, schedule/approval rules, transfer idempotency with mocked
    Stripe, refund before/after transfer, dispute transitions, webhook parity, replay safety
    using pnpm stripe:replay:event on staging.
12. Docs: payments-payouts-spec.md state machine + thresholds, integration-runbooks.md (stuck
    transfer, failed payout), admin-operator-playbooks.md (approve/hold), infra/stripe/README.md,
    infra/qstash/README.md, decision-log.md (commission SSOT).

Acceptance (paste evidence): expert completes Connect + Identity and publishing unlocks; full
cycle pay -> eligible -> transfer -> payout in test mode; refund before/after transfer; dispute
hold/release; approval path audited; parity test; replay does not double-transfer; commission
tests.

Report: migrations, endpoints, schedules registered, webhook endpoint id, tests, CodeRabbit CLI
counts, PR URLs, deferred items.
```
