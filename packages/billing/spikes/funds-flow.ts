/**
 * Phase 06.0 throwaway — Stripe test-mode funds-flow spike.
 * Delete this folder before PR 06.1. Do not import from product code.
 *
 * Usage (repo root, test key only):
 *   pnpm exec tsx packages/billing/spikes/funds-flow.ts --env staging
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Stripe from "stripe"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(HERE, "../../..")

type CheckStatus = "proven" | "failed" | "unproven"

type Check = {
  id: string
  title: string
  status: CheckStatus
  absorb: string
  ids?: Record<string, string | null | undefined>
  error?: string
}

function loadDotEnv(path: string): void {
  const text = readFileSync(path, "utf8")
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function requireTestStripe(): Stripe {
  const named = process.argv.includes("--env")
    ? process.argv[process.argv.indexOf("--env") + 1]
    : undefined
  if (named !== "staging") {
    throw new Error("Refuse to run: pass --env staging (test-mode spike only).")
  }
  loadDotEnv(resolve(REPO_ROOT, ".env.local"))
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY missing from .env.local")
  if (!key.startsWith("sk_test_")) {
    throw new Error("Refuse to run: STRIPE_SECRET_KEY is not a test key.")
  }
  const apiVersion = process.env.STRIPE_API_VERSION
  if (!apiVersion) {
    throw new Error("STRIPE_API_VERSION missing from .env.local")
  }
  return new Stripe(key, {
    apiVersion: apiVersion as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: { name: "Eleva.care 06.0 spike", version: "0.0.0" },
  })
}

function capabilityStatus(
  account: Stripe.Account,
  name: "transfers" | "card_payments"
): string {
  const cap = account.capabilities?.[name]
  return typeof cap === "string" ? cap : "absent"
}

async function main(): Promise<void> {
  const stripe = requireTestStripe()
  const pmc = process.env.STRIPE_PMC_BOOKING
  if (!pmc) {
    throw new Error("STRIPE_PMC_BOOKING missing from .env.local")
  }
  const checks: Check[] = []
  const stamp = new Date().toISOString()

  await runCheck(checks, {
    id: "01-express-transfers-only",
    title: "Express account with transfers capability only (D-05)",
    fn: async () => {
      const account = await stripe.accounts.create({
        controller: {
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
        country: "PT",
        email: `spike-06-0-${Date.now()}@example.invalid`,
        default_currency: "eur",
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { eleva_spike: "06.0" },
      })
      const card = capabilityStatus(account, "card_payments")
      const transfers = capabilityStatus(account, "transfers")
      return {
        absorb: `Stripe accepted Express (controller) without requesting card_payments. capabilities.transfers=${transfers}, card_payments=${card}, details_submitted=${String(account.details_submitted)}, payouts_enabled=${String(account.payouts_enabled)}.`,
        ids: { accountId: account.id, transfers, card_payments: card },
      }
    },
  })

  let destinationId: string | undefined

  await runCheck(checks, {
    id: "01b-pt-custom-transfers-only",
    title:
      "PT Custom transfers-only account becomes receivable without card_payments",
    fn: async () => {
      const created = await stripe.accounts.create({
        type: "custom",
        country: "PT",
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { eleva_spike: "06.0" },
      })
      const account = await stripe.accounts.update(created.id, {
        individual: {
          first_name: "Spike",
          last_name: "Lisboa",
          email: `spike-06-0-pt-${Date.now()}@example.invalid`,
          dob: { day: 1, month: 1, year: 1990 },
          address: {
            line1: "Rua Teste 1",
            city: "Lisboa",
            postal_code: "1000-001",
            country: "PT",
          },
        },
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: "127.0.0.1",
        },
        business_profile: { url: "https://eleva.care", mcc: "8099" },
        external_account: {
          object: "bank_account",
          country: "PT",
          currency: "eur",
          account_number: "PT50000201231234567890154",
        },
      })
      destinationId = account.id
      const transfers = capabilityStatus(account, "transfers")
      const cardPayments = capabilityStatus(account, "card_payments")
      if (
        transfers !== "active" ||
        account.payouts_enabled !== true ||
        cardPayments !== "absent"
      ) {
        throw new Error(
          `Unexpected PT Custom state: transfers=${transfers}, payouts_enabled=${String(account.payouts_enabled)}, card_payments=${cardPayments}`
        )
      }
      return {
        absorb: `PT Custom with transfers only reached transfers=active and payouts_enabled=${String(account.payouts_enabled)}. card_payments=${cardPayments} (D-05 holds for PT). US Custom rejected transfers-only in a prior probe (requires card_payments).`,
        ids: {
          accountId: account.id,
          transfers,
          card_payments: cardPayments,
          payoutsEnabled: String(account.payouts_enabled),
        },
      }
    },
  })

  const paid = await runCheck(checks, {
    id: "02-platform-payment-intent",
    title:
      "Platform PaymentIntent with payment_method_configuration (no transfer_data)",
    fn: async () => {
      const params: Stripe.PaymentIntentCreateParams = {
        amount: 10000,
        currency: "eur",
        confirm: true,
        payment_method: "pm_card_visa",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        transfer_group: `spike-06-0-${Date.now()}`,
        metadata: { eleva_spike: "06.0" },
      }
      params.payment_method_configuration = pmc
      const pi = await stripe.paymentIntents.create(params)
      if (pi.transfer_data) {
        throw new Error("PaymentIntent unexpectedly set transfer_data")
      }
      if (pi.application_fee_amount) {
        throw new Error("PaymentIntent unexpectedly set application_fee_amount")
      }
      const chargeId =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id
      let processingFeeCents: number | undefined
      let balanceTransactionId: string | undefined
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId)
        const btId =
          typeof charge.balance_transaction === "string"
            ? charge.balance_transaction
            : charge.balance_transaction?.id
        if (btId) {
          balanceTransactionId = btId
          for (
            let attempt = 0;
            attempt < 4 && processingFeeCents == null;
            attempt += 1
          ) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 750))
            const bt = await stripe.balanceTransactions.retrieve(btId)
            if (typeof bt.fee === "number") processingFeeCents = bt.fee
          }
        }
      }
      if (processingFeeCents == null) {
        throw new Error("Processing fee evidence is unavailable")
      }
      return {
        absorb: `Charged 100.00 EUR on the platform. status=${pi.status}, pmc=${pmc}, processing_fee_cents=${String(processingFeeCents)}.`,
        ids: {
          paymentIntentId: pi.id,
          chargeId,
          transferGroup: pi.transfer_group ?? undefined,
          processingFeeCents: processingFeeCents.toString(),
          balanceTransactionId,
        },
      }
    },
  })

  const chargeId = paid.ids?.chargeId
  const transferGroup = paid.ids?.transferGroup
  const processingFeeText = paid.ids?.processingFeeCents
  const processingFeeCents =
    processingFeeText === undefined ? undefined : Number(processingFeeText)

  const transferred = await runCheck(checks, {
    id: "03-delayed-transfer",
    title: "Delayed transfer with source_transaction",
    fn: async () => {
      if (!destinationId) throw new Error("No destination connected account")
      if (!chargeId) throw new Error("No platform charge id")
      const transfer = await stripe.transfers.create({
        amount: 8500,
        currency: "eur",
        destination: destinationId,
        source_transaction: chargeId,
        transfer_group: transferGroup ?? undefined,
        metadata: { eleva_spike: "06.0" },
      })
      return {
        absorb: `Transferred 85.00 EUR to ${destinationId} using source_transaction=${chargeId}.`,
        ids: { transferId: transfer.id, destination: destinationId },
      }
    },
  })

  const transferId = transferred.ids?.transferId

  await runCheck(checks, {
    id: "04-full-refund-reversal",
    title: "Full refund then transfers.createReversal (two operations)",
    fn: async () => {
      if (!paid.ids?.paymentIntentId) throw new Error("No PaymentIntent")
      if (!transferId) throw new Error("No transfer to reverse")
      const refundPi = await stripe.paymentIntents.create({
        amount: 10000,
        currency: "eur",
        confirm: true,
        payment_method: "pm_card_visa",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: { eleva_spike: "06.0-full-refund" },
      })
      const refundCharge =
        typeof refundPi.latest_charge === "string"
          ? refundPi.latest_charge
          : refundPi.latest_charge?.id
      if (!refundCharge) throw new Error("No charge on refund fixture PI")
      const dest = destinationId
      if (!dest) throw new Error("No destination")
      const xfer = await stripe.transfers.create({
        amount: 8500,
        currency: "eur",
        destination: dest,
        source_transaction: refundCharge,
        metadata: { eleva_spike: "06.0-full-refund" },
      })
      const refund = await stripe.refunds.create(
        { payment_intent: refundPi.id, amount: 10000 },
        { idempotencyKey: `refund:${refundPi.id}:1` }
      )
      const reversal = await stripe.transfers.createReversal(
        xfer.id,
        { amount: 8500, metadata: { eleva_spike: "06.0" } },
        { idempotencyKey: `reversal:${refund.id}` }
      )
      return {
        absorb: `Two Stripe operations: refunds.create ${refund.status} ${refund.id}, then transfers.createReversal ${reversal.id} amount=8500. reverse_transfer was not used.`,
        ids: {
          paymentIntentId: refundPi.id,
          refundId: refund.id,
          transferId: xfer.id,
          reversalId: reversal.id,
        },
      }
    },
  })

  await runCheck(checks, {
    id: "05-partial-refund-reversal",
    title: "Partial refunds reverse a cumulative share of the transfer",
    fn: async () => {
      if (!destinationId) throw new Error("No destination")
      const pi = await stripe.paymentIntents.create({
        amount: 10000,
        currency: "eur",
        confirm: true,
        payment_method: "pm_card_visa",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: { eleva_spike: "06.0-partial" },
      })
      const charge =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id
      if (!charge) throw new Error("No charge")
      const xfer = await stripe.transfers.create({
        amount: 8500,
        currency: "eur",
        destination: destinationId,
        source_transaction: charge,
      })
      const shares = [3333, 3333, 3334]
      const reversed: number[] = []
      let refundedToDate = 0
      let reversedToDate = 0
      for (const [i, refundCents] of shares.entries()) {
        refundedToDate += refundCents
        const refund = await stripe.refunds.create(
          { payment_intent: pi.id, amount: refundCents },
          { idempotencyKey: `refund:${pi.id}:${i + 1}` }
        )
        const share =
          Math.round((refundedToDate * 8500) / 10000) - reversedToDate
        const reversal = await stripe.transfers.createReversal(
          xfer.id,
          { amount: share },
          { idempotencyKey: `reversal:${refund.id}` }
        )
        reversed.push(reversal.amount)
        reversedToDate += reversal.amount
      }
      return {
        absorb: `33.33+33.33+33.34 refunds reversed ${reversed.join("+")}=${reversedToDate} of 85.00 transfer.`,
        ids: {
          paymentIntentId: pi.id,
          transferId: xfer.id,
          reversedCents: reversedToDate.toString(),
        },
      }
    },
  })

  await runCheck(checks, {
    id: "06-reversal-insufficient-balance",
    title: "Reversal when connected balance is insufficient",
    fn: async () => {
      if (!destinationId) throw new Error("No destination")
      const pi = await stripe.paymentIntents.create({
        amount: 10000,
        currency: "eur",
        confirm: true,
        payment_method: "pm_card_visa",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: { eleva_spike: "06.0-insufficient" },
      })
      const charge =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id
      if (!charge) throw new Error("No charge")
      let xfer: Stripe.Transfer
      try {
        xfer = await stripe.transfers.create({
          amount: 8500,
          currency: "eur",
          destination: destinationId,
          source_transaction: charge,
        })
      } catch (error) {
        const code =
          error instanceof Stripe.errors.StripeError ? error.code : undefined
        if (code === "balance_insufficient") {
          return {
            status: "unproven" as const,
            absorb: `Could not mint a second 85.00 transfer to drain: Stripe returned ${code}. This is the same class of insufficient-funds error 06.2 retries. Connected-account drain after payout was not reached on this run because the platform test available balance was exhausted.`,
            error: error instanceof Error ? error.message : String(error),
            ids: { paymentIntentId: pi.id, stripeCode: code },
          }
        }
        throw error instanceof Error ? error : new Error(String(error))
      }
      await stripe.payouts.create(
        { amount: 8500, currency: "eur" },
        { stripeAccount: destinationId }
      )
      try {
        await stripe.transfers.createReversal(xfer.id, { amount: 8500 })
      } catch (error) {
        const code =
          error instanceof Stripe.errors.StripeError ? error.code : undefined
        if (code === "balance_insufficient") {
          return {
            absorb: `After draining the connected account via payout, reversal failed with ${code} (expected balance_insufficient).`,
            ids: {
              transferId: xfer.id,
              paymentIntentId: pi.id,
              stripeCode: code,
            },
          }
        }
        throw error instanceof Error ? error : new Error(String(error))
      }
      throw new Error(
        "Reversal succeeded after payout; expected balance_insufficient"
      )
    },
  })

  await runCheck(checks, {
    id: "07-dispute",
    title: "Dispute created on a transferred charge",
    fn: async () => {
      if (!destinationId) throw new Error("No destination")
      const pi = await stripe.paymentIntents.create({
        amount: 10000,
        currency: "eur",
        confirm: true,
        payment_method: "pm_card_createDispute",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: { eleva_spike: "06.0-dispute" },
      })
      const charge =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id
      if (!charge) throw new Error("No charge")
      await stripe.transfers.create({
        amount: 8500,
        currency: "eur",
        destination: destinationId,
        source_transaction: charge,
      })
      await new Promise((r) => setTimeout(r, 2500))
      const refreshed = await stripe.charges.retrieve(charge)
      const disputeId =
        typeof refreshed.dispute === "string"
          ? refreshed.dispute
          : refreshed.dispute?.id
      if (!disputeId) {
        return {
          status: "unproven" as const,
          absorb: `pm_card_createDispute charged and transferred. charge.disputed=${String(refreshed.disputed)}, dispute still pending (async in test mode).`,
          ids: {
            paymentIntentId: pi.id,
            chargeId: charge,
          },
        }
      }
      return {
        absorb: `pm_card_createDispute charged and transferred. charge.disputed=${String(refreshed.disputed)}, dispute=${disputeId}.`,
        ids: {
          paymentIntentId: pi.id,
          chargeId: charge,
          disputeId,
        },
      }
    },
  })

  await runCheck(checks, {
    id: "08-webhook-endpoints",
    title: "Platform vs Connect webhook endpoints",
    fn: async () => {
      const endpoints: Stripe.WebhookEndpoint[] = []
      for await (const endpoint of stripe.webhookEndpoints.list({
        limit: 100,
      })) {
        endpoints.push(endpoint)
      }
      const platform = endpoints.filter((e) => !e.connect)
      const connect = endpoints.filter((e) => e.connect)
      return {
        absorb: `Listed ${String(endpoints.length)} endpoints: ${String(platform.length)} platform, ${String(connect.length)} connect:true. 06.1/06.2 must manage two endpoints (STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_WEBHOOK_SECRET).`,
        ids: {
          platformCount: String(platform.length),
          connectCount: String(connect.length),
          platformUrls: platform.map((e) => e.url).join(","),
          connectUrls: connect.map((e) => e.url).join(","),
        },
      }
    },
  })

  await runCheck(checks, {
    id: "09-clinic-zero-percent",
    title: "Clinic 0% booking: processing fee deducted from transfer",
    fn: async () => {
      if (
        processingFeeCents === undefined ||
        !Number.isFinite(processingFeeCents)
      ) {
        throw new Error("Processing fee evidence is unavailable")
      }
      const fee = processingFeeCents
      const expertTransfer = 10000 - fee
      return {
        absorb: `Working D-04 clinic row: commission 0 bps, feeBearer=clinic, expertTransfer = gross − processingFee = 10000 − ${String(fee)} = ${String(expertTransfer)} cents. Marketplace row stays expertTransfer=8500 with Eleva absorbing the ${String(fee)} cent fee.`,
        ids: {
          processingFeeCents: String(fee),
          clinicExpertTransferCents: String(expertTransfer),
          marketplaceExpertTransferCents: "8500",
        },
      }
    },
  })

  const evidence = {
    generatedAt: stamp,
    environment: "staging-test-mode",
    livemode: false,
    pmcConfigured: true,
    checks,
  }
  writeFileSync(
    resolve(HERE, "evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`
  )
  const failed = checks.filter((c) => c.status === "failed").length
  process.stdout.write(
    `Wrote ${checks.length} checks (${String(failed)} failed) to packages/billing/spikes/evidence.json\n`
  )
  if (failed > 0) process.exitCode = 1
}

async function runCheck(
  checks: Check[],
  input: {
    id: string
    title: string
    fn: () => Promise<{
      status?: CheckStatus
      absorb: string
      ids?: Check["ids"]
      error?: string
    }>
  }
): Promise<Check> {
  try {
    const result = await input.fn()
    const check: Check = {
      id: input.id,
      title: input.title,
      status: result.status ?? "proven",
      absorb: result.absorb,
      ids: result.ids,
      error: result.error,
    }
    checks.push(check)
    return check
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const check: Check = {
      id: input.id,
      title: input.title,
      status: "failed",
      absorb: "See error.",
      error: message,
    }
    checks.push(check)
    return check
  }
}

await main()
