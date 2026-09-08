# Phase 6 — Payments: Stripe Connect hardening, payout engine, refunds, schedules

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-06/payments-payouts` (split: `phase-06.0/spike-stripe-funds-flow`, `phase-06.1/connect-onboarding-hardening`, `phase-06.2/payout-engine-refunds`)                                                                                                                                                                                                                                                  |
| Depends on | Phase 4, Phase 4B (onboarding wizard registry)                                                                                                                                                                                                                                                                                                                                                            |
| Entry gate | Before PR 06.1 opens, finance has approved in `decision-log.md`: the settlement matrix (D-03 VAT basis of the commission, D-04 processing-fee bearer for marketplace and clinic bookings) and the Connect capability/verification requirement (D-05). Before PR 06.2 opens: the refund, dispute and no-show policy (D-06). PR 06.0 (spike, test mode) produces the evidence those approvals are based on. |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                                                                                                   |
| Touches    | `packages/billing/**`, `packages/workflows/src/payments/**`, `packages/db/src/schema/main/{billing,booking-payments,payout-states}.ts`, `apps/api/src/app/{stripe,payments,payouts,workflows,webhooks}/**`, `infra/stripe/**`, `infra/qstash/**`, `apps/expert/**` (finance + onboarding), `packages/api-client/**`                                                                                       |
| Exit gate  | Pay -> confirm -> eligible -> transfer -> payout observable end to end in Stripe test mode with a pilot expert; refunds (full/partial) and disputes update ledger; every Stripe event in the two-file contract (platform + Connect endpoints); expert Connect onboarding completes with Embedded Components                                                                                               |

## Why this phase exists

The user's requirement: "connect well with Stripe and make Stripe Connected accounts work
smoothly." The MVP has a working but inconsistent payout model (tiered commission ledger vs flat
15% fee). v3 must have one commission SSOT applied at charge time, a deterministic transfer
schedule, admin approval for edge cases, robust refunds/disputes, and a smooth expert onboarding.

## Scope

In:

- **Connect onboarding hardening** (`apps/expert` + `@eleva/billing`): Express account creation
  with `controller` settings per `payments-payouts-spec.md`, Embedded Components (Account
  Onboarding, Account Management, Payouts, Notification Banner) via Account Sessions,
  requirements polling (`account.updated` webhook -> `billing_customers`/
  `expert_profiles.connect_status`). **Capabilities (D-05, working decision pending Stripe/legal
  confirmation in PR 06.0)**: with separate charges and transfers the connected account only
  **receives transfers**, so request the `transfers` capability only — no `card_payments`, so
  `charges_enabled` is irrelevant and never gates anything; Connect's own KYC is the identity
  check. Gating: an expert cannot publish event types until `details_submitted &&
payouts_enabled && capabilities.transfers = active`. Stripe Identity stays implemented behind
  `ff.expert_identity_verification` (default **off**) for the case legal requires a second
  verification for clinical experts; it is not part of the launch gate. Clear status UI with next
  actions.
- **Funds flow (locked, shared with Phase 4)**: Stripe **separate charges and transfers**. The
  member's PaymentIntent is charged on the platform account (no `transfer_data`, no
  `application_fee_amount`); the platform fee lives in the ledger
  (`booking_payments.application_fee_cents`); the payout engine below creates one
  `stripe.transfers.create` of `amount - fee` per booking once eligible. Destination charges are
  rejected because they move funds at payment time and cannot express the delayed schedule; the
  MVP mixed both flows and this phase removes that ambiguity. Record the choice in
  `decision-log.md` and `payments-payouts-spec.md`.
- **Commission SSOT and settlement matrix**: `packages/billing/src/server/commission.ts` is the
  only place computing money splits. `computeSettlement({ grossCents, commissionBps, vatRateBps,
vatTreatment, processingFeeCents, feeBearer })` returns the **financial calculation contract**
  (D-03/D-04, accountant-approved before PR 06.1): `bookingGross`, `platformFeeGross` (the
  advertised commission — `15%` default, `8%` Top Expert, `0%` clinic-member bookings — is
  **VAT-inclusive**: the expert always nets what the marketing says, so 100 EUR -> fee gross
  15.00 -> expert transfer 85.00), `platformFeeNet` and `vatOnPlatformFee` derived from the
  Phase 7 IVA matrix (PT B2B: 15.00 = 12.20 net + 2.80 IVA; intra-EU reverse charge: 15.00 net,
  0 IVA), `paymentProcessingFee` (Stripe's actual `balance_transaction.fee`), `expertTransfer`
  (= gross − fee gross for marketplace bookings, Eleva absorbs processing out of its fee; = gross
  − processing fee for clinic `0%` bookings, the clinic bears processing — working default for
  D-04), `creditNoteAllocation` (proportional on partial refunds), rounding (half-up on cents,
  applied once, on the fee), `currency` (`EUR`). Every amount the ledger, the transfer, the
  Tier 1 invoice and the expert finance UI show comes from this one function; store
  `applied_commission_bps`, `platform_fee_net_cents`, `platform_fee_vat_cents`,
  `processing_fee_cents` on `booking_payments`.
- **Payout engine** (port from MVP `process-expert-transfers`, `process-pending-payouts`,
  `check-upcoming-payouts`, `transfer-utils.ts`): `payout_states` table (booking_payment_id,
  status `pending|scheduled|approval_required|transferred|paid_out|failed|held|reversal_pending|reversed` (this
  union is the SSOT — `payments-payouts-spec.md` "Payout States" is rewritten to it in this
  phase), `hold_reasons text[]` (set semantics, values `dispute|manual`; a hold ADDS its reason,
  a dispute won or a staff release REMOVES its reason, and only when the set becomes empty does
  the row leave `held`) + `held_from_status` (the status the row had when the FIRST reason was
  added; restored when the set empties, then cleared; there is no separate `released` state;
  tests apply dispute-then-manual and manual-then-dispute and assert the payout stays `held`
  until both are cleared),
  `eligible_at`, `scheduled_for`, `destination_org_id` + `destination_connect_account_id`
  (immutable snapshot written when the row is created — the expert's org/account in this phase;
  Phase 11 writes the clinic's when `payout_mode = clinic`; transfers, refunds, reconciliation
  and retries read **only** this snapshot, never the current profile settings),
  `transfer_idempotency_key` (uuid, set once), `stripe_transfer_id`,
  `stripe_payout_id`, `approved_by`, `approved_at`, attempts, last_error — plus the
  `hold_reasons` / `held_from_status` pair defined above); eligibility = `max(paid_at + 7 days,
session_end + 24h)` snapped to 04:00 Europe/Lisbon; transfers use `transfer_group` and
  `source_transaction`; approval required when `amount_cents >= PAYOUT_APPROVAL_THRESHOLD_CENTS`
  (inclusive; default 50000; the single boundary rule used by the state machine, the prompt and
  the tests) or first payout for an account — those are the only two `approval_required`
  reasons; an open dispute or a manual hold puts the row in `held` (with `held_from_status`),
  never in `approval_required`, and `approve` on a row whose payment has `dispute_status =
  open` is refused with 409 DISPUTE_OPEN; retries with backoff and DLQ.
- **Workflows** (`packages/workflows/src/payments/*`, routes under `apps/api/src/app/workflows/*`,
  QStash schedules in `infra/qstash`): `process-expert-transfers` (every 2h),
  `process-pending-payouts` (06:00), `check-upcoming-payouts` (daily notice), `cleanup-expired-
reservations` (every 15 min, existing), `stripe-stuck-events` (existing).
- **Refunds and disputes (P0-1 corrected)**: `POST /payments/[bookingPaymentId]/refund` (admin or
  policy-driven; full or partial). With separate charges and transfers a refund and a transfer
  reversal are **two Stripe operations with two ledger states**, never one `reverse_transfer`
  flag (that belongs to destination charges): (1) `stripe.refunds.create({ payment_intent, amount
  }, { idempotencyKey: refund:<bookingPaymentId>:<n> })` -> `refunds` row `succeeded|failed`;
  (2) if `payout_states.stripe_transfer_id` exists, `stripe.transfers.createReversal(transferId,
  { amount: proportional share, metadata })` with its own idempotency key -> `transfer_reversals`
  row; partial refunds reverse a **cumulative** share — `round(refundedToDate / gross *
  transferred) - reversedToDate` — so repeated partials never leave residual cents or exceed
  the transfer, a full refund reverses exactly the remainder, and `CHECK (reversed_cents <=
  amount_cents)` on `payout_states` enforces it (test: 33.33 + 33.33 + 33.34 on 100.00 /
  85.00 -> 28.33 + 28.33 + 28.34, cumulative 85.00; 3 x 33.33 alone -> 84.99 and the last
  0.01 is reversed only if the remaining 0.01 is refunded); a refund that succeeds while the
  reversal fails (`balance_insufficient` on the connected account, network) leaves the payout in
  `reversal_pending` with retries + alert and is reconciled by `transfer.reversed` — the member
  is never made to wait on the expert's balance; a reversal never mints a new
  `transfer_idempotency_key`; the Tier 1 credit note (Phase 7) is issued from the **completed**
  refund, not from the request; ledger fee reduced by `computeSettlement` on the refunded amount
  (there is no Stripe application fee object in this funds flow);
  webhook handlers for `charge.refunded`, `charge.dispute.created/closed`, `transfer.created/
reversed`, `payout.paid/failed`, `account.updated`, `capability.updated`,
  `identity.verification_session.verified/requires_input`,
  `payment_intent.succeeded/payment_failed/canceled` — all added to **both**
  `packages/billing/src/server/webhook.ts` and `infra/stripe/setup-webhooks.ts`.
- **Expert finance UI** (`apps/expert/[orgSlug]/finance`): earnings summary, per-booking table
  (gross, fee, net, state, eligible date), payouts (Embedded Payouts component), export CSV.
- **Admin hooks** (data only; UI in Phase 12): approval endpoint `POST /payouts/[id]/approve`,
  `POST /payouts/[id]/hold` (adds `manual` to `hold_reasons`), `POST /payouts/[id]/release`
  (staff-only; removes `manual`; the row returns to `held_from_status` only if no other reason
  remains — with an open dispute it stays `held` and the response says so; audited
  `payout: released`), `GET /payouts?status=`.
- Stripe test clocks / fixtures for tests; `infra/stripe/README.md` updated.

Out: TOConline invoices (Phase 7), clinic SaaS billing (Phase 11), admin UI (Phase 12).

## Deliverables

1. Migration: `payout_states`, `booking_payments` additions (`applied_commission_bps`,
   `refunded_cents`, `dispute_status`), `billing_customers.connect_*` status fields; RLS + audit
   unions (`payout: scheduled|approval_required|approved|held|released|transferred|paid_out|failed|reversed`;
   `refund: requested|succeeded|failed`; `dispute: opened|closed`); `billing_customers`
   Connect capability columns (`connect_capabilities` jsonb — card_payments/transfers status —
   written by the `capability.updated` handler) and the parity acceptance criterion below covers
   that event.
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

- [ ] New expert completes Connect onboarding in Embedded Components; `account.updated` /
      `capability.updated` flip `connect_status` and unlock publishing only when
      `details_submitted && payouts_enabled && capabilities.transfers === "active"` (and, when
      `ff.expert_identity_verification` is on, Identity `verified`) — the same predicate as the
      Scope and the prompt, tested with each term false in turn; no `card_payments` capability is
      requested.
- [ ] PR 06.0 spike report committed under `docs/eleva-v3/spikes/06-stripe-funds-flow.md`: test-mode
      evidence for platform PaymentIntent, delayed transfer with `source_transaction`, full +
      partial refund, transfer reversal, dispute hold, connected-account webhooks, clinic 0% flow.
- [ ] Test booking paid at T: `payout_states.eligible_at = max(T+7d, session_end+24h)` at 04:00
      Lisbon; `process-expert-transfers` creates a Stripe Transfer with `transfer_group`; payout
      appears in the expert's Embedded Payouts component; `payout.paid` marks `paid_out`.
- [ ] Refund before transfer: charge refunded, ledger fee reduced, state `reversed`; refund after
      transfer: `refunds.create` **then** `transfers.createReversal` as two audited steps;
      partial refund reverses the proportional share; simulated reversal failure leaves
      `reversal_pending` with an alert and is closed by `transfer.reversed`; ledger consistent.
- [ ] `computeSettlement` unit tests reproduce the approved matrix row by row (100 EUR PT B2B,
      intra-EU reverse charge, Top Expert, clinic 0% with processing fee, partial refund).
- [ ] Connect webhook endpoint (`connect: true`) receives `payout.paid|failed`, `account.updated`,
      `capability.updated` from connected accounts; parity test covers both endpoints.
- [ ] Dispute opened -> payout `held`, `hold_reasons = {dispute}`, `held_from_status` recorded;
      dispute closed won -> `dispute` removed and, if the set is empty, status restored to
      `held_from_status` (e.g. back to `scheduled`, or `paid_out` when funds had already moved)
      and the column cleared; with a manual hold also present the row stays `held`; lost ->
      `reversed` (transfer reversed when one exists). Both hold orders tested.
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
  understand why they are rejected), `transfer_group`, `source_transaction`, refunds
  (`refunds.create`) and **transfer reversals** (`transfers.createReversal`), Connect webhook
  endpoints (`connect: true`), capabilities (`transfers` vs `card_payments`), disputes, payouts,
  test clocks, webhook best practices, idempotency.
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
   (Connect Express controller, Account Sessions + Embedded Components, capabilities, separate
   charges and transfers, refunds + transfer reversals, Connect webhook endpoints, disputes,
   payouts, test clocks) and QStash
   docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 6 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-06.1/connect-onboarding-hardening
- Second PR (opened after the first merges): phase-06.2/payout-engine-refunds. Each PR: <= 30 files / 400 lines where possible; split above 60 / 800 and always before 100 reviewable files.
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

PHASE 6 TASK — Make Stripe Connect smooth and build the payout engine.

PR 06.0 — spike (test mode, throwaway code under packages/billing/spikes/, evidence is the
deliverable): against the staging Stripe account prove and record in
docs/eleva-v3/spikes/06-stripe-funds-flow.md (ids, screenshots, event payloads): platform
PaymentIntent with payment_method_configuration; connected Express account with ONLY the
transfers capability (confirm the account can receive transfers and pay out without
card_payments — if Stripe requires more, record it and update D-05); delayed transfer with
source_transaction; full and partial refund followed by transfers.createReversal; reversal with
insufficient connected balance; dispute created/closed on a transferred charge; connected-account
webhooks (payout.paid, account.updated, capability.updated) on a Connect endpoint; clinic 0%
booking where the processing fee is deducted from the transfer. Fill the settlement matrix rows
with real numbers and hand them to finance (D-03, D-04). Delete the spike code before PR 06.1.

PR 06.1 — Connect onboarding hardening:
1. @eleva/billing connect.ts: create Express accounts with controller settings from
   payments-payouts-spec.md (fees payer application, losses collector application, stripe dashboard
   type express), country from expert profile (PT first), business_type individual|company,
   capability transfers ONLY (D-05; no card_payments — the platform charges the member); store
   account id + status fields on billing_customers (payouts_enabled, details_submitted,
   requirements_currently_due jsonb, connect_capabilities jsonb, identity_status nullable).
   account-session.ts: enable components account_onboarding, account_management, payouts,
   notification_banner, balances (read the current allow-list and extend). identity.ts stays,
   behind ff.expert_identity_verification (default off).
2. Webhook: add account.updated, identity.verification_session.verified,
   identity.verification_session.requires_input, capability.updated to BOTH
   packages/billing/src/server/webhook.ts and infra/stripe/setup-webhooks.ts (two-file contract);
   handlers update billing_customers inside withAudit; add the parity unit test that asserts the
   dispatcher's handled event set equals WEBHOOK_EVENTS.
3. apps/expert onboarding (append steps to the Phase 4B onboarding-steps.ts registry rendered by
   @eleva/dashboard OnboardingShell — never a second wizard): step "Payments" renders Embedded
   Account Onboarding; step "Identity" renders only when ff.expert_identity_verification is on;
   status page shows requirements due with plain-language next actions (pt/en/es). Gate: POST
   /expert/event-types/[id]/publish returns 409 CONNECT_INCOMPLETE until details_submitted &&
   payouts_enabled && connect_capabilities.transfers === "active" (plus identity when the flag is
   on); UI shows the reason.
4. Commission SSOT: packages/billing/src/server/commission.ts exports computeApplicationFee({
   amountCents, expertOrgId, buyerContext }) using expert plan tier (default 1500 bps, top_expert
   800 bps, clinic-member booking 0 bps, optional grandfathered override stored on
   billing_customers.commission_override_bps with expiry) AND computeSettlement({ grossCents,
   commissionBps, vatRateBps, vatTreatment: pt_b2b | eu_reverse_charge | eu_b2c | non_eu,
   processingFeeCents, feeBearer: "platform" | "expert" | "clinic" (the SSOT union of
   payments-payouts-spec.md — never a different spelling) }) -> { bookingGross,
   platformFeeGross, platformFeeNet, vatOnPlatformFee, paymentProcessingFee, expertTransfer,
   creditNoteAllocation(refundCents), rounding: "half-up-cents-on-fee", currency: "EUR" }. The
   commission is VAT-INCLUSIVE (fee gross = advertised %; PT B2B splits it into net + 23% IVA;
   reverse charge keeps it as net) and the processing fee is borne by the platform
   (feeBearer = platform) for marketplace bookings and by the clinic (feeBearer = clinic) for
   clinic 0% bookings, with feeBearer = expert available for D-04 — these are the D-03/D-04
   working defaults; the accountant-approved matrix in payments-payouts-spec.md is the SSOT and
   the tests are written from it row by row. Store applied_commission_bps,
   platform_fee_net_cents, platform_fee_vat_cents and processing_fee_cents on booking_payments
   at intent creation / charge time (update the Phase 4 route). No other module may add,
   subtract or round money.

PR 06.2 — payout engine, refunds, disputes, finance UI:
5. packages/db: payout_states (id, booking_payment_id unique, expert_org_id, destination_org_id
   not null, destination_connect_account_id not null — both snapshotted when the row is created
   and never updated (DB trigger or CHECK via an immutable-columns helper + unit test); this phase
   writes the expert's org/account, Phase 11 writes the clinic's for payout_mode clinic; transfer,
   refund/reversal, reconciliation and retry code read only the snapshot — status enum
   pending|scheduled|approval_required|transferred|paid_out|failed|held|reversal_pending|reversed,
   reversed_cents int default 0 CHECK (reversed_cents <= amount_cents), eligible_at,
   scheduled_for, amount_cents, transfer_idempotency_key uuid not null default gen_random_uuid(),
   stripe_transfer_id, stripe_payout_id, hold_reasons text[] NOT NULL DEFAULT '{}' (values
   dispute|manual), held_from_status, approved_by,
   approved_at, attempts, last_error, created_at, updated_at); booking_payments additions
   refunded_cents, dispute_status, stripe_charge_id; RLS (expert org read; API writes); audit
   unions per the phase file.
6. @eleva/billing payouts.ts: computeEligibleAt(paidAt, sessionEnd) = max(paidAt+7d,
   sessionEnd+24h) snapped to next 04:00 Europe/Lisbon (use Temporal polyfill or date-fns-tz;
   tests for DST); schedulePayout(bookingPaymentId) (approval_required when: first payout of the
   account, amount_cents >= PAYOUT_APPROVAL_THRESHOLD_CENTS env (default 50000; inclusive — add a
   unit test at exactly the threshold) — the only two reasons; dispute open and manual hold go to
   held with held_from_status, and approve returns 409 DISPUTE_OPEN while a dispute is open);
   holds are a set: hold_reasons text[] {dispute|manual}; applyHold(id, reason) adds the reason
   (the first one records held_from_status), clearHold(id, reason) removes it and restores
   held_from_status only when the set is empty; releaseHold(payoutStateId) = clearHold(id,
   "manual") and reports the remaining reasons; tests for both application orders;
   executeTransfer(payoutStateId) creating stripe.transfers.create({ amount, currency,
   destination: payoutState.destination_connect_account_id, transfer_group: bookingId,
   source_transaction: chargeId, metadata },
   { idempotencyKey: payoutState.transfer_idempotency_key }) — a UUID column written once when
   the row enters scheduled and reused on every retry (Stripe returns the original transfer for
   the same key), so a lost response can never produce a second transfer; a new key is only
   minted by an admin action after a reversed transfer; test: two calls with a simulated lost
   response yield one transfer — with retry/backoff and DLQ table
   workflow_dead_letters (reuse if exists); refunds.ts (P0-1 contract): refundBookingPayment({
   id, amountCents?, reason }) = step 1 stripe.refunds.create({ payment_intent, amount },
   { idempotencyKey: "refund:" + id + ":" + refundSeq }) persisted in a refunds table (id,
   booking_payment_id, stripe_refund_id, amount_cents, status pending|succeeded|failed, reason,
   created_at) and reflected on booking_payments.refunded_cents; step 2 ONLY when
   payout_states.stripe_transfer_id exists: stripe.transfers.createReversal(transferId, {
   amount: round(refundedToDate * transferred / gross) - reversedToDate (cumulative, never
   per-refund — see Scope; CHECK (reversed_cents <= amount_cents) on payout_states), metadata },
   { idempotencyKey: "reversal:" + refundId }) persisted in transfer_reversals (id, payout_state_id, refund_id,
   stripe_reversal_id, amount_cents, status pending|succeeded|failed, last_error); payout_states
   moves to reversal_pending until transfer.reversed confirms, then reversed (full) or stays in
   its prior status with reversed_cents (partial); a failed reversal (balance_insufficient) is
   retried with backoff, alerts finance, and never blocks or undoes the member refund; never
   mint a new transfer_idempotency_key here; the Tier 1 credit note is emitted by Phase 7 from
   the refund succeeded event, not from the request. Dispute handling: charge.dispute.created =
   applyHold(id, "dispute"); closed won = clearHold(id, "dispute"); closed lost = record the
   dispute loss, then the same two-step reversal path when a transfer exists (the charge is
   already reversed by Stripe); state-machine test covers every transition in the union above
   plus reversal_pending.
7. Webhook handlers (two-file contract, idempotent, withAudit): payment_intent.succeeded (also
   creates payout_states pending), payment_intent.processing (async_short hold extension from
   Phase 4), payment_intent.payment_failed, payment_intent.canceled, charge.refunded,
   refund.updated (failed refunds), charge.dispute.created, charge.dispute.closed,
   transfer.created, transfer.updated, transfer.reversed (platform-owned transfers -> platform
   endpoint) on /webhooks/stripe; payout.paid, payout.failed, account.updated, capability.updated
   on the Connect endpoint. Connected-account events (payout.*, account.updated, capability.updated)
   only arrive on a Connect webhook endpoint: extend infra/stripe/setup-webhooks.ts to manage TWO
   endpoints (platform and connect: true, each with its own event list and secret
   STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_WEBHOOK_SECRET; the route picks the secret by path
   /webhooks/stripe vs /webhooks/stripe/connect) and make the parity test cover both lists.
   Re-run pnpm stripe:setup:webhooks -- --url <staging url> --apply and record both endpoint ids
   in infra/stripe/README.md.
8. Workflows: packages/workflows/src/payments/{process-expert-transfers,process-pending-payouts,
   check-upcoming-payouts}.ts and routes apps/api/src/app/workflows/<name>/route.ts verifying the
   QStash signature; infra/qstash/setup-payouts.ts registering schedules (transfers every 2h,
   pending payouts 06:00 Europe/Lisbon, upcoming payouts daily 08:00) + root script
   qstash:setup:payouts and inclusion in setup:all. Each step idempotent.
9. apps/api: POST /payments/[bookingPaymentId]/refund (capability billing:refund for the owning
   expert org, or staff capability admin_payouts:refund), GET /payouts?status&orgId (expert sees
   own org only — orgId must equal the session's active org or 403; staff with
   admin_payouts:read see all), POST /payouts/[id]/approve, POST /payouts/[id]/hold and POST
   /payouts/[id]/release ({ reason }) are STAFF-ONLY: requireApiAuth({ staffRoles:
   ["platform_admin", "staff_finance"] }) + capability admin_payouts:approve / admin_payouts:hold
   (hold and release share it) from
   packages/auth/src/permissions.ts (add both), reason required (400 when empty), withAudit with
   actor + reason + previous/next payout state; experts and members get 403 (table-driven test
   covering member, expert owner, staff_support, staff_finance, platform_admin). GET
   /me/finance/summary for experts. OpenAPI + @eleva/api-client.
10. apps/expert /[orgSlug]/finance: summary cards (gross, fees, net, pending, paid), bookings
    table with payout state + eligible date, Embedded Payouts component, CSV export (server
    action -> API). Messages pt/en/es.
11. Tests: eligibility incl. DST, schedule/approval rules, transfer idempotency with mocked
    Stripe, refund before/after transfer (two-step, partial share, reversal failure path),
    settlement matrix rows, dispute transitions, webhook parity for both endpoints, replay safety
    using pnpm stripe:replay:event on staging.
12. Docs: payments-payouts-spec.md (state machine + thresholds, refund/reversal contract,
    settlement matrix as approved, capabilities), integration-runbooks.md (stuck transfer, failed
    payout, failed reversal), admin-operator-playbooks.md (approve/hold), infra/stripe/README.md
    (two endpoints), infra/qstash/README.md, decision-log.md (commission SSOT; D-03, D-04, D-05
    marked approved with the approver).

Acceptance (paste evidence): spike report committed; expert completes Connect (transfers
capability) and publishing unlocks; full cycle pay -> eligible -> transfer -> payout in test
mode; refund before/after transfer as two steps incl. partial and failed-reversal path; dispute
hold/release; approval path audited; parity test for both endpoints; replay does not
double-transfer; settlement matrix tests.

Report: migrations, endpoints, schedules registered, webhook endpoint id, tests, CodeRabbit CLI
counts, PR URLs, deferred items.
```
