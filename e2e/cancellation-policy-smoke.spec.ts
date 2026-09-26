/**
 * AUD-001 W3 operator evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_CANCELLATION_SMOKE=1; loopback + Stripe TEST keys only.
 */
import type { CancellationPolicy } from "@eleva/config/cancellation-policy"
import { expect, test } from "@playwright/test"
import { apiUrl } from "./helpers/auth"
import {
  isStripeTestSecretKey,
  runPolicySmokeCase,
  setFirstVisitCancellationPolicy,
  type PolicySmokeCase,
} from "./helpers/cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"

const runSmoke = process.env.E2E_CANCELLATION_SMOKE === "1"

const CASES: PolicySmokeCase[] = [
  { policy: "flexible", hoursUntilSession: 120, expectedRefundCents: 6000 },
  { policy: "moderate", hoursUntilSession: 30, expectedRefundCents: 3000 },
  // Strict 0% tier applies within 48h; seeded schedule rarely exposes ~1h slots.
  { policy: "strict", hoursUntilSession: 3, expectedRefundCents: 0 },
]

test.describe("AUD-001 smoke 3 — cancellation policy refunds", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(
    !runSmoke,
    "Set E2E_CANCELLATION_SMOKE=1 to run loopback policy smokes"
  )
  test.skip(
    isNonLoopbackE2eTarget(),
    "cancellation smokes must stay on loopback only"
  )
  test.skip(
    !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PMC_BOOKING,
    "needs STRIPE_SECRET_KEY and STRIPE_PMC_BOOKING"
  )
  test.skip(
    !isStripeTestSecretKey(process.env.STRIPE_SECRET_KEY),
    "needs Stripe TEST key (sk_test_ or rk_test_)"
  )
  test.skip(
    !process.env.CONSENT_HASH_KEY || process.env.CONSENT_HASH_KEY.length < 32,
    "needs CONSENT_HASH_KEY (32+ chars)"
  )
  test.skip(
    !process.env.WORKFLOWS_DRAIN_SECRET,
    "needs WORKFLOWS_DRAIN_SECRET for refund sweep"
  )
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let originalPolicy: CancellationPolicy | undefined

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    const offer = await request.get(
      `${apiUrl}/public/experts/fisiomota/event-types/first-visit`
    )
    test.skip(
      offer.status() !== 200,
      "needs seeded fisiomota / first-visit from db:seed:demo"
    )
    originalPolicy = (
      (await offer.json()) as { cancellationPolicy: CancellationPolicy }
    ).cancellationPolicy
  })

  test.afterAll(async () => {
    if (originalPolicy) {
      await setFirstVisitCancellationPolicy(originalPolicy)
    }
  })

  for (const testCase of CASES) {
    test(`${testCase.policy}: €${testCase.expectedRefundCents / 100} refund at ${testCase.hoursUntilSession}h lead`, async ({
      request,
    }) => {
      test.setTimeout(180_000)
      const result = await runPolicySmokeCase(request, { testCase })
      expect(result.quoteRefundCents).toBe(testCase.expectedRefundCents)
      expect(result.refundDueCents).toBe(testCase.expectedRefundCents)
      expect(result.refundedCents).toBe(testCase.expectedRefundCents)
    })
  }
})
