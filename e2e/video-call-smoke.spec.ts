/**
 * Phase 09 operator evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_VIDEO_CALL_SMOKE=1; loopback only.
 *
 * Two browsers with fake media join a real Daily room through signed Eleva
 * join links. The booking is moved into its join window in the local
 * database. Daily's real webhooks go to the deployed API, so lifecycle
 * events are replayed with a valid signature after Daily confirms the call.
 */
import { expect, test, type Browser, type Page } from "@playwright/test"
import { apiUrl } from "./helpers/auth"
import { appUrl, isNonLoopbackE2eTarget } from "./helpers/local"
import { bindConnectAccount, bookPaidOffer } from "./helpers/payout-smoke"
import {
  dailyMeeting,
  ensureRoom,
  joinGrant,
  loadSessionState,
  replayDailyWebhook,
  shiftBookingToJoinWindow,
} from "./helpers/video-smoke"

async function joinCall(browser: Browser, url: string): Promise<Page> {
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  })
  const page = await context.newPage()
  await page.goto(url)
  await expect(page.getByTestId("eleva-call-prejoin")).toBeVisible({
    timeout: 90_000,
  })
  const join = page.getByTestId("eleva-call-prejoin").getByRole("button")
  await expect(join).toBeEnabled({ timeout: 30_000 })
  await join.click()
  await expect(page.getByTestId("eleva-call-prejoin")).toHaveCount(0, {
    timeout: 30_000,
  })
  return page
}

test.describe("Phase 09 — two browsers in an Eleva call", () => {
  test.skip(
    process.env.E2E_VIDEO_CALL_SMOKE !== "1",
    "Set E2E_VIDEO_CALL_SMOKE=1 to run the loopback call smoke"
  )
  test.skip(isNonLoopbackE2eTarget(), "call smoke must stay on loopback only")
  test.skip(
    !process.env.DAILY_API_KEY || !process.env.DAILY_WEBHOOK_SECRET,
    "needs DAILY_API_KEY and DAILY_WEBHOOK_SECRET"
  )
  test.skip(
    !process.env.E2E_PAYOUT_CONNECT_ACCOUNT,
    "needs E2E_PAYOUT_CONNECT_ACCOUNT, a verified TEST connected account"
  )

  test("expert and guest meet through signed join links", async ({
    browser,
    request,
  }) => {
    test.setTimeout(300_000)
    await bindConnectAccount(process.env.E2E_PAYOUT_CONNECT_ACCOUNT!)
    const { bookingId } = await bookPaidOffer(request)
    await shiftBookingToJoinWindow(bookingId)
    const session = await ensureRoom(request, bookingId)

    const joinUrl = async (role: "member" | "expert") =>
      `${appUrl}/join/${bookingId}?g=${await joinGrant(bookingId, session, role)}`
    const expert = await joinCall(browser, await joinUrl("expert"))
    const guest = await joinCall(browser, await joinUrl("member"))

    await expect(expert.getByText("Payout Smoke").first()).toBeVisible({
      timeout: 45_000,
    })
    await expect
      .poll(() => dailyMeeting(session.room), { timeout: 45_000 })
      .toMatchObject({ participants: expect.any(Array) })
    let meeting = await dailyMeeting(session.room)
    await expect
      .poll(
        async () => {
          meeting = await dailyMeeting(session.room)
          return meeting?.participants.length ?? 0
        },
        { timeout: 60_000 }
      )
      .toBeGreaterThanOrEqual(2)

    await expert.context().close()
    await guest.context().close()

    const base = { room: session.room, meeting_id: meeting!.id }
    await replayDailyWebhook(request, "meeting.started", {
      ...base,
      start_ts: Date.now() / 1000,
    })
    for (const participant of meeting!.participants) {
      await replayDailyWebhook(request, "participant.joined", {
        ...base,
        user_id: participant.user_id,
        session_id: participant.participant_id,
        joined_at: Date.now() / 1000,
      })
    }
    await replayDailyWebhook(request, "meeting.ended", {
      ...base,
      start_ts: Date.now() / 1000 - 60,
      end_ts: Date.now() / 1000,
    })

    const state = await loadSessionState(bookingId)
    console.log(
      `[video-smoke] booking=${bookingId} room=${session.room} meeting=${meeting!.id} daily_participants=${meeting!.participants.length} session=${state.status} attendance=${state.attendance} api=${apiUrl}`
    )
    expect(state.status).not.toBe("scheduled")
  })
})
