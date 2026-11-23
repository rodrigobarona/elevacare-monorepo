import { mkdirSync } from "node:fs"
import path from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"

/**
 * The "sign in again" notices of a staff decision (slice 12.7) in a real
 * browser, on a playground page that shows each state with the console's
 * own words (`apps/poc/src/app/fixtures/sign-in-again`). No database and
 * no sign-in: it proves how the notices look and read, not the journey
 * (that is `e2e/admin-clinics.spec.ts`). Opt-in: `pnpm e2e:sign-in-again`
 * with `pnpm --filter @eleva/poc dev` running. `DESIGN_CAPTURE_LABEL`
 * also saves screenshots for the design audit.
 */
test.skip(
  process.env.E2E_SIGN_IN_AGAIN !== "1",
  "set E2E_SIGN_IN_AGAIN=1 (pnpm e2e:sign-in-again) with the playground running"
)

const POC_URL = process.env.E2E_POC_URL ?? "http://localhost:3099"
const label = process.env.DESIGN_CAPTURE_LABEL
const outDir = label
  ? path.join(
      process.cwd(),
      "docs/eleva-v3/design-audit/captures",
      label,
      "states"
    )
  : null

async function open(page: Page, locale = "en", dark = false) {
  if (dark) await page.emulateMedia({ colorScheme: "dark" })
  await page.goto(`${POC_URL}/fixtures/sign-in-again?locale=${locale}`)
  await page.addStyleTag({ content: "nextjs-portal { display: none }" })
  if (dark) {
    await page.evaluate(() => document.documentElement.classList.add("dark"))
  }
  await expect(page.getByTestId("state-banner")).toBeVisible()
}

async function capture(page: Page, state: string, name: string) {
  if (!outDir) return
  mkdirSync(outDir, { recursive: true })
  await page.getByTestId(`state-${state}`).screenshot({
    path: path.join(outDir, `${name}.png`),
    animations: "disabled",
  })
}

const notice = (page: Page, state: string) =>
  page.getByTestId(`state-${state}`).getByTestId("notice")

/**
 * Where a notice, its words and its button are, read in one go: the page
 * scrolls by itself when it opens (a notice takes focus, an answer comes
 * into view), and two readings apart would not be of the same moment.
 */
const places = (shown: Locator) =>
  shown.evaluate((node) => {
    const place = (element: Element | null) => {
      const box = element!.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    return {
      notice: place(node),
      words: place(node.querySelector('[data-testid="sign-in-again-words"]')),
      button: place(node.querySelector("button")),
    }
  })

test("the banner says why, in the rule's own number, with one button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page)
  const banner = notice(page, "banner")
  await expect(banner).toHaveAttribute("role", "note")
  await expect(banner).toContainText("Sign in again before you decide")
  await expect(banner).toContainText(
    "You signed in more than 12 hours ago. A decision needs a sign-in from the last 12 hours, so a console left open longer than that can't be used to decide in your name. What you tick and write here stays in this tab while you sign in."
  )
  await expect(banner.getByRole("button")).toHaveCount(1)
  await expect(banner.getByRole("button")).toHaveText("Sign in again")
  // Calm: the notice's ground and text, not the red of a refusal.
  await expect(banner).not.toHaveClass(/destructive/)
  // Wide enough for both: the button sits beside the words.
  const { words, button } = await places(banner)
  expect(button.x).toBeGreaterThan(words.x + words.width - 1)
  await capture(page, "banner", "banner.en.desktop")
  await capture(page, "banner-not-kept", "banner-not-kept.en.desktop")
})

test("the answer to a press comes after the buttons, and its words are the alert", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page)
  for (const [state, button] of [
    ["refused-reason", "Ask for changes"],
    ["refused-approve", "Approve"],
  ] as const) {
    const refusal = notice(page, state)
    // Below the button that was pressed, so that button did not move.
    const { pressedY, refusalY } = await page
      .getByTestId(`state-${state}`)
      .evaluate((section, name) => {
        const pressed = [...section.querySelectorAll("button")].find(
          (candidate) => candidate.textContent?.trim() === name
        )!
        return {
          pressedY: pressed.getBoundingClientRect().y,
          refusalY: section
            .querySelector('[data-testid="notice"]')!
            .getBoundingClientRect().y,
        }
      }, button)
    expect(refusalY).toBeGreaterThan(pressedY)
    // The first words stand out as a title.
    const title = refusal.locator('[data-slot="alert-title"]')
    await expect(title).toHaveText("That decision wasn't saved.")
    // Only the words are the alert: the button is outside it.
    const alert = refusal.getByRole("alert")
    await expect(alert).toHaveCount(1)
    await expect(alert).toContainText("That decision wasn't saved.")
    await expect(alert.getByRole("button")).toHaveCount(0)
    await capture(page, state, `${state}.en.desktop`)
  }
  // While the tab is leaving the label changes and the button keeps its width.
  const resting = (await places(notice(page, "refused-reason"))).button
  const leaving = notice(page, "refused-leaving")
  await expect(leaving.getByRole("button")).toHaveText("Opening...")
  expect((await places(leaving)).button.width).toBeCloseTo(resting.width, 0)
  await capture(page, "refused-leaving", "refused-leaving.en.desktop")
  // A sign-out that failed is said under the button, in words.
  await expect(
    notice(page, "refused-sign-out-failed").getByTestId("sign-in-again-failure")
  ).toHaveText("We couldn't open the sign-in page. Try again in a moment.")
  await capture(
    page,
    "refused-sign-out-failed",
    "refused-sign-out-failed.en.desktop"
  )
})

test("the notice after the return is told apart from the warning, and takes the keyboard's place", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page)
  const focused = notice(page, "restored-focused")
  await expect(focused).toBeFocused()
  // Named by its words, so a screen reader says all of them on focus.
  await expect(focused).toHaveAccessibleName(
    "You're signed in again. What you entered is still here. Check it, then decide."
  )
  await expect(focused.getByRole("button")).toHaveCount(0)
  await capture(page, "restored-focused", "restored-focused.en.desktop")
  await capture(page, "restored", "restored.en.desktop")
  // Good news has its own ground; "the checks are unticked" does not.
  const ground = (state: string) =>
    notice(page, state).evaluate(
      (node) => getComputedStyle(node).backgroundColor
    )
  expect(await ground("restored")).not.toBe(await ground("new-details"))
  expect(await ground("new-details")).toBe(await ground("lapsed"))
  for (const state of ["new-details", "lapsed", "renewed"]) {
    await capture(page, state, `${state}.en.desktop`)
  }
})

test("beside the console's sidebar, and on a phone, the button goes under the words", async ({
  page,
}) => {
  for (const [width, name] of [
    [800, "tablet"],
    [390, "phone"],
    [320, "narrow"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 })
    await open(page)
    for (const state of ["banner", "refused-reason"]) {
      const { words, button } = await places(notice(page, state))
      expect(button.y, `${state} at ${width}`).toBeGreaterThan(
        words.y + words.height - 1
      )
      expect(button.height).toBeGreaterThanOrEqual(24)
      await capture(page, state, `${state}.en.${name}`)
    }
    // Nothing runs off the side.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      ),
      `sideways scroll at ${width}`
    ).toBe(true)
  }
  // On a phone the button takes the notice's width.
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page)
  const phone = await places(notice(page, "banner"))
  expect(phone.button.width).toBeGreaterThan(phone.notice.width * 0.85)
})

test("Portuguese and Spanish, and the dark theme", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, "pt")
  await expect(notice(page, "banner")).toContainText(
    "Iniciou sessão há mais de 12 horas. Uma decisão precisa de um início de sessão das últimas 12 horas"
  )
  await expect(
    notice(page, "refused-reason").locator('[data-slot="alert-title"]')
  ).toHaveText("Essa decisão não foi guardada.")
  await capture(page, "banner", "banner.pt.desktop")
  await capture(page, "refused-reason", "refused-reason.pt.desktop")
  // The longest label: the row still holds at the width where it begins.
  await page.setViewportSize({ width: 1024, height: 900 })
  await open(page, "pt")
  await capture(page, "banner", "banner.pt.1024")

  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, "es")
  await expect(notice(page, "banner")).toContainText(
    "Iniciaste sesión hace más de 12 horas. Una decisión necesita un inicio de sesión de las últimas 12 horas"
  )
  await expect(
    notice(page, "refused-reason").locator('[data-slot="alert-title"]')
  ).toHaveText("Esa decisión no se ha guardado.")
  await capture(page, "banner", "banner.es.desktop")
  await capture(page, "refused-reason", "refused-reason.es.desktop")

  await open(page, "en", true)
  for (const state of ["banner", "refused-reason", "restored", "new-details"]) {
    await capture(page, state, `${state}.en.desktop.dark`)
  }
  await page.setViewportSize({ width: 390, height: 900 })
  await open(page, "pt", true)
  await capture(page, "banner", "banner.pt.phone.dark")
  await capture(page, "refused-reason", "refused-reason.pt.phone.dark")
  await page.emulateMedia({ colorScheme: "light" })
  await open(page, "en")
  await capture(page, "restored", "restored.en.phone")
})
