import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test"
import {
  ACCOUNT_ORIGIN,
  E2E_PASSWORD,
  accountUrl,
  apiUrl,
  authHeaders,
  uniqueEmail,
  verifyEmail,
  waitForE2eAuthUrl,
} from "./helpers/auth"
import {
  fillGuestAndConsents,
  fillStripeTestCard,
  uniqueGuestEmail,
  walkFunnelToDetails,
} from "./helpers/booking"
import {
  isNonLoopbackE2eTarget,
  PAID_EXPERT,
  PAID_OFFER,
  webUrl,
} from "./helpers/local"

const runMemberJourney = process.env.E2E_MEMBER === "1"
const runLiveStripe = process.env.E2E_LIVE_STRIPE === "1"
const CANCEL_MIN_START = () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)

function cookieHeaderFromPage(
  cookies: Array<{ name: string; value: string }>
): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

const SPACE_PATH_RE = /\/space-[a-z0-9]+/

/**
 * After sign-in / magic-link, the app may already redirect to the personal
 * Space. A second goto(/dashboard) then races and throws net::ERR_ABORTED.
 */
async function landOnPersonalSpace(page: Page): Promise<string> {
  const onSpace = () => SPACE_PATH_RE.test(new URL(page.url()).pathname)
  if (!onSpace()) {
    try {
      await page.waitForURL(SPACE_PATH_RE, { timeout: 3_000 })
    } catch {
      await page
        .goto(`${webUrl}/dashboard`, { waitUntil: "domcontentloaded" })
        .catch(() => undefined)
    }
  }
  await expect(page).toHaveURL(SPACE_PATH_RE, { timeout: 20_000 })
  const spaceSlug = new URL(page.url()).pathname.split("/").filter(Boolean)[0]
  expect(spaceSlug).toMatch(/^space-/)
  return spaceSlug
}

test.describe("member e2e target", () => {
  test("does not run auth or member journeys against non-loopback hosts", () => {
    expect(
      isNonLoopbackE2eTarget(),
      "Auth and member e2e must stay on loopback (localhost / 127.0.0.1 / ::1). Do not set E2E_*_URL to staging or Production."
    ).toBe(false)
  })
})

test.describe("member Space journey", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(
    !runMemberJourney,
    "Set E2E_MEMBER=1 E2E_SKIP_WEBSERVER=1 with pnpm dev (web, api, app, account)"
  )
  test.skip(
    isNonLoopbackE2eTarget(),
    "member e2e must not run against non-loopback hosts"
  )

  test("guest magic-link activation shows the booking, persists a preference, requests DSAR, and cancels within policy", async ({
    page,
    request,
  }) => {
    // Cold Turbopack first compile of /bookings/reserve + /payments/intent
    // can consume well over 2 minutes on a fresh local stack.
    test.setTimeout(360_000)
    test.skip(
      !runLiveStripe,
      "set E2E_LIVE_STRIPE=1 to book the seeded paid offer fisiomota / first-visit / €60 (never anaquick)"
    )
    test.skip(
      !process.env.STRIPE_PMC_BOOKING,
      "set STRIPE_PMC_BOOKING before creating a live hold"
    )
    test.skip(
      !process.env.CONSENT_HASH_KEY || process.env.CONSENT_HASH_KEY.length < 32,
      "set CONSENT_HASH_KEY (32+ chars) before creating a live hold"
    )

    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")

    const offer = await page.goto(`/${PAID_EXPERT}/${PAID_OFFER}`)
    test.skip(
      offer?.status() !== 200,
      "needs seeded fisiomota / first-visit (€60) from db:seed:demo"
    )

    const email = uniqueGuestEmail("member")
    await walkFunnelToDetails(page, { minStart: CANCEL_MIN_START() })
    await fillGuestAndConsents(page, { name: "E2E Member", email })

    const reserve = page.waitForResponse(
      (res) =>
        res.url().includes("/bookings/reserve") &&
        res.request().method() === "POST"
    )
    const intent = page.waitForResponse(
      (res) =>
        res.url().includes("/payments/intent") &&
        res.request().method() === "POST"
    )
    await page.getByTestId("booking-continue-details").click()
    const reserveResponse = await reserve
    if (reserveResponse.status() !== 201) {
      void intent.catch(() => undefined)
      const body = await reserveResponse.text().catch(() => "")
      throw new Error(
        `POST /bookings/reserve returned ${reserveResponse.status()}: ${body.slice(0, 300)}`
      )
    }
    const intentResponse = await intent
    test.skip(
      ![200, 201].includes(intentResponse.status()),
      `POST /payments/intent returned ${intentResponse.status()}`
    )

    await fillStripeTestCard(page)
    const confirm = page.waitForResponse(
      (res) =>
        res.url().includes("/bookings/confirm") &&
        res.request().method() === "POST",
      // Cold compile of /bookings/confirm can exceed 45s on first hit.
      { timeout: 120_000 }
    )
    const pay = page.getByTestId("booking-pay-submit")
    await pay.scrollIntoViewIfNeeded()
    await pay.evaluate((el: HTMLButtonElement) => {
      el.closest("form")?.requestSubmit(el)
    })
    const stripeError = page
      .locator("form")
      .getByRole("alert")
      .filter({ hasText: /\S/ })
    await expect(
      page.getByTestId("booking-done-heading").or(stripeError)
    ).toBeVisible({ timeout: 45_000 })
    if (await stripeError.isVisible()) {
      throw new Error(
        `Stripe Payment Element: ${await stripeError.innerText()}`
      )
    }
    const confirmResponse = await confirm
    expect([200, 201]).toContain(confirmResponse.status())
    const confirmBody = (await confirmResponse.json()) as { bookingId?: string }
    const bookingId = confirmBody.bookingId
    expect(bookingId).toBeTruthy()
    await expect(page.getByTestId("booking-done-heading")).toHaveAttribute(
      "data-state",
      "confirmed",
      { timeout: 45_000 }
    )

    try {
      const magicUrl = await waitForE2eAuthUrl("magic-link", email, 20_000)
      if (!magicUrl) {
        throw new Error(
          "magic-link URL missing — set E2E_AUTH_CAPTURE=1 and restart pnpm dev"
        )
      }

      await page.goto(magicUrl)
      const spaceSlug = await landOnPersonalSpace(page)

      const bookingCard = page.getByTestId("member-booking-card")
      await expect(bookingCard.first()).toBeVisible({ timeout: 15_000 })
      await expect(bookingCard.first()).toHaveAttribute(
        "data-expert",
        PAID_EXPERT
      )
      await expect(page.getByText(/€\s?60|60,00\s?€|€60/)).toBeVisible()

      await persistMarketingPreference(page, request, spaceSlug)
      await assertMemberConsentsApi(page, request, spaceSlug)
      await requestDsarWithMockedBlob(page, request, spaceSlug)

      await page.goto(`/${spaceSlug}`)
      const detail = page.getByTestId("member-booking-detail").first()
      await expect(detail).toBeVisible({ timeout: 15_000 })
      // LinkButton client-routes via AppRouterProvider on the rewritten app
      // zone; a soft nav can leave the Playwright page on Space home. Full
      // load through the gateway guarantees /sessions/[id] hits the app.
      const detailHref = await detail.getAttribute("href")
      expect(detailHref).toMatch(/\/sessions\/[a-f0-9-]+/)
      await page.goto(
        detailHref!.startsWith("http") ? detailHref! : `${webUrl}${detailHref}`
      )
      await assertHealthConsentBlockedWhileBooked(page, request)
      await assertPaymentsListShowsBooking(page, request, spaceSlug, bookingId!)
      const cancel = page.getByTestId("member-cancel-session")
      await expect(cancel).toBeVisible({ timeout: 20_000 })
      await expect(cancel).toBeEnabled()
      await cancel.click()
      await page.getByTestId("member-cancel-confirm").click()
      await expect(page.getByText(/Session cancelled/i)).toBeVisible({
        timeout: 15_000,
      })
      // Soft router.push under the gateway rewrite can leave Playwright on
      // the detail page; hard-load the sessions list to assert outcome.
      await page.goto(`${webUrl}/${spaceSlug}/sessions`)
      await expect(
        page
          .locator(
            '[data-testid="member-booking-card"][data-status="cancelled"]'
          )
          .first()
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      await cancelCreatedBooking(page, request, bookingId)
    }
  })
})

test.describe("member Space without live Stripe", () => {
  test.skip(
    !runMemberJourney,
    "Set E2E_MEMBER=1 E2E_SKIP_WEBSERVER=1 with pnpm dev"
  )
  test.skip(
    isNonLoopbackE2eTarget(),
    "member e2e must not run against non-loopback hosts"
  )
  test.skip(runLiveStripe, "live Stripe journey already covers prefs + DSAR")

  test("password member can persist a preference and request a DSAR with mocked private Blob", async ({
    page,
    request,
  }) => {
    // Cold Turbopack compiles (account → gateway → app Space) routinely exceed 2m.
    test.setTimeout(240_000)
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")

    const email = uniqueEmail("member-pref")
    const signup = await page.goto(`${accountUrl}/signup`)
    test.skip(signup?.status() !== 200, "needs local account app on :3006")

    await page.getByTestId("signup-name").fill("E2e Prefs")
    await page.getByTestId("signup-email").fill(email)
    await page.getByTestId("signup-password").fill(E2E_PASSWORD)
    await page.getByTestId("signup-consent").click()
    await page.getByTestId("signup-submit").click()
    // Local Resend rejects @example.com and can take ~15s before Better Auth
    // returns 200 with AUTH_MAIL_SEND_FAILED — keep the UI wait above that.
    await expect(page.getByTestId("verify-email")).toBeVisible({
      timeout: 45_000,
    })
    await verifyEmail(request, email)

    // Password sign-in (same path as e2e/auth.spec.ts). Session mint must set
    // activeOrganizationId (personal Space) so Space RSC → API /me succeeds.
    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill(email)
    await page.getByTestId("login-password").fill(E2E_PASSWORD)
    const signedIn = page.waitForResponse(
      (response) =>
        response.url().includes("/auth/sign-in/email") && response.ok()
    )
    await page.getByTestId("login-submit").click()
    await signedIn

    const spaceSlug = await landOnPersonalSpace(page)

    await persistMarketingPreference(page, request, spaceSlug)
    await assertMemberConsentsApi(page, request, spaceSlug)
    await requestDsarWithMockedBlob(page, request, spaceSlug)
    await assertDeleteAccountBlocksReserve(page, request, spaceSlug)
  })

  test("magic-link activation lands on a Space (session handoff)", async ({
    page,
    request,
  }) => {
    // Cold Turbopack compiles (account → gateway → app Space) routinely exceed 2m.
    test.setTimeout(240_000)
    // Guest magic-link activation with a booking remains on the live Stripe
    // journey above. This case covers post-verify magic-link → Space without
    // Stripe; keep it in the suite so Phase 05 cannot go green without it.
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")

    const email = uniqueEmail("member-magic")
    const signup = await page.goto(`${accountUrl}/signup`)
    test.skip(signup?.status() !== 200, "needs local account app on :3006")

    await page.getByTestId("signup-name").fill("E2e Magic")
    await page.getByTestId("signup-email").fill(email)
    await page.getByTestId("signup-password").fill(E2E_PASSWORD)
    await page.getByTestId("signup-consent").click()
    await page.getByTestId("signup-submit").click()
    await expect(page.getByTestId("verify-email")).toBeVisible({
      timeout: 45_000,
    })
    await verifyEmail(request, email)

    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill(email)
    await page.getByTestId("login-magic").click()
    await expect(page.getByTestId("login-magic-sent")).toBeVisible({
      timeout: 45_000,
    })
    const magicUrl = await waitForE2eAuthUrl("magic-link", email, 20_000)
    test.skip(
      !magicUrl,
      "magic-link URL missing — set E2E_AUTH_CAPTURE=1 and restart pnpm dev"
    )

    await page.goto(magicUrl!)
    const spaceSlug = await landOnPersonalSpace(page)

    // Cookie minting (Playwright page.request shares the browser jar).
    const me = await page.request.get(`${apiUrl}/me`, {
      headers: { Origin: ACCOUNT_ORIGIN },
    })
    expect(
      me.status(),
      "magic-link activation must leave a session cookie usable by GET /me"
    ).toBe(200)

    // Authenticated Space render — RSC must forward the session to the API.
    // Sessions without activeOrganizationId used to 401 here; keep the
    // assertion so the suite cannot go green without the handoff.
    await page.goto(`${webUrl}/${spaceSlug}`)
    await expect(page.getByTestId("member-space-home")).toBeVisible({
      timeout: 20_000,
    })
  })
})

async function persistMarketingPreference(
  page: Page,
  request: APIRequestContext,
  spaceSlug: string
): Promise<void> {
  await page.goto(`/${spaceSlug}/settings`)
  const marketingEmail = page
    .getByTestId("notify-email-marketing")
    .locator('[data-slot="checkbox"]')
  await expect(marketingEmail).toBeVisible()
  // React Aria Checkbox exposes selection via data-selected, not aria-checked.
  const wasSelected =
    (await marketingEmail.getAttribute("data-selected")) === "true"
  await marketingEmail.click()
  await page.getByTestId("member-notifications-save").click()
  await expect(page.getByText(/Notification preferences saved/i)).toBeVisible({
    timeout: 15_000,
  })
  await page.reload()
  if (wasSelected) {
    await expect(marketingEmail).not.toHaveAttribute("data-selected", "true")
  } else {
    await expect(marketingEmail).toHaveAttribute("data-selected", "true")
  }

  const me = await request.get(`${apiUrl}/me`, {
    headers: authHeaders(cookieHeaderFromPage(await page.context().cookies())),
  })
  expect(me.status()).toBe(200)
  const profile = (await me.json()) as {
    preferences?: Array<{
      channel: string
      category: string
      enabled: boolean
    }>
  }
  const marketingPref = profile.preferences?.find(
    (row) => row.channel === "email" && row.category === "marketing"
  )
  expect(marketingPref?.enabled).toBe(!wasSelected)
}

async function requestDsarWithMockedBlob(
  page: Page,
  request: APIRequestContext,
  spaceSlug: string
): Promise<void> {
  // Private Blob is mocked in `@eleva/storage` when E2E_AUTH_CAPTURE=1
  // or E2E_MOCK_PRIVATE_BLOB=1 (server process). Playwright cannot intercept
  // Node `@vercel/blob.put`.
  await page.goto(`/${spaceSlug}/privacy`)
  await page.getByTestId("member-dsar-request").click()
  const status = page.getByTestId("member-dsar-status")
  await expect(status).toHaveAttribute("data-status", "ready", {
    timeout: 30_000,
  })
  const download = page.getByTestId("member-dsar-download")
  await expect(download).toBeVisible()
  const href = await download.getAttribute("href")
  expect(href).toMatch(/\/privacy\/dsar\/.+\/file/)
  const fileRes = await request.get(href!, {
    headers: authHeaders(cookieHeaderFromPage(await page.context().cookies())),
  })
  expect(fileRes.status()).toBe(200)
  expect(fileRes.headers()["content-type"]).toMatch(/zip/)
  expect(fileRes.headers()["content-disposition"] ?? "").toMatch(
    /eleva-member-export\.zip/
  )
  const body = await fileRes.body()
  expect(Buffer.from(body.subarray(0, 2)).toString("latin1")).toBe("PK")
}

const MEMBER_CONSENT_KINDS = [
  "terms",
  "privacy",
  "health_data_processing",
  "marketing",
] as const

async function sessionAuthHeaders(page: Page): Promise<Record<string, string>> {
  return authHeaders(cookieHeaderFromPage(await page.context().cookies()))
}

async function assertMemberConsentsApi(
  page: Page,
  request: APIRequestContext,
  spaceSlug: string
): Promise<void> {
  const headers = await sessionAuthHeaders(page)
  const listed = await request.get(`${apiUrl}/me/consents`, { headers })
  expect(listed.status()).toBe(200)
  const body = (await listed.json()) as {
    consents: Array<{
      kind: string
      version: string
      grantedAt: string | null
      withdrawnAt: string | null
    }>
  }
  expect(body.consents.map((row) => row.kind).sort()).toEqual(
    [...MEMBER_CONSENT_KINDS].sort()
  )
  for (const row of body.consents) {
    expect(row.version.length).toBeGreaterThan(0)
  }

  const marketing = body.consents.find((row) => row.kind === "marketing")
  expect(marketing).toBeTruthy()
  if (!marketing!.grantedAt || marketing!.withdrawnAt) {
    const grant = await request.put(`${apiUrl}/me/consents`, {
      headers,
      data: { kind: "marketing", granted: true },
    })
    expect(grant.status(), await grant.text()).toBe(200)
  }

  const withdraw = await request.put(`${apiUrl}/me/consents`, {
    headers,
    data: { kind: "marketing", granted: false },
  })
  expect(withdraw.status(), await withdraw.text()).toBe(200)
  const after = (await withdraw.json()) as typeof body
  const withdrawn = after.consents.find((row) => row.kind === "marketing")
  expect(withdrawn?.withdrawnAt).toBeTruthy()

  await page.goto(`${webUrl}/${spaceSlug}/privacy`)
  await expect(page.getByTestId("member-consent-marketing")).toHaveAttribute(
    "data-granted",
    "false",
    { timeout: 15_000 }
  )
}

async function assertHealthConsentBlockedWhileBooked(
  page: Page,
  request: APIRequestContext
): Promise<void> {
  const headers = await sessionAuthHeaders(page)
  const blocked = await request.put(`${apiUrl}/me/consents`, {
    headers,
    data: { kind: "health_data_processing", granted: false },
  })
  expect(blocked.status()).toBe(409)
  const body = (await blocked.json()) as { code?: string; error?: string }
  expect(body.code ?? body.error).toMatch(/HEALTH_DATA_CONSENT_IN_USE|conflict/)
}

async function assertPaymentsListShowsBooking(
  page: Page,
  request: APIRequestContext,
  spaceSlug: string,
  bookingId: string
): Promise<void> {
  const headers = await sessionAuthHeaders(page)
  let match: {
    bookingId: string
    status: string
    amountCents: number
    receiptUrl: string | null
  } | null = null

  // Webhook may land after confirm; poll until receipt is cached or timeout.
  await expect
    .poll(
      async () => {
        const paymentsRes = await request.get(`${apiUrl}/me/payments`, {
          headers,
        })
        if (paymentsRes.status() !== 200) return null
        const payload = (await paymentsRes.json()) as {
          payments: Array<{
            bookingId: string
            status: string
            amountCents: number
            receiptUrl: string | null
          }>
        }
        match =
          payload.payments.find((row) => row.bookingId === bookingId) ?? null
        return match?.receiptUrl ?? null
      },
      { timeout: 45_000 }
    )
    .toMatch(/^https:\/\//)

  expect(match).toBeTruthy()
  expect(match!.amountCents).toBe(6000)
  expect(["succeeded", "refund_pending", "refunded"]).toContain(match!.status)
  expect(match!.receiptUrl).toMatch(/^https:\/\//)

  await page.goto(`${webUrl}/${spaceSlug}/payments`)
  const row = page
    .locator(`[data-testid="member-payment-row"][data-booking="${bookingId}"]`)
    .first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  const receipt = row.getByTestId("member-payment-receipt")
  await expect(receipt).toBeVisible()
  const href = await receipt.getAttribute("href")
  expect(href).toBe(match!.receiptUrl)
}

async function assertDeleteAccountBlocksReserve(
  page: Page,
  request: APIRequestContext,
  spaceSlug: string
): Promise<void> {
  const headers = await sessionAuthHeaders(page)
  const offer = await request.get(
    `${apiUrl}/public/experts/${PAID_EXPERT}/event-types/${PAID_OFFER}`
  )
  if (offer.status() !== 200) {
    throw new Error(
      `delete-account block needs seeded fisiomota / first-visit (GET offer ${offer.status()})`
    )
  }
  const detail = (await offer.json()) as {
    modes: Array<{ id: string }>
  }
  const modeId = detail.modes[0]?.id
  expect(modeId).toBeTruthy()

  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  startsAt.setMinutes(0, 0, 0)
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)
  const reserveBody = {
    username: PAID_EXPERT,
    eventTypeModeId: modeId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timezone: "Europe/Lisbon",
    language: "en" as const,
    memberCountry: "PT",
    consents: [
      { kind: "terms" as const, version: "dev-2026-09-09" },
      { kind: "privacy" as const, version: "dev-2026-09-09" },
      { kind: "health_data_processing" as const, version: "dev-2026-09-09" },
    ],
  }

  await page.goto(`${webUrl}/${spaceSlug}/privacy`)
  let deletionRequested = false
  try {
    await page.getByTestId("member-deletion-request").click()
    await page.getByTestId("member-deletion-confirm").click()
    // Mark before the visibility wait so a toast/UI flake still cleans up.
    deletionRequested = true
    await expect(page.getByTestId("member-deletion-scheduled")).toBeVisible({
      timeout: 15_000,
    })

    const reserve = await request.post(`${apiUrl}/bookings/reserve`, {
      headers,
      data: reserveBody,
    })
    expect(
      reserve.status(),
      `expected ACCOUNT_DELETION_SCHEDULED, got ${reserve.status()}: ${await reserve.text()}`
    ).toBe(409)
    const body = (await reserve.json()) as { error?: string }
    expect(body.error).toBe("ACCOUNT_DELETION_SCHEDULED")
  } finally {
    if (deletionRequested) {
      // Always clear the schedule so a failed assert does not strand the member.
      const cancelBtn = page.getByTestId("member-deletion-cancel")
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click()
        await expect(page.getByTestId("member-deletion-request")).toBeVisible({
          timeout: 15_000,
        })
      } else {
        const res = await request.post(`${apiUrl}/privacy/cancel-deletion`, {
          headers,
        })
        expect(res.ok(), await res.text()).toBe(true)
      }
    }
  }

  // Cleared state: schedule UI is gone (no second reserve — avoids slot pollution).
  await expect(page.getByTestId("member-deletion-scheduled")).toHaveCount(0)
  await expect(page.getByTestId("member-deletion-request")).toBeVisible()
}

async function cancelCreatedBooking(
  page: Page,
  request: APIRequestContext,
  bookingId: string | undefined
): Promise<void> {
  if (!bookingId) return
  let cookies: string
  try {
    cookies = cookieHeaderFromPage(await page.context().cookies())
  } catch {
    // Browser already closed (primary failure); skip cleanup.
    return
  }
  if (!cookies) return
  const response = await request.post(
    `${apiUrl}/me/bookings/${bookingId}/cancel`,
    { headers: authHeaders(cookies) }
  )
  const status = response.status()
  if (status === 401 || status === 403) return
  expect([200, 409]).toContain(status)
}
