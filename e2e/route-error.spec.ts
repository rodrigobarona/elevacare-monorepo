import { mkdirSync } from "node:fs"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

/**
 * The shared dashboard error page in a real browser: "Try again" asks the
 * server again, says so when the page still fails, and hands focus to the
 * page once it loads. Runs against a playground page that fails on purpose
 * (`apps/poc/src/app/fixtures/route-error`), so it needs no database and no
 * sign-in. Opt-in: `pnpm e2e:route-error` with `pnpm --filter @eleva/poc dev`
 * running. `DESIGN_CAPTURE_LABEL` also saves screenshots for the design audit.
 */
test.skip(
  process.env.E2E_ROUTE_ERROR !== "1",
  "set E2E_ROUTE_ERROR=1 (pnpm e2e:route-error) with the playground running"
)

const POC_URL = process.env.E2E_POC_URL ?? "http://localhost:3099"
const label = process.env.DESIGN_CAPTURE_LABEL
const outDir = label
  ? path.join(process.cwd(), "docs/eleva-v3/design-audit/captures", label)
  : null

async function open(
  page: Page,
  locale: string,
  fail: number,
  { delay = 0, variant = "plain" } = {}
) {
  const run = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await page.goto(
    `${POC_URL}/fixtures/route-error/${locale}/${variant}?run=${run}&fail=${fail}&delay=${delay}`
  )
  // The development overlay covers the page in captures.
  await page.addStyleTag({ content: "nextjs-portal { display: none }" })
  await expect(page.getByTestId("route-error")).toBeVisible()
}

async function capture(page: Page, name: string) {
  if (!outDir) return
  mkdirSync(outDir, { recursive: true })
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    animations: "disabled",
  })
}

test("Try again loads the page once the fault has passed", async ({ page }) => {
  await open(page, "en", 2, { delay: 700 })
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn’t load this page" })
  ).toBeVisible()
  await capture(page, "en-desktop-error")

  const tryAgain = page.locator("[data-error-retry]")
  // While it loads again the button says so, and cannot be pressed twice.
  await tryAgain.press("Enter")
  await expect(tryAgain).toHaveText("Trying again…")
  await expect(tryAgain).toHaveAttribute("aria-disabled", "true")
  await capture(page, "en-desktop-trying-again")
  // Still failing: the alert says so, and focus has not gone anywhere.
  await expect(
    page.getByTestId("route-error").getByRole("alert")
  ).toContainText("Still not loading. It may need a minute.")
  await expect(tryAgain).toHaveText("Try again")
  await expect(tryAgain).toBeFocused()
  await capture(page, "en-desktop-still-failing")

  // The fault has passed: the page replaces the error, with no reload.
  await tryAgain.press("Enter")
  await expect(
    page.getByRole("heading", { name: "The page loaded" })
  ).toBeVisible()
  await expect(page.getByTestId("route-error")).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "The page loaded" })
  ).toBeFocused()
})

test("with a loading skeleton, as in the dashboards", async ({ page }) => {
  await open(page, "en", 2, { delay: 700, variant: "with-loading" })
  // The skeleton replaces the error page while the page loads again.
  await page.locator("[data-error-retry]").press("Enter")
  await expect(page.getByTestId("fixture-loading")).toBeVisible()
  await expect(page.getByTestId("route-error")).toHaveCount(0)
  // It failed again: a new error page, which knows about the retry and
  // takes focus back to its button.
  await expect(
    page.getByTestId("route-error").getByRole("alert")
  ).toContainText("Still not loading. It may need a minute.")
  await expect(page.locator("[data-error-retry]")).toBeFocused()
  // The fault has passed: the page loads, and focus is on it.
  await page.locator("[data-error-retry]").press("Enter")
  await expect(
    page.getByRole("heading", { name: "The page loaded" })
  ).toBeVisible()
  await expect(page.locator("main")).toBeFocused()
})

test("offline, the page says so and waits for the connection", async ({
  page,
  context,
}) => {
  await open(page, "en", 5)
  await context.setOffline(true)
  await expect(
    page.getByTestId("route-error").getByRole("alert")
  ).toContainText(
    "You seem to be offline. Check your connection, then try again."
  )
  await expect(page.locator("[data-error-retry]")).toBeDisabled()
  await capture(page, "en-desktop-offline")
  await context.setOffline(false)
  await expect(page.locator("[data-error-retry]")).toBeEnabled()
})

test("the reference can be copied and sent to support", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await open(page, "en", 5)
  const reference = await page
    .locator('[data-slot="error-reference"]')
    .innerText()
  expect(reference).toMatch(/^\d+$/)

  await page.getByRole("button", { name: "Copy reference" }).click()
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible()
  await capture(page, "en-desktop-copied")
  await expect(page.getByText("Reference copied")).toBeAttached()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    reference
  )
  await expect(
    page.getByRole("link", { name: "support@eleva.care" })
  ).toHaveAttribute(
    "href",
    `mailto:support@eleva.care?subject=${encodeURIComponent(`Eleva reference ${reference}`)}`
  )
  await expect(
    page.getByRole("link", { name: "Go to dashboard" })
  ).toHaveAttribute("href", /\/dashboard$/)
  // Nothing the error itself said reaches the page.
  await expect(
    page.getByTestId("route-error").getByText("fails on purpose")
  ).toHaveCount(0)
})

test("keyboard order follows reading order", async ({ page }) => {
  await open(page, "en", 5)
  await page.getByRole("button", { name: "Try again" }).focus()
  for (const name of ["Go to dashboard", "support@eleva.care"]) {
    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name })).toBeFocused()
  }
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("button", { name: "Copy reference" })
  ).toBeFocused()
})

for (const locale of ["pt", "es"]) {
  test(`reads in ${locale}, and fits a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await open(page, locale, 5)
    await expect(page.locator("body")).not.toContainText("routeStates.")
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(overflow).toBe(false)
    await capture(page, `${locale}-phone-error`)
    // A failed retry must not push the card taller on a phone.
    const card = page.getByTestId("route-error").locator("section")
    const before = await card.boundingBox()
    await page.locator("[data-error-retry]").press("Enter")
    await expect(
      page.getByTestId("route-error").getByRole("alert").locator("p").last()
    ).not.toBeEmpty()
    expect((await card.boundingBox())?.height).toBe(before?.height)
    await capture(page, `${locale}-phone-still-failing`)
  })

  test(`the full-page fallback's content reads in ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    await page.goto(`${POC_URL}/fixtures/global-error/${locale}`)
    await page.addStyleTag({ content: "nextjs-portal { display: none }" })
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.locator("[data-error-retry]")).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      )
    ).toBe(false)
    await capture(page, `${locale}-phone-fallback`)
  })
}

test("dark theme capture", async ({ page }) => {
  test.skip(!outDir, "captures only")
  await page.emulateMedia({ colorScheme: "dark" })
  await open(page, "en", 5)
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await capture(page, "en-desktop-dark")
  await page.setViewportSize({ width: 375, height: 760 })
  await capture(page, "en-phone-dark")
})

test("the full-page fallback's content, on a desktop", async ({ page }) => {
  test.skip(!outDir, "captures only")
  // On this page the playground sets the theme; the real fallback reads
  // Eleva's theme cookie, which a unit test covers.
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto(`${POC_URL}/fixtures/global-error/en`)
  await page.addStyleTag({ content: "nextjs-portal { display: none }" })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await capture(page, "en-desktop-fallback")
})
