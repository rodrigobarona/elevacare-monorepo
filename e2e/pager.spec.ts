import { mkdirSync } from "node:fs"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

/**
 * The footer of a paged list (`Pager` in `@eleva/ui`, used by the staff
 * queues) in a real browser, on a playground page that shows each state
 * (`apps/poc/src/app/fixtures/pager`). No database and no sign-in. Opt-in:
 * `pnpm e2e:pager` with `pnpm --filter @eleva/poc dev` running.
 * `DESIGN_CAPTURE_LABEL` also saves screenshots for the design audit.
 */
test.skip(
  process.env.E2E_PAGER !== "1",
  "set E2E_PAGER=1 (pnpm e2e:pager) with the playground running"
)

const POC_URL = process.env.E2E_POC_URL ?? "http://localhost:3099"
const label = process.env.DESIGN_CAPTURE_LABEL
const outDir = label
  ? path.join(process.cwd(), "docs/eleva-v3/design-audit/captures", label)
  : null

async function open(page: Page, locale = "en") {
  await page.goto(`${POC_URL}/fixtures/pager?locale=${locale}`)
  await page.addStyleTag({ content: "nextjs-portal { display: none }" })
  await expect(page.getByTestId("pager-middle")).toBeVisible()
}

async function capture(page: Page, name: string) {
  if (!outDir) return
  mkdirSync(outDir, { recursive: true })
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  })
}

test("says where the reader is, and links to the pages on either side", async ({
  page,
}) => {
  await open(page)
  const middle = page.getByTestId("pager-middle")
  await expect(middle).toContainText("Showing 26 to 50 of 112")
  const pages = middle.getByRole("navigation", { name: "Pages" })
  await expect(
    pages.getByRole("link", { name: "Previous page" })
  ).toHaveAttribute("href", /page=1$/)
  await expect(pages.getByRole("link", { name: "Next page" })).toHaveAttribute(
    "href",
    /page=3$/
  )
  // The visible word is part of the accessible name.
  await expect(pages.getByRole("link", { name: "Next page" })).toHaveText(
    "Next"
  )
  await capture(page, "en-desktop")
})

test("keeps an unavailable control in place, out of the tab order", async ({
  page,
}) => {
  await open(page)
  const first = page.getByTestId("pager-first")
  const previous = first.getByRole("link", { name: "Previous page" })
  await expect(previous).toHaveAttribute("aria-disabled", "true")
  await expect(previous).not.toHaveAttribute("href", /.*/)

  // Tab from the working control of the first table goes on to the next
  // table: the unavailable one is never a stop.
  await first.getByRole("link", { name: "Next page" }).focus()
  await page.keyboard.press("Shift+Tab")
  await expect(previous).not.toBeFocused()

  const last = page.getByTestId("pager-last")
  await expect(last.getByRole("link", { name: "Next page" })).toHaveAttribute(
    "aria-disabled",
    "true"
  )
  await expect(last).toContainText(
    "Showing 101 to 112 of 112 You’ve reached the end of the queue."
  )
  // The footer is the same height at either end as in the middle.
  const heights = await Promise.all(
    ["first", "middle", "last"].map(async (name) => {
      const box = await page
        .getByTestId(`pager-${name}`)
        .locator('[data-slot="pager"]')
        .boundingBox()
      return box?.height
    })
  )
  expect(new Set(heights).size).toBe(1)
})

test("shows the range alone when the list fits on one page", async ({
  page,
}) => {
  await open(page)
  const one = page.getByTestId("pager-one-page")
  await expect(one).toContainText("Showing 1 to 12 of 12")
  await expect(one.getByRole("navigation")).toHaveCount(0)
})

test("works from the keyboard, Previous before Next", async ({ page }) => {
  await open(page)
  const pages = page
    .getByTestId("pager-middle")
    .getByRole("navigation", { name: "Pages" })
  await pages.getByRole("link", { name: "Previous page" }).focus()
  await page.keyboard.press("Tab")
  await expect(pages.getByRole("link", { name: "Next page" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/state=middle&page=3$/)
})

test("reads in Portuguese and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await open(page, "pt")
  const middle = page.getByTestId("pager-middle")
  await expect(middle).toContainText("A mostrar 26 a 50 de 112")
  await expect(
    middle.getByRole("link", { name: "Página seguinte" })
  ).toHaveText("Seguinte")
  await expect(page.getByTestId("pager-last")).toContainText(
    "Chegou ao fim da fila."
  )
  // The range sits above the two controls, which share a row.
  const range = await middle.locator("#range-middle").boundingBox()
  const next = await middle
    .getByRole("link", { name: "Página seguinte" })
    .boundingBox()
  const previous = await middle
    .getByRole("link", { name: "Página anterior" })
    .boundingBox()
  expect(range!.y + range!.height).toBeLessThanOrEqual(next!.y)
  expect(previous!.y).toBe(next!.y)
  // Targets are at least 24 px, with room between them.
  expect(next!.height).toBeGreaterThanOrEqual(24)
  expect(next!.x - (previous!.x + previous!.width)).toBeGreaterThanOrEqual(8)
  await capture(page, "pt-phone")
  await page.setViewportSize({ width: 320, height: 900 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false)
})

test("dark theme capture", async ({ page }) => {
  test.skip(!outDir, "captures only")
  await page.emulateMedia({ colorScheme: "dark" })
  await open(page)
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await capture(page, "en-desktop-dark")
})
