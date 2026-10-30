import { neon } from "@neondatabase/serverless"
import { expect, type APIRequestContext } from "@playwright/test"
import { apiUrl, authHeaders, uniqueEmail } from "./auth"
import {
  confirmStripePaymentIntent,
  CONSENTS,
  fetchOfferModeId,
  isStripeTestSecretKey,
  pickSlotHoursFromNow,
} from "./cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  PAID_EXPERT,
  PAID_PRICE_CENTS,
} from "./local"

/** €60 less the 15% platform fee. */
export const EXPERT_NET_CENTS = PAID_PRICE_CENTS - 900

export type PayoutRow = {
  id: string
  status: string
  amount_cents: number
  eligible_at: string
  stripe_transfer_id: string | null
  destination_connect_account_id: string
}

function database() {
  const databaseUrl = process.env.DATABASE_URL
  if (!isApprovedE2eDatabaseUrl(databaseUrl)) {
    throw new Error(
      "payout smoke requires E2E_ALLOW_DB_WRITES=1 and an approved loopback test DATABASE_URL"
    )
  }
  return neon(databaseUrl!)
}

/** Seeded experts have no Connect account; bind a verified TEST one. */
export async function bindConnectAccount(accountId: string): Promise<void> {
  const sql = database()
  const [expert] = await sql`
    SELECT org_id FROM expert_profiles WHERE username = ${PAID_EXPERT} LIMIT 1
  `
  expect(expert).toBeTruthy()
  const orgId = expert!.org_id as string
  await sql`
    UPDATE billing_customers
    SET stripe_connect_account_id = NULL, updated_at = now()
    WHERE stripe_connect_account_id = ${accountId} AND org_id <> ${orgId}
  `
  await sql`
    INSERT INTO billing_customers (
      id, org_id, stripe_customer_id, stripe_connect_account_id, payouts_enabled
    )
    VALUES (
      gen_random_uuid(), ${orgId}, ${`cus_e2e_${orgId}`}, ${accountId}, true
    )
    ON CONFLICT (org_id) DO UPDATE
    SET stripe_connect_account_id = EXCLUDED.stripe_connect_account_id,
        payouts_enabled = true,
        updated_at = now()
  `
}

export async function bookPaidOffer(
  request: APIRequestContext
): Promise<{ bookingId: string; paymentIntentId: string }> {
  const modeId = await fetchOfferModeId(request)
  for (let rank = 0; rank < 8; rank++) {
    const slot = await pickSlotHoursFromNow(request, modeId, 72, rank)
    const reserve = await request.post(`${apiUrl}/bookings/reserve`, {
      headers: authHeaders(),
      data: {
        username: PAID_EXPERT,
        eventTypeModeId: modeId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: "Europe/Lisbon",
        language: "en",
        memberCountry: "PT",
        guest: { name: "Payout Smoke", email: uniqueEmail("payout") },
        consents: CONSENTS,
      },
    })
    if (reserve.status() !== 201) continue
    const reserved = (await reserve.json()) as {
      reservationId: string
      reservationToken: string
    }
    const intent = await request.post(`${apiUrl}/payments/intent`, {
      headers: authHeaders(),
      data: reserved,
    })
    expect([200, 201]).toContain(intent.status())
    const { paymentIntentId } = (await intent.json()) as {
      paymentIntentId: string
    }
    await confirmStripePaymentIntent(paymentIntentId)
    const confirm = await request.post(`${apiUrl}/bookings/confirm`, {
      headers: authHeaders(),
      data: { ...reserved, paymentIntentId },
    })
    // 200 when the forwarded webhook confirmed the booking first.
    expect([200, 201], await confirm.text()).toContain(confirm.status())
    const { bookingId } = (await confirm.json()) as { bookingId: string }
    return { bookingId, paymentIntentId }
  }
  throw new Error("no reservable slot for the payout smoke")
}

export async function loadPayout(bookingId: string): Promise<PayoutRow | null> {
  const rows = await database()`
    SELECT ps.id, ps.status, ps.amount_cents, ps.eligible_at,
           ps.stripe_transfer_id, ps.destination_connect_account_id
    FROM payout_states ps
    JOIN booking_payments bp ON bp.id = ps.booking_payment_id
    WHERE bp.booking_id = ${bookingId}
    LIMIT 1
  `
  return (rows[0] as PayoutRow | undefined) ?? null
}

/** The payout opens from `payment_intent.succeeded`, so it needs the webhook. */
export async function waitForPayout(bookingId: string): Promise<PayoutRow> {
  await expect
    .poll(() => loadPayout(bookingId), {
      timeout: 60_000,
      message: "payout state missing — is `stripe listen` forwarding?",
    })
    .not.toBeNull()
  return (await loadPayout(bookingId))!
}

/** Stands in for `POST /payouts/{id}/approve`, which needs a staff session. */
export async function approveFirstPayout(payoutStateId: string): Promise<void> {
  const rows = await database()`
    UPDATE payout_states
    SET status = 'pending', approved_at = now(), updated_at = now()
    WHERE id = ${payoutStateId} AND status = 'approval_required'
    RETURNING id
  `
  expect(rows.length).toBe(1)
}

export async function shiftPayoutClock(payoutStateId: string): Promise<void> {
  const past = new Date(Date.now() - 60_000).toISOString()
  const rows = await database()`
    UPDATE payout_states
    SET eligible_at = ${past}, scheduled_for = ${past}, updated_at = now()
    WHERE id = ${payoutStateId}
    RETURNING id
  `
  expect(rows.length).toBe(1)
}

async function postWorkflow(
  request: APIRequestContext,
  path: string
): Promise<Record<string, unknown>> {
  const response = await request.post(`${apiUrl}/workflows/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.WORKFLOWS_DRAIN_SECRET ?? ""}`,
    },
  })
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()) as Record<string, unknown>
}

export async function runPayoutSweeps(
  request: APIRequestContext
): Promise<{ promoted: number }> {
  const pending = await postWorkflow(request, "process-pending-payouts")
  await postWorkflow(request, "process-expert-transfers")
  return { promoted: pending.promoted as number }
}

export async function retrieveStripeTransfer(transferId: string): Promise<{
  id: string
  amount: number
  currency: string
  destination: string
  transfer_group: string | null
  source_transaction: string | null
}> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!isStripeTestSecretKey(key)) {
    throw new Error("payout smoke requires a Stripe TEST key")
  }
  const response = await fetch(
    `https://api.stripe.com/v1/transfers/${transferId}`,
    { headers: { Authorization: `Bearer ${key}` } }
  )
  expect(response.status).toBe(200)
  return response.json()
}
