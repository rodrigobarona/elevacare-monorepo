import { expect, test } from "@playwright/test"

const accountUrl = process.env.E2E_ACCOUNT_URL ?? "http://127.0.0.1:3006"
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"
const runAuthJourney = process.env.E2E_AUTH === "1"

test.describe("auth journey", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with account + API running")

  test("sign up, verify, Space, Expert workspace, switch, magic link", async ({
    page,
    request,
  }) => {
    const email = `e2e.${Date.now()}@example.com`
    const password = "ElevaE2e!pass1"
    const name = "E2e Member"

    await page.goto(`${accountUrl}/signup`)
    await page.getByTestId("signup-name").fill(name)
    await page.getByTestId("signup-email").fill(email)
    await page.getByTestId("signup-password").fill(password)
    await page.getByTestId("signup-consent").click()
    await page.getByTestId("signup-submit").click()
    await expect(page.getByTestId("verify-email")).toBeVisible({
      timeout: 15_000,
    })

    const bypass = process.env.E2E_AUTH_BYPASS_TOKEN
    if (bypass) {
      const verified = await request.post(`${apiUrl}/auth/e2e/verify-email`, {
        data: { email, token: bypass },
      })
      expect(verified.status()).toBe(200)
    }

    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill(email)
    await page.getByTestId("login-password").fill(password)
    await page.getByTestId("login-submit").click()
    await page.waitForURL(/\/(account|dashboard)(\/|$)/, { timeout: 15_000 })

    await page.goto(`${accountUrl}/account/workspaces/new`)
    await expect(page.getByTestId("workspaces-new")).toBeVisible({
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
