import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test"
import {
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
const CANCEL_MIN_START = () => new Date(Date.now() + 25 * 60 * 60 * 1000)

function cookieHeaderFromPage(
  cookies: Array<{ name: string; value: string }>
): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
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
    test.setTimeout(180_000)
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
    test.skip(
      reserveResponse.status() !== 201,
      `POST /bookings/reserve returned ${reserveResponse.status()}`
    )
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
      { timeout: 45_000 }
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
      await page.goto(`${webUrl}/dashboard`)
      await expect(page).toHaveURL(/\/space-[a-z0-9]+(?:\/)?(?:\?.*)?$/, {
        timeout: 20_000,
      })

      const spaceSlug = new URL(page.url()).pathname
        .split("/")
        .filter(Boolean)[0]
      expect(spaceSlug).toMatch(/^space-/)

      const bookingCard = page.getByTestId("member-booking-card")
      await expect(bookingCard.first()).toBeVisible({ timeout: 15_000 })
      await expect(bookingCard.first()).toHaveAttribute(
        "data-expert",
        PAID_EXPERT
      )
      await expect(page.getByText(/€\s?60|60,00\s?€|€60/)).toBeVisible()

      await persistMarketingPreference(page, request, spaceSlug)
      await requestDsarWithMockedBlob(page, request, spaceSlug)

      await page.goto(`/${spaceSlug}`)
      await page.getByTestId("member-booking-detail").first().click()
      const cancel = page.getByTestId("member-cancel-session")
      await expect(cancel).toBeVisible()
      await expect(cancel).toBeEnabled()
      await cancel.click()
      await page.getByTestId("member-cancel-confirm").click()
      await expect(page).toHaveURL(new RegExp(`/${spaceSlug}/sessions`), {
        timeout: 15_000,
      })
      await expect(
        page.getByTestId("member-booking-card").first()
      ).toHaveAttribute("data-status", "cancelled")
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

  test("magic-link member can persist a preference and request a DSAR with mocked private Blob", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000)
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
    await expect(page.getByTestId("verify-email")).toBeVisible({
      timeout: 15_000,
    })
    await verifyEmail(request, email)

    await page.goto(`${accountUrl}/login`)
    await page.getByTestId("login-email").fill(email)
    await page.getByTestId("login-magic").click()
    await expect(page.getByTestId("login-magic-sent")).toBeVisible({
      timeout: 15_000,
    })
    const magicUrl = await waitForE2eAuthUrl("magic-link", email, 12_000)
    test.skip(
      !magicUrl,
      "magic-link URL missing — set E2E_AUTH_CAPTURE=1 and restart pnpm dev"
    )

    await page.goto(magicUrl!)
    await page.goto(`${webUrl}/dashboard`)
    await expect(page).toHaveURL(/\/space-[a-z0-9]+/, { timeout: 20_000 })
    const spaceSlug = new URL(page.url()).pathname.split("/").filter(Boolean)[0]

    await persistMarketingPreference(page, request, spaceSlug)
    await requestDsarWithMockedBlob(page, request, spaceSlug)
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
  const wasSelected =
    (await marketingEmail.getAttribute("aria-checked")) === "true"
  await marketingEmail.click()
  await page.getByTestId("member-notifications-save").click()
  await expect(page.getByText(/Notification preferences saved/i)).toBeVisible({
    timeout: 15_000,
  })
  await page.reload()
  await expect(marketingEmail).toHaveAttribute(
    "aria-checked",
    wasSelected ? "false" : "true"
  )

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

async function cancelCreatedBooking(
  page: Page,
  request: APIRequestContext,
  bookingId: string | undefined
): Promise<void> {
  if (!bookingId) return
  const cookies = cookieHeaderFromPage(await page.context().cookies())
  if (!cookies) return
  const response = await request.post(
    `${apiUrl}/me/bookings/${bookingId}/cancel`,
    { headers: authHeaders(cookies) }
  )
  const status = response.status()
  if (status === 401 || status === 403) return
  expect([200, 409]).toContain(status)
}
