import { expect, test } from "@playwright/test"
import {
  DEMO_BOOKING_LINK_TOKENS,
  DEMO_PRIVATE_INVITE_NOTE,
  DEMO_PRIVATE_INVITE_SLUG,
} from "../packages/db/src/seed/demo-booking-links"

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"

async function seededOpenLink(): Promise<boolean> {
  try {
    const res = await fetch(
      `${apiUrl}/public/booking-links/${DEMO_BOOKING_LINK_TOKENS.open}`
    )
    return res.ok
  } catch {
    return false
  }
}

test.describe("phase 04 private booking links", () => {
  test("opens a closed-agenda invite with note and special price", async ({
    page,
  }) => {
    test.skip(
      !(await seededOpenLink()),
      "needs db:seed:demo private booking links"
    )

    const closed = await page.goto(`/fisiomota/${DEMO_PRIVATE_INVITE_SLUG}`)
    expect(closed?.status()).toBe(404)

    const open = await page.goto(`/book/${DEMO_BOOKING_LINK_TOKENS.open}`)
    expect(open?.status()).toBe(200)
    await expect(page.getByTestId("booking-link-note")).toContainText(
      DEMO_PRIVATE_INVITE_NOTE
    )
    await expect(page.getByTestId("booking-special-price")).toBeVisible()
  })

  test("404s an exhausted max_uses link", async ({ page }) => {
    test.skip(
      !(await seededOpenLink()),
      "needs db:seed:demo private booking links"
    )

    const exhausted = await page.goto(
      `/book/${DEMO_BOOKING_LINK_TOKENS.exhausted}`
    )
    expect(exhausted?.status()).toBe(404)
  })
})
