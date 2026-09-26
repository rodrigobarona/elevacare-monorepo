import { expect, test } from "@playwright/test"
import { apiUrl } from "./helpers/auth"
import {
  pickSlotHoursFromNow,
  runPolicySmokeCase,
  setFirstVisitCancellationPolicy,
  type PolicySmokeCase,
} from "./helpers/cancellation-policy-smoke"
import { PAID_EXPERT, PAID_OFFER } from "./helpers/local"
import { isNonLoopbackE2eTarget } from "./helpers/local"

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
    !process.env.CONSENT_HASH_KEY || process.env.CONSENT_HASH_KEY.length < 32,
    "needs CONSENT_HASH_KEY (32+ chars)"
  )
  test.skip(
    !process.env.WORKFLOWS_DRAIN_SECRET,
    "needs WORKFLOWS_DRAIN_SECRET for refund sweep"
  )
  test.skip(
    !process.env.DATABASE_URL,
    "needs DATABASE_URL for policy + payment reads"
  )

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
  })

  test.afterAll(async () => {
    await setFirstVisitCancellationPolicy("flexible").catch(() => undefined)
  })

  for (const testCase of CASES) {
    test(`${testCase.policy}: €${testCase.expectedRefundCents / 100} refund at ${testCase.hoursUntilSession}h lead`, async ({
      request,
    }) => {
      test.setTimeout(180_000)
      const offer = await request.get(
        `${apiUrl}/public/experts/${PAID_EXPERT}/event-types/${PAID_OFFER}`
      )
      const modeId = ((await offer.json()) as { modes: Array<{ id: string }> })
        .modes[0]?.id
      expect(modeId).toBeTruthy()
      const slot = await pickSlotHoursFromNow(
        request,
        modeId!,
        testCase.hoursUntilSession
      )
      if (testCase.policy === "strict") {
        test.skip(
          slot.leadHours < 2 || slot.leadHours > 47,
          `no strict slot inside 48h tier (closest ${slot.leadHours.toFixed(1)}h @ ${slot.startsAt})`
        )
      }
      if (testCase.policy === "moderate") {
        test.skip(
          slot.leadHours < 24 || slot.leadHours > 48,
          `no moderate slot near 30h lead (closest ${slot.leadHours.toFixed(1)}h @ ${slot.startsAt})`
        )
      }

      const result = await runPolicySmokeCase(request, { testCase })
      expect(result.quoteRefundCents).toBe(testCase.expectedRefundCents)
      expect(result.refundDueCents).toBe(testCase.expectedRefundCents)
      expect(result.refundedCents).toBe(testCase.expectedRefundCents)
    })
  }
})
