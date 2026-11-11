import { expect, test, type Page } from "@playwright/test"

/**
 * The join page before and after the join window. The join API answer is
 * mocked, so no booking is needed; what is proven is the page's behaviour
 * for each answer. Needs the member app behind the gateway, so it is
 * opt-in: `pnpm e2e:waiting-room` with web, app and api running.
 */
const BOOKING_ID = "11111111-1111-4111-8111-111111111111"
const JOIN_URL = `/join/${BOOKING_ID}?g=example-grant`
const MINUTE = 60_000

test.skip(
  process.env.E2E_WAITING_ROOM !== "1",
  "set E2E_WAITING_ROOM=1 (pnpm e2e:waiting-room) with web, app and api running"
)

type Answer = { status: number; body: Record<string, unknown> }

const ENDED: Answer = { status: 410, body: { error: "SESSION_ENDED" } }

/**
 * Mock the join API for a session whose join window opens `opensInMs`
 * from now: "not open yet" until then, and `afterOpen` from then on.
 * Counts are kept apart because a development build asks twice on load
 * (React StrictMode), which is not what is being proven here.
 */
async function mockJoin(page: Page, opensInMs: number, afterOpen?: Answer) {
  const loadedAt = Date.now()
  const opensAt = loadedAt + opensInMs
  const startsAt = opensAt + 15 * MINUTE
  const counts = { early: 0, afterOpen: 0 }
  await page.route("**/sessions/*/join", (route) => {
    const now = Date.now()
    const open = now >= opensAt
    if (open) counts.afterOpen += 1
    else counts.early += 1
    const answer: Answer =
      open && afterOpen
        ? afterOpen
        : {
            status: 403,
            body: {
              error: "SESSION_NOT_OPEN",
              startsAt: new Date(startsAt).toISOString(),
              opensAt: new Date(opensAt).toISOString(),
              closesAt: new Date(startsAt + 90 * MINUTE).toISOString(),
              now: new Date(now).toISOString(),
            },
          }
    return route.fulfill({
      status: answer.status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(answer.body),
    })
  })
  return counts
}

test.describe("session waiting room", () => {
  test("waits with a countdown and does not keep asking while it is early", async ({
    page,
  }) => {
    const counts = await mockJoin(page, 12 * MINUTE)
    await page.goto(JOIN_URL)

    const room = page.getByTestId("waiting-room")
    await expect(room).toBeVisible()
    await expect(room).toHaveAttribute("data-phase", "early")
    await expect(page.getByTestId("waiting-room-countdown")).toContainText(
      "12 minutes"
    )
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0)
    await expect(page).toHaveTitle(/12 minutes/)
    // Members waiting are told where to get urgent help (PRIV2-03).
    await expect(
      page.getByTestId("urgent-help").getByRole("link", { name: "112" })
    ).toHaveAttribute("href", "tel:112")

    const asked = counts.early
    await page.waitForTimeout(4_000)
    expect(counts.early).toBe(asked)
  })

  test("asks by itself when joining opens, and stops on a final answer", async ({
    page,
  }) => {
    const counts = await mockJoin(page, 4_000, ENDED)
    await page.goto(JOIN_URL)
    await expect(page.getByTestId("waiting-room")).toBeVisible()

    const closed = page.getByTestId("session-closed")
    await expect(closed).toBeVisible({ timeout: 15_000 })
    expect(counts.afterOpen).toBe(1)
    await page.waitForTimeout(4_000)
    expect(counts.afterOpen).toBe(1)
  })

  test("says a finished session has ended, with no try again", async ({
    page,
  }) => {
    await mockJoin(page, -MINUTE, ENDED)
    await page.goto(JOIN_URL)

    const closed = page.getByTestId("session-closed")
    await expect(closed).toBeVisible()
    await expect(closed).toHaveAttribute("data-kind", "ended")
    await expect(
      closed.getByRole("heading", { name: "This session has ended" })
    ).toBeVisible()
    await expect(
      closed.getByRole("link", { name: "support@eleva.care" })
    ).toHaveAttribute("href", "mailto:support@eleva.care")
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0)
  })

  test("keeps waiting through failed tries, then offers a button", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const counts = await mockJoin(page, 4_000, {
      status: 503,
      body: { error: "rate_limit_unavailable" },
    })
    await page.goto(JOIN_URL)

    const room = page.getByTestId("waiting-room")
    await expect(room).toHaveAttribute("data-phase", "opening", {
      timeout: 15_000,
    })
    // A failed try does not throw the person out of the waiting room.
    await page.waitForTimeout(6_000)
    await expect(room).toBeVisible()
    expect(counts.afterOpen).toBeGreaterThanOrEqual(1)
    // Five automatic tries at most, then a button that stays put.
    const retry = page.getByRole("button", { name: "Try again" })
    await expect(retry).toBeVisible({ timeout: 60_000 })
    expect(counts.afterOpen).toBe(5)
    await retry.click()
    await expect(retry).toBeVisible()
    await expect.poll(() => counts.afterOpen).toBe(6)
  })
})
