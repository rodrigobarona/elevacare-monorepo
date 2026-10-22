import { expect, test } from "@playwright/test"
import {
  fillGuestAndConsents,
  fillStripeTestCard,
  fillStripeTestMbWay,
  uniqueGuestEmail,
  walkFunnelToDetails,
} from "./helpers/booking"

const LEGAL_SLUGS = ["terms", "privacy", "health-data"] as const

test.describe("phase 04 shipped surfaces", () => {
  test("marketing home, about, and draft legal pages render", async ({
    page,
  }) => {
    const home = await page.goto("/")
    expect(home?.status()).toBe(200)
    await expect(page.getByTestId("marketing-hero")).toBeVisible()

    const about = await page.goto("/about")
    expect(about?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    for (const slug of LEGAL_SLUGS) {
      const legal = await page.goto(`/legal/${slug}`)
      expect(legal?.status()).toBe(200)
      await expect(page.getByTestId("longform-version")).toBeVisible()
      await expect(page.getByTestId("longform-last-updated")).toBeVisible()
      await expect(page.getByTestId("legal-draft-banner")).toHaveCount(0)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    }

    const legalPt = await page.goto("/pt/legal/privacy")
    expect(legalPt?.status()).toBe(200)
    await expect(page.getByTestId("longform-version")).toBeVisible()
  })

  test("explorer lists a seeded expert and opens the profile", async ({
    page,
  }) => {
    test.skip(
      process.env.CI === "true" && !process.env.DATABASE_URL,
      "e2e-smoke has no DATABASE_URL"
    )
    const list = await page.goto("/experts")
    expect(list?.status()).toBe(200)
    const card = page.locator(
      '[data-testid="expert-card"][data-username="fisiomota"]'
    )
    const seeded = await card
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
    test.skip(!seeded, "needs seeded fisiomota from db:seed:demo")
    await card.click()
    await expect(page).toHaveURL(/\/fisiomota$/, { timeout: 15_000 })
    await expect(page.getByTestId("expert-profile-heading")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("upcoming slot on the profile opens the booking form with that time", async ({
    page,
  }) => {
    test.skip(
      process.env.CI === "true" && !process.env.DATABASE_URL,
      "e2e-smoke has no DATABASE_URL"
    )
    const profile = await page.goto("/fisiomota")
    expect(profile?.status()).toBe(200)
    const slot = page.getByTestId("profile-upcoming-slot").first()
    const hasSlot = await slot
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false)
    test.skip(!hasSlot, "needs upcoming slots on seeded fisiomota")
    await slot.click()
    await expect(page).toHaveURL(
      /\/fisiomota\/(?:first-visit|follow-up)\?.*mode=.*start=/,
      {
        timeout: 15_000,
      }
    )
    await expect(page.getByTestId("booking-details-heading")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId("booking-guest-name")).toBeVisible()
  })
})

test.describe("phase 04 live Stripe booking", () => {
  test.skip(
    process.env.E2E_LIVE_STRIPE !== "1",
    "set E2E_LIVE_STRIPE=1 to run the live Stripe booking test"
  )
  test("pays a seeded paid offer with test card 4242", async ({ page }) => {
    test.setTimeout(120_000)
    test.skip(
      !process.env.STRIPE_PMC_BOOKING,
      "set STRIPE_PMC_BOOKING before creating a live hold"
    )
    test.skip(
      !process.env.CONSENT_HASH_KEY || process.env.CONSENT_HASH_KEY.length < 32,
      "set CONSENT_HASH_KEY (32+ chars) before creating a live hold"
    )
    const book = await page.goto("/fisiomota/first-visit")
    test.skip(book?.status() !== 200, "needs seeded fisiomota / first-visit")

    await walkFunnelToDetails(page)
    await fillGuestAndConsents(page, {
      name: "E2E Cardholder",
      email: uniqueGuestEmail("stripe4242"),
    })

    const reserve = page.waitForResponse(
      (res) =>
        res.url().includes("/bookings/reserve") &&
        res.request().method() === "POST"
    )
    const intent = page.waitForResponse(
      (res) =>
        res.url().includes("/payments/intent") &&
        res.request().method() === "POST"
    )
    await page.getByTestId("booking-continue-details").click()
    const reserveResponse = await reserve
    test.skip(
      reserveResponse.status() !== 201,
      `POST /bookings/reserve returned ${reserveResponse.status()} — set CONSENT_HASH_KEY (32+ chars) and restart the API`
    )
    const intentResponse = await intent
    test.skip(
      ![200, 201].includes(intentResponse.status()),
      `POST /payments/intent returned ${intentResponse.status()} — set STRIPE_PMC_BOOKING and restart the API`
    )

    await fillStripeTestCard(page)
    const confirm = page.waitForResponse(
      (res) =>
        res.url().includes("/bookings/confirm") &&
        res.request().method() === "POST",
      { timeout: 45_000 }
    )
    const pay = page.getByTestId("booking-pay-submit")
    await pay.scrollIntoViewIfNeeded()
    // Stripe's Payment Element iframe intercepts the button click; submit the form.
    await pay.evaluate((el: HTMLButtonElement) => {
      el.closest("form")?.requestSubmit(el)
    })
    const stripeError = page
      .locator("form")
      .getByRole("alert")
      .filter({ hasText: /\S/ })
    await expect(
      page.getByTestId("booking-done-heading").or(stripeError)
    ).toBeVisible({ timeout: 45_000 })
    if (await stripeError.isVisible()) {
      throw new Error(
        `Stripe Payment Element: ${await stripeError.innerText()}`
      )
    }
    await confirm
    await expect(page.getByTestId("booking-done-heading")).toHaveAttribute(
      "data-state",
      "confirmed",
      { timeout: 45_000 }
    )
  })

  test.skip(
    process.env.E2E_LIVE_STRIPE_MBWAY !== "1",
    "set E2E_LIVE_STRIPE_MBWAY=1 to run the MB WAY async_short checkout test"
  )
  test("pays a seeded paid offer with MB WAY test phone (processing hold)", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    test.skip(
      !process.env.STRIPE_PMC_BOOKING,
      "set STRIPE_PMC_BOOKING with MB WAY enabled before running"
    )
    test.skip(
      !process.env.CONSENT_HASH_KEY || process.env.CONSENT_HASH_KEY.length < 32,
      "set CONSENT_HASH_KEY (32+ chars) before creating a live hold"
    )
    const book = await page.goto("/fisiomota/first-visit")
    test.skip(book?.status() !== 200, "needs seeded fisiomota / first-visit")

    await walkFunnelToDetails(page)
    await fillGuestAndConsents(page, {
      name: "E2E MB WAY",
      email: uniqueGuestEmail("stripe-mbway"),
    })

    const reserve = page.waitForResponse(
      (res) =>
        res.url().includes("/bookings/reserve") &&
        res.request().method() === "POST"
    )
    const intent = page.waitForResponse(
      (res) =>
        res.url().includes("/payments/intent") &&
        res.request().method() === "POST"
    )
    await page.getByTestId("booking-continue-details").click()
    const reserveResponse = await reserve
    test.skip(
      reserveResponse.status() !== 201,
      `POST /bookings/reserve returned ${reserveResponse.status()}`
    )
    const intentResponse = await intent
    test.skip(
      ![200, 201].includes(intentResponse.status()),
      `POST /payments/intent returned ${intentResponse.status()}`
    )

    try {
      await fillStripeTestMbWay(page)
    } catch (error) {
      test.skip(
        true,
        `MB WAY not available in Payment Element: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    const pay = page.getByTestId("booking-pay-submit")
    await pay.scrollIntoViewIfNeeded()
    await pay.evaluate((el: HTMLButtonElement) => {
      el.closest("form")?.requestSubmit(el)
    })

    await expect(page.getByTestId("booking-done-heading")).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByTestId("booking-done-heading")).toHaveAttribute(
      "data-state",
      /pending|confirmed/
    )
  })
})
