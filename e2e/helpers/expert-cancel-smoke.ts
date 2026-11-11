import { neon } from "@neondatabase/serverless"
import { expect, type APIRequestContext } from "@playwright/test"
import { apiUrl } from "./auth"
import { isApprovedE2eDatabaseUrl, PAID_PRICE_CENTS } from "./local"

function sql() {
  const databaseUrl = process.env.DATABASE_URL
  if (!isApprovedE2eDatabaseUrl(databaseUrl)) {
    throw new Error(
      "expert cancel smoke requires E2E_ALLOW_DB_WRITES=1 and an approved loopback test DATABASE_URL"
    )
  }
  return neon(databaseUrl!)
}

export async function bookingStartsAt(bookingId: string): Promise<string> {
  const [row] = (await sql()`
    SELECT starts_at FROM bookings WHERE id = ${bookingId}
  `) as Array<{ starts_at: Date | string }>
  expect(row, "booking exists").toBeTruthy()
  return new Date(row!.starts_at).toISOString()
}

export async function bookingStatus(bookingId: string): Promise<string> {
  const [row] = (await sql()`
    SELECT status FROM bookings WHERE id = ${bookingId}
  `) as Array<{ status: string }>
  return row?.status ?? "missing"
}

/** What the cancellation wrote, before any sweep ran. */
export async function expectCancelledByExpert(input: {
  bookingId: string
  reason: string
}): Promise<void> {
  const [booking] = (await sql()`
    SELECT status, cancellation_reason, cancelled_at
    FROM bookings WHERE id = ${input.bookingId}
  `) as Array<{
    status: string
    cancellation_reason: string | null
    cancelled_at: Date | null
  }>
  expect(booking?.status).toBe("cancelled")
  expect(booking?.cancellation_reason).toBe(`expert_cancel:${input.reason}`)
  expect(booking?.cancelled_at).not.toBeNull()

  // The whole price is owed back, whatever the service's policy.
  const [payment] = (await sql()`
    SELECT status, refund_due_cents
    FROM booking_payments WHERE booking_id = ${input.bookingId}
  `) as Array<{ status: string; refund_due_cents: number }>
  expect(payment?.refund_due_cents).toBe(PAID_PRICE_CENTS)
  expect(["refund_pending", "refunded"]).toContain(payment?.status)

  // The time can be booked again.
  const held = await sql()`
    SELECT sr.id FROM slot_reservations sr
    JOIN bookings b ON b.reservation_id = sr.id
    WHERE b.id = ${input.bookingId} AND sr.status IN ('active', 'converted')
  `
  expect(held.length, "reservation released").toBe(0)

  // One event tells both people, and says the expert cancelled.
  const events = (await sql()`
    SELECT payload FROM domain_events_outbox
    WHERE type = 'booking.cancelled'
      AND payload->>'bookingId' = ${input.bookingId}
  `) as Array<{ payload: { cancelledBy?: string; refundCents?: number } }>
  expect(events.length).toBe(1)
  expect(events[0]?.payload.cancelledBy).toBe("expert")
  expect(events[0]?.payload.refundCents).toBe(PAID_PRICE_CENTS)

  const audits = (await sql()`
    SELECT payload FROM audit_outbox
    WHERE entity = 'booking' AND action = 'booking.canceled'
      AND entity_id = ${input.bookingId}
  `) as Array<{ payload: { reason?: string; reasonCode?: string } }>
  expect(audits.length).toBe(1)
  expect(audits[0]?.payload.reason).toBe("expert_cancel")
  expect(audits[0]?.payload.reasonCode).toBe(input.reason)
}

/** Runs the refund sweep and waits for Stripe (test mode) to return the money. */
export async function expectRefundedInFull(
  request: APIRequestContext,
  bookingId: string
): Promise<void> {
  const sweep = await request.post(
    `${apiUrl}/workflows/process-expert-transfers`,
    {
      headers: {
        Authorization: `Bearer ${process.env.WORKFLOWS_DRAIN_SECRET ?? ""}`,
      },
    }
  )
  expect(sweep.status(), await sweep.text()).toBe(200)

  await expect
    .poll(
      async () => {
        const [payment] = (await sql()`
          SELECT refunded_cents FROM booking_payments
          WHERE booking_id = ${bookingId}
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
    WHERE bp.booking_id = ${bookingId}
      AND ps.stripe_transfer_id IS NOT NULL
  `
  expect(transfers.length, "no transfer to the expert").toBe(0)
}

/**
 * Publishes the pending events and checks that the cancellation went
 * through the notification pipeline for both people: one email each, with
 * no error. (`.test` addresses are never handed to the mail provider, so
 * nothing leaves the machine.)
 */
export async function expectBothTold(
  request: APIRequestContext,
  bookingId: string
): Promise<void> {
  await expect
    .poll(
      async () => {
        const publish = await request.post(
          `${apiUrl}/workflows/domain-events-publisher`,
          {
            headers: {
              Authorization: `Bearer ${process.env.WORKFLOWS_DRAIN_SECRET ?? ""}`,
            },
          }
        )
        expect(publish.status(), await publish.text()).toBe(200)
        const rows = (await sql()`
          SELECT status, error FROM notification_deliveries
          WHERE kind = 'booking.cancelled'
            AND channel = 'email'
            AND idempotency_key LIKE ${`%${bookingId}%`}
        `) as Array<{ status: string; error: string | null }>
        return rows.filter((row) => row.status === "sent" && !row.error).length
      },
      { timeout: 60_000, intervals: [2_000] }
    )
    .toBe(2)
}
