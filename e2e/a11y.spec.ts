import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

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
  "/",
  "/pt",
  "/experts",
  "/become-expert",
  "/for-clinics",
  "/contact",
]

test.describe("a11y: public marketplace", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no serious or critical WCAG AA violations`, async ({
      page,
    }) => {
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
      page.getByRole("main").getByRole("link", { name: /find an expert/i })
    ).toBeVisible()
    await expectNoBlockingViolations(page)
  })

  test("dark mode home keeps AA contrast", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    const res = await page.goto("/")
    expect(res?.status()).toBe(200)
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
})
