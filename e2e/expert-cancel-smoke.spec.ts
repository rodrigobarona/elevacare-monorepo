/**
 * An expert cancels a confirmed, paid session: evidence, not part of the
 * default `e2e-smoke` CI. Opt-in via E2E_EXPERT_CANCEL_SMOKE=1; loopback
 * and Stripe TEST keys only.
 *
 * Pay → confirmed → the expert cancels → the booking is cancelled, the
 * whole price is owed back and then refunded, no transfer is made, and both
 * people's emails go through the notification pipeline.
 */
import { expect, test } from "@playwright/test"
import { apiUrl, authHeaders } from "./helpers/auth"
import {
  expertSession,
  payFirstVisit,
  setFirstVisitRequiresApproval,
} from "./helpers/booking-request-smoke"
import { isStripeTestSecretKey } from "./helpers/cancellation-policy-smoke"
import {
  bookingStartsAt,
  bookingStatus,
  expectCancelledByExpert,
  expectBothTold,
  expectRefundedInFull,
} from "./helpers/expert-cancel-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
  PAID_EXPERT,
  PAID_OFFER,
  PAID_PRICE_CENTS,
} from "./helpers/local"

const runSmoke = process.env.E2E_EXPERT_CANCEL_SMOKE === "1"

test.describe("Expert cancels a confirmed session (loopback)", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_EXPERT_CANCEL_SMOKE=1 to run this smoke")
  test.skip(isNonLoopbackE2eTarget(), "this smoke must stay on loopback only")
  test.skip(
    !isStripeTestSecretKey(process.env.STRIPE_SECRET_KEY),
    "needs Stripe TEST key (sk_test_ or rk_test_)"
  )
  test.skip(
    !process.env.WORKFLOWS_DRAIN_SECRET,
    "needs WORKFLOWS_DRAIN_SECRET for the refund sweep"
  )
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let expertCookie = ""
  let originalRequiresApproval: boolean | undefined

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    const offer = await request.get(
      `${apiUrl}/public/experts/${PAID_EXPERT}/event-types/${PAID_OFFER}`
    )
    test.skip(
      offer.status() !== 200,
      "needs seeded fisiomota / first-visit from db:seed:demo"
    )
    originalRequiresApproval = (
      (await offer.json()) as { requiresApproval: boolean }
    ).requiresApproval
    // Instant book: payment confirms the session straight away.
    await setFirstVisitRequiresApproval(false)
    expertCookie = await expertSession(request)
  })

  test.afterAll(async () => {
    if (originalRequiresApproval !== undefined) {
      await setFirstVisitRequiresApproval(originalRequiresApproval)
    }
  })

  const cancel = (
    request: Parameters<typeof expertSession>[0],
    bookingId: string,
    data: Record<string, unknown>
  ) =>
    request.post(`${apiUrl}/expert/bookings/${bookingId}/cancel`, {
      headers: authHeaders(expertCookie),
      data,
    })

  test("pay → confirmed → expert cancels → refunded in full", async ({
    request,
  }) => {
    test.setTimeout(180_000)
    const { bookingId, status } = await payFirstVisit(request, "expert-cancel")
    expect(status).toBe("confirmed")
    const startsAt = await bookingStartsAt(bookingId)

    // Someone who is not signed in gets nowhere.
    const anonymous = await request.post(
      `${apiUrl}/expert/bookings/${bookingId}/cancel`,
      { headers: authHeaders(), data: {} }
    )
    expect(anonymous.status()).toBe(401)
    expect(await bookingStatus(bookingId)).toBe("confirmed")

    // A calendar that still shows an older time cancels nothing.
    const stale = await cancel(request, bookingId, {
      expectedStartsAt: new Date(
        Date.parse(startsAt) - 3_600_000
      ).toISOString(),
    })
    expect(stale.status(), await stale.text()).toBe(409)
    expect(((await stale.json()) as { error: string }).error).toBe(
      "SESSION_CHANGED"
    )
    expect(await bookingStatus(bookingId)).toBe("confirmed")

    // Free text is refused: only a reason from the list is stored.
    const freeText = await cancel(request, bookingId, { reason: "I am ill" })
    expect(freeText.status()).toBe(400)
    expect(await bookingStatus(bookingId)).toBe("confirmed")

    const res = await cancel(request, bookingId, {
      reason: "unavailable",
      expectedStartsAt: startsAt,
    })
    expect(res.status(), await res.text()).toBe(200)
    expect(await res.json()).toEqual({
      bookingId,
      status: "cancelled",
      refundCents: PAID_PRICE_CENTS,
      alreadyCancelled: false,
    })
    await expectCancelledByExpert({ bookingId, reason: "unavailable" })

    // A second press changes nothing and refunds nothing more.
    const again = await cancel(request, bookingId, { reason: "other" })
    expect(again.status(), await again.text()).toBe(200)
    expect(await again.json()).toEqual({
      bookingId,
      status: "cancelled",
      refundCents: 0,
      alreadyCancelled: true,
    })
    await expectCancelledByExpert({ bookingId, reason: "unavailable" })

    await expectRefundedInFull(request, bookingId)
    await expectBothTold(request, bookingId)
  })
})
