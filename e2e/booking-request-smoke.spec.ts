/**
 * AUD-035 Request to book evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_REQUEST_SMOKE=1; loopback + Stripe TEST keys only.
 * Pay → awaiting_confirmation, then expert accept / decline / deadline expiry.
 */
import { test } from "@playwright/test"
import { apiUrl } from "./helpers/auth"
import {
  expectSettled,
  expertSession,
  payRequestToBook,
  setFirstVisitRequiresApproval,
  settleRequest,
  type RequestOutcome,
} from "./helpers/booking-request-smoke"
import { isStripeTestSecretKey } from "./helpers/cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
  PAID_EXPERT,
  PAID_OFFER,
} from "./helpers/local"

const runSmoke = process.env.E2E_REQUEST_SMOKE === "1"

const OUTCOMES: RequestOutcome[] = ["accept", "decline", "expire"]

test.describe("AUD-035 — Request to book loopback", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_REQUEST_SMOKE=1 to run request smokes")
  test.skip(
    isNonLoopbackE2eTarget(),
    "request smokes must stay on loopback only"
  )
  test.skip(
    !isStripeTestSecretKey(process.env.STRIPE_SECRET_KEY),
    "needs Stripe TEST key (sk_test_ or rk_test_)"
  )
  test.skip(
    !process.env.WORKFLOWS_DRAIN_SECRET,
    "needs WORKFLOWS_DRAIN_SECRET for expiry and refund sweeps"
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
    await setFirstVisitRequiresApproval(true)
    expertCookie = await expertSession(request)
  })

  test.afterAll(async () => {
    if (originalRequiresApproval !== undefined) {
      await setFirstVisitRequiresApproval(originalRequiresApproval)
    }
  })

  for (const outcome of OUTCOMES) {
    test(`pay → awaiting_confirmation → ${outcome}`, async ({ request }) => {
      test.setTimeout(180_000)
      const { bookingId } = await payRequestToBook(request, outcome)
      await settleRequest(request, { bookingId, outcome, expertCookie })
      await expectSettled(request, { bookingId, outcome })
    })
  }
})
