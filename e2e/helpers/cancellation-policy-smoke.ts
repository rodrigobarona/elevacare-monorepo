import { neon } from "@neondatabase/serverless"
import { expect, type APIRequestContext } from "@playwright/test"
import type { CancellationPolicy } from "@eleva/config/cancellation-policy"
import {
  apiUrl,
  authHeaders,
  tokenFromAuthUrl,
  waitForE2eAuthUrl,
  uniqueEmail,
} from "./auth"
import { PAID_EXPERT, PAID_OFFER, PAID_PRICE_CENTS } from "./local"

const CONSENTS = [
  { kind: "terms" as const, version: "dev-2026-09-09" },
  { kind: "privacy" as const, version: "dev-2026-09-09" },
  { kind: "health_data_processing" as const, version: "dev-2026-09-09" },
]

export type PolicySmokeCase = {
  policy: CancellationPolicy
  hoursUntilSession: number
  expectedRefundCents: number
}

export async function setFirstVisitCancellationPolicy(
  policy: CancellationPolicy
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required to set cancellation policy")
  }
  const sql = neon(databaseUrl)
  const rows = await sql`
    UPDATE event_types et
    SET cancellation_policy = ${policy},
        updated_at = now()
    FROM expert_profiles ep
    WHERE et.expert_profile_id = ep.id
      AND ep.username = ${PAID_EXPERT}
      AND et.slug = ${PAID_OFFER}
    RETURNING et.id
  `
  expect(rows.length).toBe(1)
}

export async function pickSlotHoursFromNow(
  request: APIRequestContext,
  modeId: string,
  targetHoursFromNow: number,
  rank = 0
): Promise<{ startsAt: string; endsAt: string; leadHours: number }> {
  const from = new Date()
  const horizonHours = Math.max(targetHoursFromNow + 48, 168)
  const to = new Date(Date.now() + horizonHours * 60 * 60 * 1000)
  const slotsUrl =
    `${apiUrl}/public/experts/${PAID_EXPERT}/event-types/${PAID_OFFER}/slots` +
    `?modeId=${encodeURIComponent(modeId)}` +
    `&from=${encodeURIComponent(from.toISOString())}` +
    `&to=${encodeURIComponent(to.toISOString())}` +
    `&tz=Europe%2FLisbon`
  const response = await request.get(slotsUrl)
  expect(response.status(), await response.text()).toBe(200)
  const body = (await response.json()) as {
    slots: Array<{ start: string; end: string }>
  }
  const targetMs = targetHoursFromNow * 60 * 60 * 1000
  const ranked = body.slots
    .map((slot) => ({
      ...slot,
      leadMs: Date.parse(slot.start) - Date.now(),
    }))
    .filter((slot) => slot.leadMs > 30 * 60 * 1000)
    .sort(
      (a, b) => Math.abs(a.leadMs - targetMs) - Math.abs(b.leadMs - targetMs)
    )
  const pick = ranked[rank] ?? ranked[0]
  if (!pick) {
    throw new Error(
      `no public slots within ${horizonHours}h for ${PAID_EXPERT}/${PAID_OFFER}`
    )
  }
  return {
    startsAt: pick.start,
    endsAt: pick.end,
    leadHours: pick.leadMs / (60 * 60 * 1000),
  }
}

async function fetchOfferModeId(request: APIRequestContext): Promise<string> {
  const offer = await request.get(
    `${apiUrl}/public/experts/${PAID_EXPERT}/event-types/${PAID_OFFER}`
  )
  expect(offer.status()).toBe(200)
  const detail = (await offer.json()) as {
    cancellationPolicy: CancellationPolicy
    modes: Array<{ id: string }>
  }
  const modeId = detail.modes[0]?.id
  expect(modeId).toBeTruthy()
  return modeId!
}

async function confirmStripePaymentIntent(
  paymentIntentId: string
): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY missing")
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        payment_method: "pm_card_visa",
        return_url: "http://127.0.0.1:3000/booking/done",
      }),
    }
  )
  const body = (await response.json()) as { status?: string; error?: unknown }
  if (!response.ok) {
    throw new Error(
      `Stripe confirm failed (${response.status}): ${JSON.stringify(body)}`
    )
  }
  expect(body.status).toBe("succeeded")
}

async function sessionFromMagicLink(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const magicUrl = await waitForE2eAuthUrl("magic-link", email, 45_000)
  expect(
    magicUrl,
    "magic-link missing — set E2E_AUTH_CAPTURE=1 on API"
  ).toBeTruthy()
  expect(tokenFromAuthUrl(magicUrl!)).toBeTruthy()
  const activated = await request.get(magicUrl!, {
    headers: authHeaders(),
    maxRedirects: 0,
  })
  expect([200, 302]).toContain(activated.status())
  const cookies = activated
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value.split(";", 1)[0]?.trim())
    .filter(Boolean)
  expect(cookies.length).toBeGreaterThan(0)
  return cookies.join("; ")
}

export async function runPolicySmokeCase(
  request: APIRequestContext,
  input: {
    testCase: PolicySmokeCase
  }
): Promise<{
  bookingId: string
  paymentIntentId: string
  quoteRefundCents: number
  paymentStatus: string
  refundDueCents: number | null
  refundedCents: number
}> {
  await setFirstVisitCancellationPolicy(input.testCase.policy)
  const modeId = await fetchOfferModeId(request)
  const slotRank =
    input.testCase.policy === "moderate"
      ? 2
      : input.testCase.policy === "strict"
        ? 0
        : 0

  const guestEmail = uniqueEmail(`cancel-${input.testCase.policy}`)
  let reserved: { reservationId: string; reservationToken: string } | null =
    null
  let slot = await pickSlotHoursFromNow(
    request,
    modeId,
    input.testCase.hoursUntilSession,
    slotRank
  )

  for (let attempt = 0; attempt < 8; attempt++) {
    const reserveBody = {
      username: PAID_EXPERT,
      eventTypeModeId: modeId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      timezone: "Europe/Lisbon",
      language: "en" as const,
      memberCountry: "PT",
      guest: { name: "Cancel Smoke", email: guestEmail },
      consents: CONSENTS,
      cancellationPolicy: input.testCase.policy,
    }

    const reserve = await request.post(`${apiUrl}/bookings/reserve`, {
      headers: authHeaders(),
      data: reserveBody,
    })
    if (reserve.status() === 201) {
      reserved = (await reserve.json()) as {
        reservationId: string
        reservationToken: string
      }
      break
    }
    if (reserve.status() === 422) {
      const err = await reserve.text()
      throw new Error(
        `reserve unavailable for ${input.testCase.policy} @ ${slot.startsAt}: ${err}`
      )
    }
    slot = await pickSlotHoursFromNow(
      request,
      modeId,
      input.testCase.hoursUntilSession,
      slotRank + attempt + 1
    )
  }
  expect(reserved, "reserve failed after slot retries").toBeTruthy()
  const intent = await request.post(`${apiUrl}/payments/intent`, {
    headers: authHeaders(),
    data: {
      reservationId: reserved!.reservationId,
      reservationToken: reserved!.reservationToken,
    },
  })
  expect([200, 201]).toContain(intent.status())
  const intentBody = (await intent.json()) as {
    paymentIntentId: string
    bookingId: string
  }

  await confirmStripePaymentIntent(intentBody.paymentIntentId)

  const confirm = await request.post(`${apiUrl}/bookings/confirm`, {
    headers: authHeaders(),
    data: {
      reservationId: reserved!.reservationId,
      reservationToken: reserved!.reservationToken,
      paymentIntentId: intentBody.paymentIntentId,
    },
  })
  expect(confirm.status(), await confirm.text()).toBe(201)
  const confirmBody = (await confirm.json()) as { bookingId: string }
  expect(confirmBody.bookingId).toBe(intentBody.bookingId)

  const cookie = await sessionFromMagicLink(request, guestEmail)

  let quoteBody: { refundCents: number } | null = null
  await expect
    .poll(
      async () => {
        const quote = await request.get(
          `${apiUrl}/me/bookings/${intentBody.bookingId}/cancellation-quote`,
          { headers: authHeaders(cookie) }
        )
        if (quote.status() !== 200) return null
        quoteBody = (await quote.json()) as { refundCents: number }
        return quoteBody
      },
      { timeout: 45_000 }
    )
    .not.toBeNull()
  expect(quoteBody!.refundCents).toBe(input.testCase.expectedRefundCents)

  const cancel = await request.post(
    `${apiUrl}/me/bookings/${intentBody.bookingId}/cancel`,
    { headers: authHeaders(cookie) }
  )
  expect(cancel.status(), await cancel.text()).toBe(200)
  const cancelBody = (await cancel.json()) as {
    refund: { refundCents: number }
  }
  expect(cancelBody.refund.refundCents).toBe(input.testCase.expectedRefundCents)

  const sweep = await request.post(
    `${apiUrl}/workflows/process-expert-transfers`,
    {
      headers: {
        Authorization: `Bearer ${process.env.WORKFLOWS_DRAIN_SECRET ?? ""}`,
      },
    }
  )
  expect(sweep.status(), await sweep.text()).toBe(200)

  const databaseUrl = process.env.DATABASE_URL
  expect(databaseUrl).toBeTruthy()
  const sql = neon(databaseUrl!)
  const paymentRows = await sql`
    SELECT status, refund_due_cents, refunded_cents, stripe_payment_intent_id
    FROM booking_payments
    WHERE booking_id = ${intentBody.bookingId}
    LIMIT 1
  `
  expect(paymentRows.length).toBe(1)
  const payment = paymentRows[0] as {
    status: string
    refund_due_cents: number | null
    refunded_cents: number
    stripe_payment_intent_id: string
  }

  if (input.testCase.expectedRefundCents > 0) {
    await expect
      .poll(
        async () => {
          const rows = await sql`
            SELECT status, refund_due_cents, refunded_cents
            FROM booking_payments
            WHERE booking_id = ${intentBody.bookingId}
            LIMIT 1
          `
          const row = rows[0] as {
            status: string
            refund_due_cents: number | null
            refunded_cents: number
          }
          return row.refunded_cents >= input.testCase.expectedRefundCents
            ? row
            : null
        },
        { timeout: 45_000 }
      )
      .not.toBeNull()
  }

  const refreshed = (
    await sql`
    SELECT status, refund_due_cents, refunded_cents
    FROM booking_payments
    WHERE booking_id = ${intentBody.bookingId}
    LIMIT 1
  `
  )[0] as {
    status: string
    refund_due_cents: number | null
    refunded_cents: number
  }

  expect(refreshed.refund_due_cents).toBe(input.testCase.expectedRefundCents)
  if (input.testCase.expectedRefundCents === 0) {
    expect(refreshed.status).toBe("succeeded")
    expect(refreshed.refunded_cents).toBe(0)
  } else {
    expect(refreshed.refunded_cents).toBe(input.testCase.expectedRefundCents)
    expect(["refunded", "succeeded"]).toContain(refreshed.status)
  }

  expect(PAID_PRICE_CENTS).toBe(6000)

  return {
    bookingId: intentBody.bookingId,
    paymentIntentId: payment.stripe_payment_intent_id,
    quoteRefundCents: quoteBody!.refundCents,
    paymentStatus: refreshed.status,
    refundDueCents: refreshed.refund_due_cents,
    refundedCents: refreshed.refunded_cents,
  }
}
