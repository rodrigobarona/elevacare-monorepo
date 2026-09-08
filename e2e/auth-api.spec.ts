import { expect, test } from "@playwright/test"
import {
  ACCOUNT_ORIGIN,
  E2E_PASSWORD,
  E2E_PASSWORD_NEXT,
  apiUrl,
  authHeaders,
  getSession,
  sessionCookie,
  signInEmail,
  signUpEmail,
  tokenFromAuthUrl,
  uniqueEmail,
  verifyEmail,
  waitForE2eAuthUrl,
} from "./helpers/auth"

const runAuthJourney = process.env.E2E_AUTH === "1"

test.describe("Better Auth CSRF", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with API running")

  test("rejects sign-up POST from an untrusted Origin", async ({ request }) => {
    const response = await request.post(`${apiUrl}/auth/sign-up/email`, {
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      data: {
        name: "Evil Origin",
        email: uniqueEmail("csrf"),
        password: E2E_PASSWORD,
      },
    })
    expect(response.status()).toBe(403)
  })
})

test.describe("Better Auth API", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with API running")

  test("sign-up, verify, session, Space, expert org, switch, reset, sign-out, magic link", async ({
    request,
  }) => {
    const email = uniqueEmail()
    const name = "E2e Member"

    const signedUp = await signUpEmail(request, {
      name,
      email,
      password: E2E_PASSWORD,
    })
    expect(signedUp.status()).toBe(200)
    const signupBody = (await signedUp.json()) as {
      token?: string | null
      user?: { email?: string; emailVerified?: boolean }
    }
    expect(signupBody.token).toBeNull()
    expect(signupBody.user?.email).toBe(email)
    expect(signupBody.user?.emailVerified).toBe(false)
    expect(
      await waitForE2eAuthUrl("verify-email", email),
      "verify-email link must be persisted (restart pnpm dev if this is stale)"
    ).toBeTruthy()

    const unverified = await signInEmail(request, {
      email,
      password: E2E_PASSWORD,
    })
    expect(unverified.status()).toBeGreaterThanOrEqual(400)

    await verifyEmail(request, email)

    const signedIn = await signInEmail(request, {
      email,
      password: E2E_PASSWORD,
    })
    expect(signedIn.status()).toBe(200)
    const cookie = sessionCookie(signedIn)
    expect(cookie).toBeTruthy()
    const signInBody = (await signedIn.json()) as {
      token?: string
      user?: { id?: string; email?: string; emailVerified?: boolean }
    }
    expect(signInBody.user?.email).toBe(email)
    expect(signInBody.user?.emailVerified).toBe(true)
    expect(signInBody.token).toBeTruthy()

    const session = await getSession(request, cookie!)
    expect(session.status()).toBe(200)
    const sessionBody = (await session.json()) as {
      user?: { id?: string; email?: string }
      session?: { activeOrganizationId?: string | null }
    }
    expect(sessionBody.user?.email).toBe(email)
    const userId = sessionBody.user?.id
    expect(userId).toBeTruthy()

    const orgs = await request.get(`${apiUrl}/auth/organization/list`, {
      headers: authHeaders(cookie!),
    })
    expect(orgs.status()).toBe(200)
    const orgList = (await orgs.json()) as Array<{
      id: string
      type?: string
      name?: string
    }>
    const personal = orgList.find((org) => org.type === "personal")
    expect(personal, "signup must provision a personal Space").toBeTruthy()
    expect(personal?.name).toMatch(/'s Space$/)

    const expertSlug = `e2e-expert-${Date.now()}`
    const created = await request.post(`${apiUrl}/auth/organization/create`, {
      headers: authHeaders(cookie!),
      data: {
        name: "E2e Expert",
        slug: expertSlug,
        type: "expert",
      },
    })
    expect(created.status()).toBe(200)
    const createdBody = (await created.json()) as {
      id?: string
      organization?: { id?: string }
    }
    const expertId = createdBody.id ?? createdBody.organization?.id
    expect(expertId).toBeTruthy()

    const switched = await request.post(
      `${apiUrl}/auth/organization/set-active`,
      {
        headers: authHeaders(cookie!),
        data: { organizationId: expertId },
      }
    )
    expect(switched.status()).toBe(200)

    const afterSwitch = await getSession(request, cookie!, {
      disableCookieCache: true,
    })
    const afterSwitchBody = (await afterSwitch.json()) as {
      session?: { activeOrganizationId?: string | null }
    }
    expect(afterSwitchBody.session?.activeOrganizationId).toBe(expertId)

    const reset = await request.post(`${apiUrl}/auth/request-password-reset`, {
      headers: authHeaders(),
      data: { email, redirectTo: `${ACCOUNT_ORIGIN}/reset-password` },
    })
    expect(reset.status()).toBe(200)
    const resetUrl = await waitForE2eAuthUrl("reset-password", email)
    const resetToken = resetUrl ? tokenFromAuthUrl(resetUrl) : null
    expect(resetToken, "reset-password link must include a token").toBeTruthy()

    const resetDone = await request.post(`${apiUrl}/auth/reset-password`, {
      headers: authHeaders(),
      data: { newPassword: E2E_PASSWORD_NEXT, token: resetToken },
    })
    expect(resetDone.status()).toBe(200)

    const oldPassword = await signInEmail(request, {
      email,
      password: E2E_PASSWORD,
    })
    expect(oldPassword.status()).toBeGreaterThanOrEqual(400)

    const afterReset = await signInEmail(request, {
      email,
      password: E2E_PASSWORD_NEXT,
    })
    expect(afterReset.status()).toBe(200)
    const afterResetBody = (await afterReset.json()) as { token?: string }
    expect(afterResetBody.token).toBeTruthy()
    const afterResetCookie = sessionCookie(afterReset)
    expect(afterResetCookie).toBeTruthy()

    const bearerSession = await request.get(`${apiUrl}/auth/get-session`, {
      headers: {
        Origin: ACCOUNT_ORIGIN,
        Authorization: `Bearer ${afterResetBody.token}`,
      },
    })
    expect(bearerSession.status()).toBe(200)
    const bearerBody = (await bearerSession.json()) as {
      user?: { email?: string }
    }
    expect(bearerBody.user?.email).toBe(email)

    const signedOut = await request.post(`${apiUrl}/auth/sign-out`, {
      headers: authHeaders(afterResetCookie!),
      data: {},
    })
    expect(signedOut.status()).toBe(200)
    const afterSignOut = await getSession(request, afterResetCookie!, {
      disableCookieCache: true,
    })
    expect(await afterSignOut.json()).toBeNull()

    const magic = await request.post(`${apiUrl}/auth/sign-in/magic-link`, {
      headers: authHeaders(),
      data: { email, callbackURL: `${ACCOUNT_ORIGIN}/dashboard` },
    })
    expect(magic.status()).toBe(200)
    const magicUrl = await waitForE2eAuthUrl("magic-link", email)
    expect(magicUrl, "magic-link URL must be persisted").toBeTruthy()
    const magicHit = await request.get(magicUrl!, {
      headers: { Origin: ACCOUNT_ORIGIN },
      maxRedirects: 0,
    })
    expect([200, 302]).toContain(magicHit.status())
  })
})

test.describe("Better Auth API extras", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with API running")

  test("wrong password is rejected", async ({ request }) => {
    const email = uniqueEmail("wrong")
    const signedUp = await signUpEmail(request, {
      name: "Wrong Pass",
      email,
      password: E2E_PASSWORD,
    })
    expect(signedUp.status()).toBe(200)
    await verifyEmail(request, email)

    const rejected = await signInEmail(request, {
      email,
      password: "Definitely-Wrong-Pass1",
    })
    expect(rejected.status()).toBeGreaterThanOrEqual(400)
  })

  test("JWKS is published", async ({ request }) => {
    const response = await request.get(`${apiUrl}/auth/jwks`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { keys?: unknown[] }
    expect(Array.isArray(body.keys)).toBe(true)
    expect((body.keys ?? []).length).toBeGreaterThan(0)
  })
})
