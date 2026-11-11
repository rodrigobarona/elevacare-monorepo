import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A join link past its end: only a link Eleva signed for this booking, at
 * its current schedule, is told "ended". Anything else gets INVALID_GRANT
 * with no detail, and none of them ever reaches a meeting token.
 */

const { rows } = vi.hoisted(() => ({ rows: { queue: [] as unknown[][] } }))

vi.mock("@eleva/db", () => {
  const column = new Proxy({}, { get: (_t, key) => String(key) })
  const table = new Proxy({}, { get: () => column })
  const tx = {
    select: () => tx,
    from: () => tx,
    innerJoin: () => tx,
    where: () => tx,
    limit: async () => rows.queue.shift() ?? [],
  }
  return {
    auth: table,
    main: table,
    hasActiveAiProcessingConsent: vi.fn(async () => false),
    isActiveBookingExpert: vi.fn(async () => true),
    withPlatformAdminContext: (fn: (handle: typeof tx) => unknown) => fn(tx),
  }
})

vi.mock("@eleva/audit", () => ({
  withAudit: vi.fn(),
  withPlatformAudit: vi.fn(),
}))

import { mintJoinGrant } from "@eleva/video/join-grant"
import { joinSessionFromGrant } from "./join"

const BOOKING_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_BOOKING_ID = "55555555-5555-4555-8555-555555555555"
const ENDS_AT = new Date("2026-10-07T11:00:00.000Z")
const MINTED_AT = new Date("2026-10-01T09:00:00.000Z")
const AFTER_CLOSE = new Date("2026-10-07T11:31:01.000Z")

/** What the identity lookup reads for the booking. */
const booking = (scheduleRevision: number, status = "scheduled") => ({
  status,
  memberUserId: null,
  expertUserId: "33333333-3333-4333-8333-333333333333",
  guestName: "Ada",
  scheduleRevision,
})

async function grant(bookingId: string, scheduleRevision: number) {
  return mintJoinGrant({
    bookingId,
    role: "member",
    endsAt: ENDS_AT,
    scheduleRevision,
    now: MINTED_AT,
  })
}

describe("joining with a link past its end", () => {
  const mint = vi.fn()

  beforeEach(() => {
    rows.queue = []
    mint.mockReset()
    vi.stubEnv("BETTER_AUTH_SECRET", "join-grant-flow-test-secret")
  })

  it("says the session has ended for the booking's current link", async () => {
    rows.queue = [[booking(2)]]
    await expect(
      joinSessionFromGrant(
        {
          bookingId: BOOKING_ID,
          grant: await grant(BOOKING_ID, 2),
          now: AFTER_CLOSE,
        },
        { mint }
      )
    ).rejects.toMatchObject({ code: "SESSION_ENDED", details: undefined })
    expect(mint).not.toHaveBeenCalled()
  })

  it("says a cancelled session is not active, not that it ended", async () => {
    rows.queue = [[booking(2, "cancelled")]]
    await expect(
      joinSessionFromGrant(
        {
          bookingId: BOOKING_ID,
          grant: await grant(BOOKING_ID, 2),
          now: AFTER_CLOSE,
        },
        { mint }
      )
    ).rejects.toMatchObject({ code: "SESSION_NOT_ACTIVE" })
    expect(mint).not.toHaveBeenCalled()
  })

  it("gives a link from before a reschedule no detail", async () => {
    rows.queue = [[booking(3)]]
    await expect(
      joinSessionFromGrant(
        {
          bookingId: BOOKING_ID,
          grant: await grant(BOOKING_ID, 2),
          now: AFTER_CLOSE,
        },
        { mint }
      )
    ).rejects.toMatchObject({ code: "INVALID_GRANT" })
    expect(mint).not.toHaveBeenCalled()
  })

  it("gives another booking's link no detail, without reading the booking", async () => {
    rows.queue = [[booking(2)]]
    await expect(
      joinSessionFromGrant(
        {
          bookingId: BOOKING_ID,
          grant: await grant(OTHER_BOOKING_ID, 2),
          now: AFTER_CLOSE,
        },
        { mint }
      )
    ).rejects.toMatchObject({ code: "INVALID_GRANT" })
    expect(rows.queue).toHaveLength(1)
    expect(mint).not.toHaveBeenCalled()
  })

  it("gives a tampered or foreign link no detail", async () => {
    const genuine = await grant(BOOKING_ID, 2)
    vi.stubEnv("BETTER_AUTH_SECRET", "another-secret")
    const foreign = await grant(BOOKING_ID, 2)
    vi.stubEnv("BETTER_AUTH_SECRET", "join-grant-flow-test-secret")
    for (const token of [`${genuine}x`, foreign, "not-a-jwt"]) {
      rows.queue = [[booking(2)]]
      await expect(
        joinSessionFromGrant(
          { bookingId: BOOKING_ID, grant: token, now: AFTER_CLOSE },
          { mint }
        )
      ).rejects.toMatchObject({ code: "INVALID_GRANT" })
      expect(rows.queue).toHaveLength(1)
    }
    expect(mint).not.toHaveBeenCalled()
  })
})
