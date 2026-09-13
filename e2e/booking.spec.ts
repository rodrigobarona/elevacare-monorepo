import { expect, test, type Page } from "@playwright/test"
import { PAID_EXPERT, PAID_OFFER } from "./helpers/local"

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"

type PublicExpert = {
  username: string
  displayName: string
  eventTypes: Array<{ slug: string; modes: Array<{ id: string }> }>
}

async function seededBookableOffer(): Promise<{
  username: string
  slug: string
  modeId: string
} | null> {
  let profile: Response
  try {
    profile = await fetch(
      `${apiUrl}/public/experts/${encodeURIComponent(PAID_EXPERT)}`
    )
  } catch {
    if (process.env.CI) {
      throw new Error("seeded offer lookup: API unreachable")
    }
    return null
  }
  if (profile.status === 404) return null
  skipUnlessPageOk(profile.status, "seeded offer lookup")
  const expert = (await profile.json()) as PublicExpert
  const eventType = expert.eventTypes.find((item) => item.slug === PAID_OFFER)
  const modeId = eventType?.modes[0]?.id
  if (!eventType || !modeId) return null
  return { username: expert.username, slug: eventType.slug, modeId }
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

function skipUnlessPageOk(
  status: number | undefined,
  label: string
): asserts status is number {
  if (status === 429 && !process.env.CI) {
    test.skip(true, `${label}: public rate limit (10/min)`)
  }
  expect(status, label).toBe(200)
}

test.describe("booking funnel", () => {
  test("unknown private link is not found", async ({ page }) => {
    const response = await page.goto("/book/this-token-does-not-exist-at-all")
    expect(response?.status()).toBe(404)
  })

  test("walks meet → when → details when a published offer exists", async ({
    page,
  }) => {
    const offer = await seededBookableOffer()
    test.skip(!offer, "needs seeded fisiomota / first-visit from db:seed:demo")

    await mockFunnelApis(page, offer!.username, offer!.slug)
    const response = await page.goto(`/${offer!.username}/${offer!.slug}`)
    skipUnlessPageOk(response?.status(), "offer page")

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

  test("confirms a paid hold after Stripe redirect", async ({ page }) => {
    const offer = await seededBookableOffer()
    test.skip(!offer, "needs seeded fisiomota / first-visit from db:seed:demo")

    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 2)
    start.setUTCHours(10, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const confirmBodies: unknown[] = []
    await mockFunnelApis(page, offer!.username, offer!.slug)

    await page.route("**/bookings/confirm", async (route) => {
      confirmBodies.push(await route.request().postDataJSON())
      await route.fulfill({
        status: 201,
        json: {
          bookingId: "00000000-0000-4000-8000-000000000003",
          alreadyConfirmed: false,
        },
      })
    })

    await page.addInitScript(
      (snapshot) => {
        sessionStorage.setItem("bookingFunnel:v1", JSON.stringify(snapshot))
        sessionStorage.setItem(
          "bookingFunnel:redirect",
          JSON.stringify({
            status: "succeeded",
            paymentIntentId: snapshot.payment.paymentIntentId,
          })
        )
      },
      {
        reservation: {
          reservationId: "00000000-0000-4000-8000-000000000002",
          reservationToken: "reservation-token-e2e-test",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        },
        payment: {
          clientSecret: "pi_e2e_secret_test",
          paymentIntentId: "pi_e2e_intent",
          bookingId: "00000000-0000-4000-8000-000000000003",
          publishableKey: "pk_test_e2e",
        },
        slot: {
          start: start.toISOString(),
          end: end.toISOString(),
          startLocal: "10:00",
          endLocal: "11:00",
        },
        modeId: offer!.modeId,
        name: "E2E Member",
        email: "member@example.com",
        phone: "",
        timeZone: "Europe/Lisbon",
        country: "PT",
        language: "en",
      }
    )

    const response = await page.goto(
      `/${offer!.username}/${offer!.slug}?redirect_status=succeeded&payment_intent=pi_e2e_intent`
    )
    skipUnlessPageOk(response?.status(), "redirect restore page")
    await expect(page.getByTestId("booking-done-heading")).toHaveAttribute(
      "data-state",
      "confirmed",
      { timeout: 10_000 }
    )
    expect(confirmBodies).toEqual([
      {
        reservationId: "00000000-0000-4000-8000-000000000002",
        reservationToken: "reservation-token-e2e-test",
        paymentIntentId: "pi_e2e_intent",
      },
    ])
  })
})
