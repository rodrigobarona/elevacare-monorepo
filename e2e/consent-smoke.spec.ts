import { expect, test } from "@playwright/test"

const webUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const c15tConfigured = Boolean(
  process.env.NEXT_PUBLIC_C15T_BACKEND_URL?.trim() ||
  process.env.E2E_CONSENT_SMOKE === "1"
)

test.describe("Cookie consent (c15t / Inth)", () => {
  test.beforeEach(async ({ context }) => {
    test.skip(
      !c15tConfigured,
      "Set NEXT_PUBLIC_C15T_BACKEND_URL or E2E_CONSENT_SMOKE=1 for consent smoke"
    )
    test.skip(
      !webUrl.includes("localhost") && process.env.E2E_CONSENT_SMOKE !== "1",
      "Consent smoke targets local prod build or E2E_CONSENT_SMOKE=1 on staging"
    )
    await context.clearCookies()
  })

  test("first visit shows banner; reject persists after reload", async ({
    page,
  }) => {
    await page.goto("/")
    const reject = page.getByRole("button", {
      name: /reject|decline|only necessary|necessary only|rejeitar|recusar|rechazar|opcionais|opcionales/i,
    })
    await expect(reject).toBeVisible({ timeout: 20_000 })
    await reject.click()

    await expect(reject).toBeHidden({ timeout: 10_000 })

    await page.reload()
    await expect(reject).toBeHidden({ timeout: 10_000 })
  })

  test("footer cookie settings reopens preferences", async ({ page }) => {
    await page.goto("/")
    const reject = page.getByRole("button", {
      name: /reject optional|rejeitar opcionais|rechazar opcionales/i,
    })
    if (await reject.isVisible().catch(() => false)) {
      await reject.click()
    }

    await page
      .getByRole("button", {
        name: /cookie settings|definições de cookies|configuración de cookies/i,
      })
      .click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 })
  })
})
