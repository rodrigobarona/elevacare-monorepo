# Spike 06.0 — Stripe separate charges and transfers

**Status:** 8 proven, 1 unproven (connected-account `balance_insufficient` after
payout), 1 D-05 plan confirmation (PT Custom transfers-only works; PT Express
capability state unproven until hosted onboarding; US Custom does not).
**Date:** 2026-09-11
**Stripe:** test mode (`sk_test_`), platform account used by local `.env.local`
(named `--env staging` in the runner). Live keys refused.
**Instance:** throwaway `pnpm exec tsx packages/billing/spikes/funds-flow.ts --env staging`
**Raw captures:** `packages/billing/spikes/evidence.json` (ids only; no secrets).
**Delete** `packages/billing/spikes/` before PR 06.1.

## Versions / API

| Item                 | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Stripe Node          | catalog `stripe` via `@eleva/billing`                        |
| `STRIPE_API_VERSION` | from env (spike instantiated Stripe with the pinned version) |
| PMC                  | `pmc_1UDsgeGd5f3064kZkzV7YhTQ` (`STRIPE_PMC_BOOKING`)        |

## Contract checks

### 01 — Express create without `card_payments` — proven (capability state unproven)

- **Request:** `accounts.create` with Express `controller` (fees/losses =
  application), `country: PT`, `capabilities: { transfers: { requested: true } }`
  only — no `card_payments`.
- **Response:** `acct_1UEdjmK5qSgquuFJ`. `capabilities.transfers=inactive`,
  `card_payments=absent`, `details_submitted=false`, `payouts_enabled=false`.
- **Absorb:** Stripe **accepts** Express account creation without `card_payments`.
  That is not proof that Express is transfers-only: `transfers` stayed inactive and
  `payouts_enabled=false`. Whether Express becomes receivable after hosted onboarding
  without `card_payments` is unproven. Publish gating in 06.1 must still wait for
  `details_submitted && payouts_enabled && capabilities.transfers === "active"`.

### 01b — PT Custom transfers-only becomes receivable — proven

- **Request:** Custom `country: PT`, `transfers` only, then test KYC + PT IBAN
  `PT50000201231234567890154`.
- **Response:** `acct_1UEdjoGcNaSZChKB`. `transfers=active`,
  `card_payments=absent`, `payouts_enabled=true`.
- **Prior US probe (same test account):** Custom US
  `transfers` only rejected: _You cannot request the `transfers` capability
  without the `card_payments` capability for accounts in US._
- **Absorb / D-05:** **PT Custom** does **not** require `card_payments` to
  receive transfers (`transfers=active`, `payouts_enabled=true`). Keep D-05 as
  `transfers` only for PT Custom. Do **not** extend that conclusion to PT Express:
  Express create without `card_payments` is accepted (check 01), but the
  receivable capability state is unproven until hosted onboarding. US Custom
  requires `card_payments`. Other countries if added later need their own
  capability matrix. D-05 stays `proposed`.

### 02 — Platform PaymentIntent + PMC — proven

- **Request:** `paymentIntents.create` 10000 EUR cents, `confirm: true`,
  `pm_card_visa`, `payment_method_configuration` set, **no** `transfer_data`,
  **no** `application_fee_amount`.
- **Response:** `pi_3UEdjtGd5f3064kZ1rv4oO70` succeeded.
  Charge `ch_3UEdjtGd5f3064kZ13fCLZ3e`. Balance txn
  `txn_3UEdjtGd5f3064kZ11x6AAgq`: amount 10000, fee **340**, net 9660.
- **Absorb:** separate charges and transfers hold. Processing fee on this
  Visa test charge is **3.40 EUR**.

### 03 — Delayed transfer + `source_transaction` — proven

- **Request:** `transfers.create` amount 8500, destination PT Custom,
  `source_transaction` = platform charge, `transfer_group` set.
- **Response:** `tr_3UEdjtGd5f3064kZ1BzJUIhN`.
- **Absorb:** destination charges are unnecessary. 06.2 payout engine should
  always pass `source_transaction` and the snapshotted Connect account id.

### 04 — Full refund then `transfers.createReversal` — proven

- **Request:** new 100 EUR PI → transfer 85 → `refunds.create` 10000 →
  `transfers.createReversal` 8500. Separate idempotency keys
  (`refund:<pi>:1`, `reversal:<refundId>`). No `reverse_transfer` flag.
- **Response:** refund `re_3UEdjvGd5f3064kZ1lHGYnpZ` succeeded, reversal
  `trr_1UEdjyGd5f3064kZoh6WSckP`.
- **Absorb:** two Stripe operations, two ledger states. Destination-charge
  `reverse_transfer` is the wrong API. This is the **pre-payout** path
  (funds still on the connected account). Reversal after a connected-account
  payout is check 06 and remains unproven.

### 05 — Partial refunds, cumulative share — proven

- **Request:** 100 EUR / 85 EUR transfer; refunds 3333 + 3333 + 3334;
  each reversal `round(refundedToDate * 8500 / 10000) - reversedToDate`.
- **Response:** reversed **2833 + 2833 + 2834 = 8500**.
- **Absorb:** matches the phase file (33.33/33.33/33.34 → 28.33/28.33/28.34).
  Persist `reversed_cents` and `CHECK (reversed_cents <= amount_cents)`.

### 06 — Reversal after insufficient connected balance — unproven

- **Request:** another 85 EUR transfer so we could payout-then-reverse.
- **Response:** Stripe `balance_insufficient` on the **platform** available
  balance (test account spent down by earlier spike charges). Connected-account
  drain path not reached. PaymentIntent `pi_3UEdk7Gd5f3064kZ01AQVslJ` was
  created before the transfer failed.
- **Absorb:** 06.2 must treat `balance_insufficient` as retryable (platform or
  connected). Re-run this case when the test available balance is topped up.
  Do not block 06.2 design: the error code is confirmed.

### 07 — Dispute on a transferred charge — proven

- **Request:** `pm_card_createDispute`, then transfer 85 EUR.
- **Response:** `pi_3UEdkBGd5f3064kZ1YPyubdo`, charge
  `ch_3UEdkBGd5f3064kZ1ujlOg9a`, `disputed=true`,
  `du_1UEdkBGd5f3064kZqchy6bH3`.
- **Absorb:** 06.2 `charge.dispute.created` → `applyHold(..., "dispute")`.
  Close path still needs a later `charge.dispute.closed` (test disputes stay
  open unless won/lost in Dashboard).

### 08 — Webhook endpoints — proven (gap)

- **Request:** `webhookEndpoints.list`.
- **Response:** 1 platform endpoint `https://api.eleva.care/webhooks/stripe`,
  **0** `connect: true` endpoints.
- **Absorb:** ADR-005's single-webhook clause is superseded. 06.1/06.2 must
  add `/webhooks/stripe/connect` + `STRIPE_CONNECT_WEBHOOK_SECRET`.
  `payout.paid|failed`, `account.updated`, `capability.updated` will not
  arrive on the platform endpoint.

### 09 — Clinic 0% vs marketplace settlement — proven (calculated from real fee)

Working defaults for finance (D-03 / D-04 still **proposed**):

| Row                     | Gross  | Commission | Fee bearer | Processing | Fee gross | Fee net / IVA | Expert transfer |
| ----------------------- | ------ | ---------- | ---------- | ---------- | --------- | ------------- | --------------- |
| Marketplace PT B2B      | 100.00 | 1500 bps   | platform   | 3.40       | 15.00     | 12.20 + 2.80  | **85.00**       |
| Marketplace intra-EU RC | 100.00 | 1500 bps   | platform   | 3.40       | 15.00     | 15.00 + 0     | **85.00**       |
| Top Expert PT B2B       | 100.00 | 800 bps    | platform   | 3.40       | 8.00      | 6.50 + 1.50   | **92.00**       |
| Clinic 0%               | 100.00 | 0 bps      | clinic     | 3.40       | 0         | 0             | **96.60**       |

IVA split uses 23% on the VAT-inclusive fee
(`net = round(gross / 1.23)`, IVA = gross − net): 15.00 → 12.20 + 2.80;
8.00 → 6.50 + 1.50.

## Plan changes to absorb in 06.1 / 06.2

1. **D-05 stays `proposed`.** Proven scope is PT Custom (`transfers` only,
   `card_payments` absent). US Custom requires `card_payments`. PT Express
   capability state is unproven. Keep `card_payments` on Express and on any
   unsupported or unproven country/account-type combination until hosted
   onboarding proves otherwise or finance/legal signs D-05. Do not strip
   `card_payments` from `connect.ts` in 06.1 on the strength of this spike.
2. **Two webhook endpoints** — Connect list is empty today.
3. **`balance_insufficient`** is a real Stripe code on this platform; retries
   - DLQ as specified.
4. **D-03 / D-04** remain unsigned. Matrix rows above are the working numbers
   to hand to finance; PR 06.1 stays gated.

## Not in this spike

- Hosted Express onboarding completion (needs a browser + test phone).
- Live Connect webhook delivery (`payout.paid`, `capability.updated` from the
  connected account) — no Connect endpoint exists yet.
- Dispute closed won/lost.
- Topping up the test available balance to finish the connected-account
  reversal-after-payout case.
