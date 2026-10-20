/**
 * AUD-027 member report walkthrough — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_REPORT_SMOKE=1; loopback + Stripe TEST keys only. Needs the
 * API (:3002, E2E_AUTH_CAPTURE=1) and the member app (:3001).
 * Pay → expert writes + publishes a report → member signs in by magic link
 * and reads it → unpublish hides it again → member cancels the booking.
 */
import { expect, test, type APIRequestContext } from "@playwright/test"
import { apiUrl, authHeaders } from "./helpers/auth"
import {
  expertSession,
  memberSpaceSlug,
  payFirstVisit,
  setFirstVisitRequiresApproval,
} from "./helpers/booking-request-smoke"
import {
  isStripeTestSecretKey,
  sessionFromMagicLink,
} from "./helpers/cancellation-policy-smoke"
import {
  appUrl,
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
  PAID_EXPERT,
  PAID_OFFER,
} from "./helpers/local"

const runSmoke = process.env.E2E_REPORT_SMOKE === "1"

type MeReport = { id: string; body: string }

async function memberReports(
  request: APIRequestContext,
  cookie: string
): Promise<MeReport[]> {
  const res = await request.get(`${apiUrl}/me/reports`, {
    headers: authHeaders(cookie),
  })
  expect(res.status(), await res.text()).toBe(200)
  return ((await res.json()) as { reports: MeReport[] }).reports
}

test.describe("AUD-027 — member reads a published report", () => {
  test.skip(!runSmoke, "Set E2E_REPORT_SMOKE=1 to run the report walkthrough")
  test.skip(
    isNonLoopbackE2eTarget(),
    "member e2e must not run against non-loopback hosts"
  )
  test.skip(
    !isStripeTestSecretKey(process.env.STRIPE_SECRET_KEY),
    "needs Stripe TEST key (sk_test_ or rk_test_)"
  )
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

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
    if (originalRequiresApproval) await setFirstVisitRequiresApproval(false)
  })

  test.afterAll(async () => {
    if (originalRequiresApproval) await setFirstVisitRequiresApproval(true)
  })

  test("publish → member list + detail → unpublish", async ({
    context,
    page,
    request,
  }) => {
    test.setTimeout(240_000)
    const booking = await payFirstVisit(request, "report")
    expect(booking.status).toBe("confirmed")
    const memberCookie = await sessionFromMagicLink(request, booking.guestEmail)

    try {
      const expertCookie = await expertSession(request)
      const body = `E2E report ${booking.bookingId.slice(0, 8)}: keep stretching twice a day.`
      const upsert = await request.put(
        `${apiUrl}/sessions/${booking.bookingId}/records`,
        {
          headers: authHeaders(expertCookie),
          data: { kind: "report", body },
        }
      )
      expect([200, 201], await upsert.text()).toContain(upsert.status())
      const recordId = ((await upsert.json()) as { id: string }).id

      expect(
        (await memberReports(request, memberCookie)).map((r) => r.id),
        "an unpublished report is invisible to the member"
      ).not.toContain(recordId)

      const publish = await request.post(
        `${apiUrl}/sessions/${booking.bookingId}/records/${recordId}/publish`,
        { headers: authHeaders(expertCookie) }
      )
      expect(publish.status(), await publish.text()).toBe(200)

      const published = await memberReports(request, memberCookie)
      expect(published.find((r) => r.id === recordId)?.body).toBe(body)

      const spaceSlug = await memberSpaceSlug(booking.bookingId)
      await context.addCookies(
        memberCookie.split("; ").map((pair) => {
          const index = pair.indexOf("=")
          return {
            name: pair.slice(0, index),
            value: pair.slice(index + 1),
            url: appUrl,
          }
        })
      )
      await page.goto(`${appUrl}/${spaceSlug}/reports`)
      const row = page.getByTestId("member-report-row")
      await expect(row).toHaveCount(1, { timeout: 30_000 })
      await row.click()
      await expect(page.getByTestId("member-report-body")).toHaveText(body, {
        timeout: 30_000,
      })

      const unpublish = await request.post(
        `${apiUrl}/sessions/${booking.bookingId}/records/${recordId}/unpublish`,
        { headers: authHeaders(expertCookie) }
      )
      expect(unpublish.status(), await unpublish.text()).toBe(200)
      expect(
        (await memberReports(request, memberCookie)).map((r) => r.id)
      ).not.toContain(recordId)
      // Streamed render: notFound() after the shell keeps HTTP 200.
      await page.goto(`${appUrl}/${spaceSlug}/reports/${recordId}`)
      await expect(page.getByText(/not found|404/i).first()).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByTestId("member-report-body")).toHaveCount(0)
      await expect(page.getByText(body)).toHaveCount(0)
    } finally {
      await request.post(`${apiUrl}/me/bookings/${booking.bookingId}/cancel`, {
        headers: authHeaders(memberCookie),
      })
    }
  })
})
