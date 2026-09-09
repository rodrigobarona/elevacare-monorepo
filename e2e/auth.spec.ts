import { expect, test } from "@playwright/test"
import {
  ACCOUNT_ORIGIN,
  E2E_PASSWORD,
  E2E_PASSWORD_WRONG,
  accountUrl,
  apiUrl,
  uniqueEmail,
  verifyEmail,
} from "./helpers/auth"

const runAuthJourney = process.env.E2E_AUTH === "1"

test.describe("auth screens", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with account + API running")

  test("login, signup, reset-password, and verify-email pages render", async ({
    page,
  }) => {
    await page.goto(`${accountUrl}/login`)
    await expect(page.getByTestId("login-form")).toBeVisible()
    await expect(page.getByTestId("login-email")).toBeVisible()
    await expect(page.getByTestId("login-password")).toBeVisible()
    await expect(page.getByTestId("login-magic")).toBeVisible()
    await expect(page.getByTestId("login-forgot-password")).toBeVisible()

    await page.goto(`${accountUrl}/signup`)
    await expect(page.getByTestId("signup-form")).toBeVisible()
    await expect(page.getByTestId("signup-consent")).toBeVisible()

    await page.goto(`${accountUrl}/reset-password`)
    await expect(page.getByTestId("reset-password-form")).toBeVisible()
    await expect(page.getByTestId("reset-email")).toBeVisible()

    await page.goto(`${accountUrl}/verify-email`)
    await expect(page.getByTestId("verify-email")).toBeVisible()

    await page.goto(`${accountUrl}/two-factor`)
    await expect(page.getByTestId("two-factor-form")).toBeVisible()
  })

  test("signup without consent stays on the form", async ({ page }) => {
    await page.goto(`${accountUrl}/signup`)
    await page.getByTestId("signup-name").fill("No Consent")
    await page.getByTestId("signup-email").fill(uniqueEmail("consent"))
    await page.getByTestId("signup-password").fill(E2E_PASSWORD)
    await page.getByTestId("signup-submit").click()
    await expect(page.getByTestId("signup-error")).toBeVisible()
    await expect(page.getByTestId("signup-form")).toBeVisible()
  })

  test("wrong password shows an error", async ({ page }) => {
    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill("nobody@example.com")
    await page.getByTestId("login-password").fill(E2E_PASSWORD_WRONG)
    await page.getByTestId("login-submit").click()
    await expect(page.getByTestId("login-error")).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("auth journey", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with account + API running")

  test("sign up, verify, password sign-in, reset request, magic link", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail()
    const name = "E2e Member"

    await page.goto(`${accountUrl}/signup`)
    await page.getByTestId("signup-name").fill(name)
    await page.getByTestId("signup-email").fill(email)
    await page.getByTestId("signup-password").fill(E2E_PASSWORD)
    await page.getByTestId("signup-consent").click()
    await page.getByTestId("signup-submit").click()
    await expect(page.getByTestId("verify-email")).toBeVisible({
      timeout: 15_000,
    })

    await verifyEmail(request, email)

    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill(email)
    await page.getByTestId("login-password").fill(E2E_PASSWORD)
    const signedIn = page.waitForResponse(
      (response) =>
        response.url().includes("/auth/sign-in/email") && response.ok()
    )
    await page.getByTestId("login-submit").click()
    await signedIn
    const session = await page.request.get(`${apiUrl}/auth/get-session`, {
      headers: { Origin: ACCOUNT_ORIGIN },
    })
    expect(session.status()).toBe(200)
    const sessionBody = (await session.json()) as { user?: { email?: string } }
    expect(sessionBody.user?.email).toBe(email)
    await page.waitForLoadState("domcontentloaded")

    await page.goto(`${accountUrl}/reset-password`)
    await expect(page.getByTestId("reset-password-form")).toBeVisible()
    await page.getByTestId("reset-email").fill(email)
    await page.getByTestId("reset-submit").click()
    await expect(page.getByTestId("reset-done")).toBeVisible({
      timeout: 15_000,
    })

    await page.goto(`${accountUrl}/logout`)
    await page.getByTestId("logout-submit").click()

    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill(email)
    await page.getByTestId("login-magic").click()
    await expect(page.getByTestId("login-magic-sent")).toBeVisible({
      timeout: 15_000,
    })
  })
})
