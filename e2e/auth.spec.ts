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
import { isNonLoopbackE2eTarget } from "./helpers/local"

const runAuthJourney = process.env.E2E_AUTH === "1"

test.describe("auth screens", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with account + API running")
  test.skip(
    isNonLoopbackE2eTarget(),
    "auth e2e must not run against non-loopback hosts"
  )

  test("login, signup, reset-password, and verify-email pages render", async ({
    page,
  }) => {
    await page.goto(`${accountUrl}/login`)
    await expect(page.getByTestId("login-email-form")).toBeVisible()
    await expect(page.getByTestId("login-google")).toBeVisible()
    await expect(page.getByTestId("login-password")).toHaveCount(0)
    await page.getByTestId("login-email").fill("nobody@example.com")
    await page.getByTestId("login-continue").click()
    await expect(page.getByTestId("login-form")).toBeVisible()
    await expect(page.getByTestId("auth-email-chip")).toContainText(
      "nobody@example.com"
    )
    await expect(page.getByTestId("login-password")).toBeVisible()
    await expect(page.getByTestId("login-magic")).toBeVisible()
    await expect(page.getByTestId("login-forgot-password")).toBeVisible()
    await page.getByTestId("auth-change-email").click()
    await expect(page.getByTestId("login-email")).toHaveValue(
      "nobody@example.com"
    )

    await page.goto(`${accountUrl}/signup`)
    await expect(page.getByTestId("signup-email-form")).toBeVisible()
    await page.getByTestId("signup-email").fill("nobody@example.com")
    await page.getByTestId("signup-continue").click()
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

  // UI mapping only — same-email Google now implicit-links (ADR-017 2026-10-23).
  // Live OAuth link-on-sign-in is operator-gated (google-oauth-setup.md).
  test("Google account_not_linked lands on login with guidance", async ({
    page,
  }) => {
    await page.goto(`${accountUrl}/login?error=account_not_linked`)
    await expect(page.getByTestId("login-error")).toContainText(
      /already has an Eleva account/
    )
  })

  test("signup without consent stays on the form", async ({ page }) => {
    await page.goto(`${accountUrl}/signup`)
    await page.getByTestId("signup-email").fill(uniqueEmail("consent"))
    await page.getByTestId("signup-continue").click()
    await page.getByTestId("signup-name").fill("No Consent")
    await page.getByTestId("signup-password").fill(E2E_PASSWORD)
    await page.getByTestId("signup-submit").click()
    await expect(page.getByTestId("signup-error")).toBeVisible()
    await expect(page.getByTestId("signup-form")).toBeVisible()
  })

  test("wrong password shows an error", async ({ page }) => {
    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill("nobody@example.com")
    await page.getByTestId("login-continue").click()
    await page.getByTestId("login-password").fill(E2E_PASSWORD_WRONG)
    await page.getByTestId("login-submit").click()
    await expect(page.getByTestId("login-error")).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("auth journey", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with account + API running")
  test.skip(
    isNonLoopbackE2eTarget(),
    "auth e2e must not run against non-loopback hosts"
  )

  test("sign up, verify, password sign-in, reset request, magic link", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail()
    const name = "E2e Member"

    await page.goto(`${accountUrl}/signup`)
    await page.getByTestId("signup-email").fill(email)
    await page.getByTestId("signup-continue").click()
    await page.getByTestId("signup-name").fill(name)
    await page.getByTestId("signup-password").fill(E2E_PASSWORD)
    await page.getByTestId("signup-consent").click()
    await page.getByTestId("signup-submit").click()
    await expect(page.getByTestId("verify-email")).toBeVisible({
      timeout: 15_000,
    })

    await verifyEmail(request, email)

    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill(email)
    await page.getByTestId("login-continue").click()
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
    await page.getByTestId("login-continue").click()
    await page.getByTestId("login-magic").click()
    await expect(page.getByTestId("login-magic-sent")).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("onboarding with an existing Space", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with account + API running")
  test.skip(
    isNonLoopbackE2eTarget(),
    "auth e2e must not run against non-loopback hosts"
  )

  // Regression: /onboarding wrote the last-org cookie while rendering, which
  // Next.js forbids, so anyone who already had a membership (an invited
  // member, or someone opening /onboarding again) got the error page.
  test("sends a person who already has a Space on to it", async ({ page }) => {
    const email = uniqueEmail("onboarding-again")
    const signup = await page.request.post(`${apiUrl}/auth/sign-up/email`, {
      headers: { Origin: ACCOUNT_ORIGIN, "Content-Type": "application/json" },
      data: { name: "Onboarding Again", email, password: E2E_PASSWORD },
    })
    expect(signup.status()).toBe(200)
    await verifyEmail(page.request, email)
    const signIn = await page.request.post(`${apiUrl}/auth/sign-in/email`, {
      headers: { Origin: ACCOUNT_ORIGIN, "Content-Type": "application/json" },
      data: { email, password: E2E_PASSWORD },
    })
    expect(signIn.status()).toBe(200)

    // Sign-up already made her Space, so onboarding forwards to it.
    const response = await page.goto(`${accountUrl}/onboarding`)
    expect(response?.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/space-[a-z0-9]+/, { timeout: 30_000 })
    await expect(page.getByText(/having trouble/i)).toHaveCount(0)

    // The continue step only remembers a value shaped like an org slug.
    const crafted = await page.request.get(
      `${accountUrl}/onboarding/continue?org=${encodeURIComponent("../admin")}`,
      { maxRedirects: 0 }
    )
    expect([302, 303, 307]).toContain(crafted.status())
    expect(new URL(crafted.headers()["location"]!).pathname).toBe("/dashboard")
    const setCookies = crafted
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value)
    expect(setCookies.some((value) => value.includes("eleva-last-org"))).toBe(
      false
    )
  })
})
