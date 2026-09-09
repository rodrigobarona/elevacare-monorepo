import { expect, type Frame, type Page } from "@playwright/test"

export const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"

export function uniqueGuestEmail(prefix = "booking"): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

export async function walkFunnelToDetails(page: Page): Promise<void> {
  const continueMeet = page.getByTestId("booking-continue-meet")
  const whenHeading = page.getByTestId("booking-when-heading")
  await expect(continueMeet.or(whenHeading)).toBeVisible({ timeout: 15_000 })

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
  await expect(page.getByTestId("booking-slots-loading")).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(page.getByTestId("booking-slots-error")).toHaveCount(0)

  const picker = page.locator("[data-slot='slot-picker']")
  await expect(picker).toBeVisible()
  const dayWithSlots = picker.getByTestId("booking-slot-day")
  await expect(dayWithSlots.first()).toBeVisible({ timeout: 15_000 })
  await dayWithSlots.last().click()

  const time = picker.getByTestId("booking-slot-time")
  await expect(time.first()).toBeVisible({ timeout: 10_000 })
  await time.first().click()
  await page.getByTestId("booking-continue-when").click()
  await expect(page.getByTestId("booking-guest-name")).toBeVisible()
}

export async function fillGuestAndConsents(
  page: Page,
  guest: { name: string; email: string }
): Promise<void> {
  await page.getByTestId("booking-guest-name").fill(guest.name)
  await page.getByTestId("booking-guest-email").fill(guest.email)
  for (const kind of ["terms", "privacy", "health_data_processing"] as const) {
    // React Aria: the visual box is a <label> that intercepts the hidden input.
    // Do not click the wrapper — the legal <a> would open a new tab.
    await page
      .getByTestId(`booking-consent-${kind}`)
      .locator('[data-slot="checkbox"]')
      .click()
  }
}

const CARD_NUMBER = "4242424242424242"
const CARD_FIELD =
  'input[name="number"], input[autocomplete="cc-number"], input[placeholder*="1234"]'

async function clickStripeCardTab(frame: Frame): Promise<void> {
  const tab = frame
    .getByRole("tab", { name: /^card$/i })
    .or(frame.getByRole("button", { name: /^card$/i }))
  if ((await tab.count()) > 0 && (await tab.first().isVisible())) {
    await tab.first().click()
  }
}

async function fillFirstVisible(
  frames: Frame[],
  selector: string,
  value: string
): Promise<boolean> {
  for (const frame of frames) {
    const field = frame.locator(selector).first()
    if ((await field.count()) === 0) continue
    if (!(await field.isVisible().catch(() => false))) continue
    await field.click()
    await field.fill("")
    await field.pressSequentially(value, { delay: 15 })
    return true
  }
  return false
}

export async function fillStripeTestCard(page: Page): Promise<void> {
  await expect(page.getByTestId("booking-pay-submit")).toBeEnabled({
    timeout: 20_000,
  })

  let cardFrame: Frame | undefined
  await expect
    .poll(
      async () => {
        for (const frame of page.frames()) {
          await clickStripeCardTab(frame)
          const number = frame.locator(CARD_FIELD).first()
          if (
            (await number.count()) > 0 &&
            (await number.isVisible().catch(() => false))
          ) {
            cardFrame = frame
            return true
          }
        }
        return false
      },
      { timeout: 20_000 }
    )
    .toBeTruthy()

  if (!cardFrame) {
    throw new Error("Stripe Payment Element card frame did not load")
  }

  const frames = page.frames()
  const filledNumber = await fillFirstVisible(frames, CARD_FIELD, CARD_NUMBER)
  if (!filledNumber) {
    throw new Error("Stripe card number field not found in any frame")
  }
  await fillFirstVisible(
    frames,
    'input[name="expiry"], input[autocomplete="cc-exp"], input[placeholder*="MM"]',
    "1234"
  )
  await fillFirstVisible(
    frames,
    'input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC"]',
    "123"
  )
  await fillFirstVisible(
    frames,
    'input[name="postalCode"], input[autocomplete="postal-code"], input[placeholder*="ZIP"], input[placeholder*="Postal"]',
    "12345"
  )
}
