/**
 * AUD-049 passkey evidence — opt-in via E2E_PASSKEY=1. Needs the API on
 * loopback with PASSKEY_RP_ID=localhost (the default RP ID is eleva.care),
 * the account app, and E2E_AUTH_CAPTURE=1 for email verification.
 */
import { expect, test } from "@playwright/test"
import {
  E2E_PASSWORD,
  accountUrl,
  getSession,
  sessionCookie,
  signInEmail,
  signUpEmail,
  uniqueEmail,
  verifyEmail,
} from "./helpers/auth"
import { isNonLoopbackE2eTarget } from "./helpers/local"

const runPasskey = process.env.E2E_PASSKEY === "1"

test.describe("passkey sign-in", () => {
  test.skip(!runPasskey, "Set E2E_PASSKEY=1 with API (PASSKEY_RP_ID=localhost)")
  test.skip(
    isNonLoopbackE2eTarget(),
    "auth e2e must not run against non-loopback hosts"
  )

  test("register a passkey in settings, then sign in with it", async ({
    browserName,
    context,
    page,
    request,
  }) => {
    test.skip(browserName !== "chromium", "virtual authenticator is CDP-only")
    test.setTimeout(120_000)

    const cdp = await context.newCDPSession(page)
    await cdp.send("WebAuthn.enable")
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    const email = uniqueEmail("passkey")
    const signUp = await signUpEmail(request, {
      name: "Passkey Member",
      email,
      password: E2E_PASSWORD,
    })
    expect(signUp.ok()).toBe(true)
    await verifyEmail(request, email)
    const signIn = await signInEmail(request, { email, password: E2E_PASSWORD })
    expect(signIn.ok()).toBe(true)
    await context.addCookies(cookiesFor(sessionCookie(signIn)))

    await page.goto(`${accountUrl}/account/settings`)
    await page.getByTestId("settings-add-passkey").click()
    await expect(
      page.getByTestId("settings-passkeys").locator("li")
    ).toHaveCount(1, { timeout: 20_000 })

    await context.clearCookies()
    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-passkey").click()
    await expect
      .poll(
        async () => {
          const header = (await context.cookies())
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join("; ")
          if (!header) return null
          const session = await getSession(request, header, {
            disableCookieCache: true,
          })
          const body = (await session.json()) as {
            user?: { email?: string }
          } | null
          return body?.user?.email ?? null
        },
        { timeout: 20_000 }
      )
      .toBe(email)
  })
})

function cookiesFor(header: string | null) {
  expect(header, "sign-in returned a session cookie").toBeTruthy()
  return (header ?? "").split("; ").map((pair) => {
    const index = pair.indexOf("=")
    return {
      name: pair.slice(0, index),
      value: pair.slice(index + 1),
      url: accountUrl,
    }
  })
}
