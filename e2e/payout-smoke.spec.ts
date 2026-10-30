/**
 * Phase 06 operator evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_PAYOUT_SMOKE=1; loopback + Stripe TEST keys only.
 *
 * Real charge, real webhook, real Connect transfer. Only the payout clock is
 * shifted in the local database (eligibility is days after a session), and
 * the sweep is first proven to leave a not-yet-eligible payout alone.
 * Needs `stripe listen --forward-to` for the webhook that opens the payout.
 */
import { expect, test } from "@playwright/test"
import { apiUrl, authHeaders } from "./helpers/auth"
import { isStripeTestSecretKey } from "./helpers/cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"
import {
  approveFirstPayout,
  bindConnectAccount,
  bookPaidOffer,
  EXPERT_NET_CENTS,
  loadPayout,
  retrieveStripeTransfer,
  runPayoutSweeps,
  shiftPayoutClock,
  waitForPayout,
} from "./helpers/payout-smoke"

test.describe("Phase 06 — pay → payout state → Connect transfer", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(
    process.env.E2E_PAYOUT_SMOKE !== "1",
    "Set E2E_PAYOUT_SMOKE=1 to run the loopback payout smoke"
  )
  test.skip(isNonLoopbackE2eTarget(), "payout smoke must stay on loopback only")
  test.skip(
    !isStripeTestSecretKey(process.env.STRIPE_SECRET_KEY),
    "needs Stripe TEST key (sk_test_ or rk_test_)"
  )
  test.skip(
    !process.env.WORKFLOWS_DRAIN_SECRET,
    "needs WORKFLOWS_DRAIN_SECRET for the payout sweeps"
  )
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  test.skip(
    !process.env.E2E_PAYOUT_CONNECT_ACCOUNT,
    "needs E2E_PAYOUT_CONNECT_ACCOUNT, a verified TEST connected account"
  )

  test("a paid booking becomes a Connect transfer once eligible", async ({
    request,
  }) => {
    test.setTimeout(180_000)
    const health = await request.get(`${apiUrl}/health`, {
      headers: authHeaders(),
    })
    test.skip(health.status() !== 200, "needs local API on :3002")

    await bindConnectAccount(process.env.E2E_PAYOUT_CONNECT_ACCOUNT!)
    const booking = await bookPaidOffer(request)
    const payout = await waitForPayout(booking.bookingId)
    // The first payout to an account waits for staff approval.
    if (payout.status === "approval_required") {
      await approveFirstPayout(payout.id)
    }
    expect((await loadPayout(booking.bookingId))?.status).toBe("pending")
    expect(payout.amount_cents).toBe(EXPERT_NET_CENTS)
    expect(new Date(payout.eligible_at).getTime()).toBeGreaterThan(Date.now())

    const early = await runPayoutSweeps(request)
    expect(early.promoted).toBe(0)
    expect((await loadPayout(booking.bookingId))?.status).toBe("pending")

    await shiftPayoutClock(payout.id)
    const due = await runPayoutSweeps(request)
    expect(due.promoted).toBeGreaterThanOrEqual(1)

    const settled = await loadPayout(booking.bookingId)
    expect(settled?.status).toBe("transferred")
    expect(settled?.stripe_transfer_id).toBeTruthy()

    const transfer = await retrieveStripeTransfer(settled!.stripe_transfer_id!)
    expect(transfer.amount).toBe(EXPERT_NET_CENTS)
    expect(transfer.currency).toBe("eur")
    expect(transfer.destination).toBe(payout.destination_connect_account_id)
    expect(transfer.transfer_group).toBe(booking.bookingId)
    expect(transfer.source_transaction).toBeTruthy()
    console.log(
      `[payout-smoke] booking=${booking.bookingId} intent=${booking.paymentIntentId} transfer=${transfer.id} destination=${transfer.destination}`
    )
  })
})
