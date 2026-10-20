import { neon } from "@neondatabase/serverless"
import { expect, type APIRequestContext } from "@playwright/test"
import { apiUrl, authHeaders, uniqueEmail } from "./auth"
import {
  CONSENTS,
  confirmStripePaymentIntent,
  fetchOfferModeId,
  pickSlotHoursFromNow,
  sessionFromMagicLink,
} from "./cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  PAID_EXPERT,
  PAID_OFFER,
  PAID_PRICE_CENTS,
} from "./local"

/** Seeded fisiomota owner; `.test` is a reserved TLD, so no mail leaves. */
export const PAID_EXPERT_EMAIL = "fisio.mota@example.test"

export type RequestOutcome = "accept" | "decline" | "expire"

function sql() {
  const databaseUrl = process.env.DATABASE_URL
  if (!isApprovedE2eDatabaseUrl(databaseUrl)) {
    throw new Error(
      "request smoke requires E2E_ALLOW_DB_WRITES=1 and an approved loopback test DATABASE_URL"
    )
  }
  return neon(databaseUrl!)
}

export async function setFirstVisitRequiresApproval(
  requiresApproval: boolean
): Promise<void> {
  const rows = await sql()`
    UPDATE event_types et
    SET requires_approval = ${requiresApproval},
        updated_at = now()
    FROM expert_profiles ep
    WHERE et.expert_profile_id = ep.id
      AND ep.username = ${PAID_EXPERT}
      AND et.slug = ${PAID_OFFER}
    RETURNING et.id
  `
  expect(rows.length).toBe(1)
}

/** Reserve → pay (Stripe TEST card) → confirm the seeded first-visit offer. */
export async function payFirstVisit(
  request: APIRequestContext,
  label: string
): Promise<{
  bookingId: string
  guestEmail: string
  status: string
  approvalDeadlineAt?: string
}> {
  const modeId = await fetchOfferModeId(request)
  const guestEmail = uniqueEmail(label)

  let reserved: { reservationId: string; reservationToken: string } | null =
    null
  let lastFailure = ""
  for (let rank = 0; rank < 8 && !reserved; rank++) {
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
        guest: { name: "Request Smoke", email: guestEmail },
        consents: CONSENTS,
      },
    })
    if (reserve.status() === 201) {
      reserved = (await reserve.json()) as {
        reservationId: string
        reservationToken: string
      }
    } else {
      lastFailure = `${reserve.status()}: ${await reserve.text()}`
    }
  }
  expect(reserved, `reserve failed after retries (${lastFailure})`).toBeTruthy()

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
  const confirmed = (await confirm.json()) as {
    bookingId: string
    status: string
    approvalDeadlineAt?: string
  }
  expect(confirmed.bookingId).toBe(intentBody.bookingId)
  return { ...confirmed, guestEmail }
}

/** Pays a Request to book slot and asserts it is parked for the expert. */
export async function payRequestToBook(
  request: APIRequestContext,
  label: string
): Promise<{ bookingId: string; approvalDeadlineAt: string }> {
  const confirmed = await payFirstVisit(request, `request-${label}`)
  expect(confirmed.status).toBe("awaiting_confirmation")
  expect(confirmed.approvalDeadlineAt).toBeTruthy()

  const [booking] = (await sql()`
    SELECT status FROM bookings WHERE id = ${confirmed.bookingId}
  `) as Array<{ status: string }>
  expect(booking?.status).toBe("awaiting_confirmation")
  const sessions = await sql()`
    SELECT id FROM sessions WHERE booking_id = ${confirmed.bookingId}
  `
  expect(sessions.length, "no session before the expert accepts").toBe(0)

  return {
    bookingId: confirmed.bookingId,
    approvalDeadlineAt: confirmed.approvalDeadlineAt!,
  }
}

/** The personal Space slug guest activation minted for this member. */
export async function memberSpaceSlug(bookingId: string): Promise<string> {
  const rows = (await sql()`
    SELECT o.slug
    FROM bookings b
    JOIN auth.member m ON m.user_id = b.member_user_id
    JOIN auth.organization o ON o.id = m.organization_id
    WHERE b.id = ${bookingId} AND o.type = 'personal'
    LIMIT 1
  `) as Array<{ slug: string }>
  expect(rows[0]?.slug, "guest activation minted a personal Space").toBeTruthy()
  return rows[0]!.slug
}

export async function expertSession(
  request: APIRequestContext
): Promise<string> {
  return sessionFromMagicLink(request, PAID_EXPERT_EMAIL)
}

export async function settleRequest(
  request: APIRequestContext,
  input: { bookingId: string; outcome: RequestOutcome; expertCookie: string }
): Promise<void> {
  switch (input.outcome) {
    case "accept": {
      const res = await request.post(
        `${apiUrl}/expert/bookings/${input.bookingId}/accept`,
        { headers: authHeaders(input.expertCookie) }
      )
      expect(res.status(), await res.text()).toBe(200)
      return
    }
    case "decline": {
      const res = await request.post(
        `${apiUrl}/expert/bookings/${input.bookingId}/decline`,
        {
          headers: authHeaders(input.expertCookie),
          data: { note: "Request smoke decline" },
        }
      )
      expect(res.status(), await res.text()).toBe(200)
      return
    }
    case "expire": {
      await sql()`
        UPDATE bookings
        SET approval_deadline_at = now() - interval '1 minute'
        WHERE id = ${input.bookingId} AND status = 'awaiting_confirmation'
      `
      const res = await request.post(
        `${apiUrl}/workflows/booking-request-expiry`,
        { headers: drainHeaders() }
      )
      expect(res.status(), await res.text()).toBe(200)
      return
    }
    default: {
      const _exhaustive: never = input.outcome
      throw new Error(`unknown outcome ${String(_exhaustive)}`)
    }
  }
}

function drainHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.WORKFLOWS_DRAIN_SECRET ?? ""}`,
  }
}

export async function expectSettled(
  request: APIRequestContext,
  input: { bookingId: string; outcome: RequestOutcome }
): Promise<void> {
  const [booking] = (await sql()`
    SELECT status, cancellation_reason, confirmed_at
    FROM bookings WHERE id = ${input.bookingId}
  `) as Array<{
    status: string
    cancellation_reason: string | null
    confirmed_at: Date | null
  }>

  if (input.outcome === "accept") {
    // Guest checkouts get their session row from guest activation / join.
    expect(booking?.status).toBe("confirmed")
    expect(booking?.confirmed_at).not.toBeNull()
    const refunds = await sql()`
      SELECT br.id FROM booking_refunds br
      JOIN booking_payments bp ON bp.id = br.booking_payment_id
      WHERE bp.booking_id = ${input.bookingId}
    `
    expect(refunds.length, "accepted request is not refunded").toBe(0)
    return
  }

  expect(booking?.status).toBe("cancelled")
  if (input.outcome === "expire") {
    expect(booking?.cancellation_reason).toBe("request_expired")
  }

  const sweep = await request.post(
    `${apiUrl}/workflows/process-expert-transfers`,
    { headers: drainHeaders() }
  )
  expect(sweep.status(), await sweep.text()).toBe(200)

  await expect
    .poll(
      async () => {
        const [payment] = (await sql()`
          SELECT refunded_cents FROM booking_payments
          WHERE booking_id = ${input.bookingId}
          LIMIT 1
        `) as Array<{ refunded_cents: number }>
        return payment?.refunded_cents ?? 0
      },
      { timeout: 45_000 }
    )
    .toBe(PAID_PRICE_CENTS)

  const transfers = await sql()`
    SELECT ps.id FROM payout_states ps
    JOIN booking_payments bp ON bp.id = ps.booking_payment_id
    WHERE bp.booking_id = ${input.bookingId}
      AND ps.stripe_transfer_id IS NOT NULL
  `
  expect(
    transfers.length,
    "no Connect transfer for an unconfirmed request"
  ).toBe(0)
}
