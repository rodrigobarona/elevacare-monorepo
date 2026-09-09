import { expect, test, type Page } from "@playwright/test"

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"

type PublicExpert = {
  username: string
  displayName: string
  eventTypes: Array<{ slug: string; modes: Array<{ id: string }> }>
}

async function firstBookableExpert(): Promise<PublicExpert | null> {
  const response = await fetch(`${apiUrl}/public/experts`)
  if (!response.ok) return null
  const body = (await response.json()) as { experts?: PublicExpert[] }
  return (
    body.experts?.find((expert) =>
      expert.eventTypes.some((eventType) => eventType.modes.length > 0)
    ) ?? null
  )
}

async function mockFunnelApis(page: Page, username: string, slug: string) {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() + 2)
  start.setUTCHours(10, 0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  await page.route("**/public/experts/**/slots**", async (route) => {
    await route.fulfill({
      json: {
        slots: [
          {
            start: start.toISOString(),
            end: end.toISOString(),
            startLocal: "10:00",
            endLocal: "11:00",
          },
        ],
        priceCents: 6000,
        durationMinutes: 60,
        scheduleId: "00000000-0000-4000-8000-000000000001",
      },
    })
  })

  await page.route("**/bookings/reserve", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        reservationId: "00000000-0000-4000-8000-000000000002",
        reservationToken: "reservation-token-e2e-test",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
    })
  })

  await page.route("**/payments/intent", async (route) => {
    await route.fulfill({
      json: {
        clientSecret: "pi_e2e_secret_test",
        paymentIntentId: "pi_e2e_intent",
        bookingId: "00000000-0000-4000-8000-000000000003",
        publishableKey: "pk_test_e2e",
      },
    })
  })

  return { username, slug }
}

test.describe("booking funnel", () => {
  test("unknown private link is not found", async ({ page }) => {
    const response = await page.goto("/book/this-token-does-not-exist-at-all")
    expect(response?.status()).toBe(404)
  })

  test("walks meet → when → details when a published offer exists", async ({
    page,
  }) => {
    const expert = await firstBookableExpert()
    test.skip(!expert, "needs a published marketplace expert from the API")

    const eventType = expert!.eventTypes.find((item) => item.modes.length > 0)
    if (!eventType) {
      test.skip(true, "expert has no bookable modes")
      return
    }

    await mockFunnelApis(page, expert!.username, eventType.slug)
    const response = await page.goto(`/${expert!.username}/${eventType.slug}`)
    expect(response?.status()).toBe(200)

    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toBeVisible()

    const continueMeet = page.getByTestId("booking-continue-meet")
    const whenHeading = page.getByTestId("booking-when-heading")
    await expect(continueMeet.or(whenHeading)).toBeVisible({ timeout: 10_000 })

    if (await continueMeet.isVisible()) {
      const enabledMode = page
        .getByTestId("booking-mode-option")
        .and(page.locator(":not([aria-disabled='true'])"))
        .first()
      await expect(enabledMode).toBeVisible()
      await enabledMode.click()
      await continueMeet.click()
    }

    await expect(whenHeading).toBeVisible()
  })
})
