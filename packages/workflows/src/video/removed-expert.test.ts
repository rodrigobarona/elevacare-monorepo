import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Someone removed from a clinic stays `expertUserId` on its past bookings,
 * but `isActiveBookingExpert` now says no: they can neither manage the
 * call's participants nor join it as the expert. Members are unaffected.
 */

const { rows, isActiveBookingExpert, withAudit } = vi.hoisted(() => ({
  rows: { queue: [] as unknown[][] },
  isActiveBookingExpert: vi.fn(),
  withAudit: vi.fn(),
}))

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
    isActiveBookingExpert,
    withPlatformAdminContext: (fn: (handle: typeof tx) => unknown) => fn(tx),
  }
})

vi.mock("@eleva/audit", () => ({
  withAudit,
  withPlatformAudit: vi.fn(),
}))

import { joinSession } from "./join"
import { addSessionParticipant, removeSessionParticipant } from "./participants"

const BOOKING_ID = "11111111-1111-4111-8111-111111111111"
const CLINIC_ID = "22222222-2222-4222-8222-222222222222"
const EXPERT_ID = "33333333-3333-4333-8333-333333333333"
const MEMBER_ID = "44444444-4444-4444-8444-444444444444"

const startsAt = new Date("2026-10-07T10:00:00.000Z")
const endsAt = new Date("2026-10-07T11:00:00.000Z")

const session = {
  orgId: CLINIC_ID,
  status: "scheduled",
  startsAt,
  endsAt,
  dailyRoomName: "eleva-room",
  dailyRoomUrl: "https://eleva.daily.co/eleva-room",
  expertUserId: EXPERT_ID,
  memberUserId: MEMBER_ID,
  language: "pt",
}

describe("an expert removed from the booking's clinic", () => {
  beforeEach(() => {
    rows.queue = []
    withAudit.mockReset()
    isActiveBookingExpert.mockReset()
    // Removed from the clinic: the rule says no even for the booked expert.
    isActiveBookingExpert.mockResolvedValue(false)
  })

  it("cannot add a delegate to the call", async () => {
    rows.queue = [[session]]
    await expect(
      addSessionParticipant({
        bookingId: BOOKING_ID,
        actorUserId: EXPERT_ID,
        userId: "55555555-5555-4555-8555-555555555555",
        role: "delegate",
      })
    ).rejects.toMatchObject({ code: "NOT_ASSIGNED_EXPERT" })
    expect(isActiveBookingExpert).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: CLINIC_ID, expertUserId: EXPERT_ID }),
      EXPERT_ID
    )
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("cannot revoke a delegate either", async () => {
    rows.queue = [[session]]
    await expect(
      removeSessionParticipant({
        bookingId: BOOKING_ID,
        actorUserId: EXPERT_ID,
        userId: "55555555-5555-4555-8555-555555555555",
      })
    ).rejects.toMatchObject({ code: "NOT_ASSIGNED_EXPERT" })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("cannot join with their session", async () => {
    rows.queue = [[session], []]
    await expect(
      joinSession({
        bookingId: BOOKING_ID,
        userId: EXPERT_ID,
        userName: "Former clinician",
        now: new Date("2026-10-07T10:05:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "NOT_A_PARTICIPANT" })
  })

  it("cannot join with an emailed expert grant", async () => {
    rows.queue = [[session], []]
    await expect(
      joinSession({
        bookingId: BOOKING_ID,
        userId: EXPERT_ID,
        userName: "Former clinician",
        grantRole: "expert",
        now: new Date("2026-10-07T10:05:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "NOT_A_PARTICIPANT" })
  })

  it("leaves the member's join untouched", async () => {
    // Outside the join window, so the call stops right after the caller
    // check: reaching SESSION_NOT_OPEN proves the member was let through.
    rows.queue = [[session], []]
    await expect(
      joinSession({
        bookingId: BOOKING_ID,
        userId: MEMBER_ID,
        userName: "Member",
        grantRole: "member",
        now: new Date("2026-10-07T08:00:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "SESSION_NOT_OPEN" })
    expect(isActiveBookingExpert).not.toHaveBeenCalled()
  })
})
