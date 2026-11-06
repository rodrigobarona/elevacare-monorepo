import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { walkFunnelToDetails } from "./helpers/booking"
import { PAID_EXPERT, PAID_OFFER } from "./helpers/local"

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
const BLOCKING_IMPACTS = new Set(["serious", "critical"])

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const blocking = results.violations
    .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    }))
  expect(blocking).toEqual([])
}

const PUBLIC_PAGES = [
  { path: "/", needsData: false },
  { path: "/pt", needsData: false },
  { path: "/experts", needsData: true },
  { path: "/become-expert", needsData: false },
  { path: "/for-clinics", needsData: false },
  { path: "/contact", needsData: false },
]

test.describe("a11y: public marketplace", () => {
  for (const { path, needsData } of PUBLIC_PAGES) {
    test(`${path} has no serious or critical WCAG AA violations`, async ({
      page,
    }) => {
      test.skip(
        needsData && !process.env.DATABASE_URL,
        "needs DATABASE_URL (seeded marketplace)"
      )
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expectNoBlockingViolations(page)
    })
  }

  test("localized not-found has no serious or critical violations", async ({
    page,
  }) => {
    // Reserved usernames 404 in the profile route without calling the API.
    const res = await page.goto("/blog")
    expect(res?.status()).toBe(404)
    await expect(
      page.getByRole("main").getByTestId("not-found-find-expert")
    ).toBeVisible()
    await expectNoBlockingViolations(page)
  })
})

test.describe("a11y: booking funnel", () => {
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL (seeded fisiomota)")

  test("expert profile has no serious or critical violations", async ({
    page,
  }) => {
    const res = await page.goto(`/${PAID_EXPERT}`)
    expect(res?.status()).toBe(200)
    await expectNoBlockingViolations(page)
  })

  test("funnel steps have no serious or critical violations", async ({
    page,
  }) => {
    // Browser slot calls hit the 10/min public bucket; the scan needs markup, not live times.
    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 2)
    start.setUTCHours(10, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    await page.route("**/public/experts/**/slots**", (route) =>
      route.fulfill({
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
    )

    const res = await page.goto(`/${PAID_EXPERT}/${PAID_OFFER}`)
    expect(res?.status()).toBe(200)
    await expect(
      page
        .getByTestId("booking-continue-meet")
        .or(page.getByTestId("booking-when-heading"))
    ).toBeVisible({ timeout: 15_000 })
    await expectNoBlockingViolations(page)

    await walkFunnelToDetails(page)
    await expect(page.getByTestId("booking-details-heading")).toBeFocused()
    await expect(
      page.getByRole("textbox", { name: /full name|nome|nombre/i })
    ).toBeVisible()
    await expectNoBlockingViolations(page)
  })
})

test.describe("a11y: account auth", () => {
  test.skip(
    process.env.E2E_AUTH !== "1" && process.env.E2E_MEMBER !== "1",
    "account server only runs with E2E_AUTH=1 or E2E_MEMBER=1"
  )

  const accountUrl = process.env.E2E_ACCOUNT_URL ?? "http://localhost:3006"

  for (const path of ["/login", "/signup"]) {
    test(`${path} has no serious or critical WCAG AA violations`, async ({
      page,
    }) => {
      const res = await page.goto(`${accountUrl}${path}`)
      expect(res?.status()).toBe(200)
      await expectNoBlockingViolations(page)
    })
  }

  test("dark /login keeps AA contrast", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    const res = await page.goto(`${accountUrl}/login`)
    expect(res?.status()).toBe(200)
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await expectNoBlockingViolations(page)
  })
})
