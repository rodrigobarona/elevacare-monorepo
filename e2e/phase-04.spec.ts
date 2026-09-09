import { expect, test } from "@playwright/test"
import {
  fillGuestAndConsents,
  fillStripeTestCard,
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
      await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    }

    const legalPt = await page.goto("/pt/legal/privacy")
    expect(legalPt?.status()).toBe(200)
    await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
  })

  test("explorer lists a seeded expert and opens the profile", async ({
    page,
  }) => {
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
})

test.describe("phase 04 live Stripe booking", () => {
  test.skip(
    process.env.E2E_LIVE_STRIPE !== "1",
    "set E2E_LIVE_STRIPE=1 to run the live Stripe booking test"
  )
  test("pays a seeded paid offer with test card 4242", async ({ page }) => {
    test.setTimeout(120_000)
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
})
