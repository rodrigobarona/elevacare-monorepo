import { describe, expect, it } from "vitest"
import { buildSessionRoomBody, DailyHttpError } from "@eleva/video"
import {
  isRetryableDailyFailure,
  isSelfDelegate,
  SessionParticipantError,
} from "./participants"
import { classifyJoinCaller } from "./join"

describe("SessionParticipantError", () => {
  it("carries a closed error code", () => {
    const err = new SessionParticipantError("NOT_ASSIGNED_EXPERT")
    expect(err.code).toBe("NOT_ASSIGNED_EXPERT")
    expect(err.name).toBe("SessionParticipantError")
  })
})

describe("isSelfDelegate", () => {
  it("rejects the assigned expert and the member", () => {
    expect(isSelfDelegate("expert-1", "expert-1", "member-1")).toBe(true)
    expect(isSelfDelegate("member-1", "expert-1", "member-1")).toBe(true)
    expect(isSelfDelegate("delegate-1", "expert-1", "member-1")).toBe(false)
  })
})

describe("isRetryableDailyFailure", () => {
  it("retries Daily 5xx and rethrows other failures", () => {
    expect(isRetryableDailyFailure(new DailyHttpError(503, "busy"))).toBe(true)
    expect(isRetryableDailyFailure(new DailyHttpError(404, "gone"))).toBe(false)
    expect(isRetryableDailyFailure(new Error("db"))).toBe(false)
  })
})

describe("delegate join contract", () => {
  it("lets an active delegate join and rejects after revoke", () => {
    expect(
      classifyJoinCaller({
        userId: "delegate-1",
        expertUserId: "expert-1",
        memberUserId: "member-1",
        hasActiveDelegate: true,
      })
    ).toEqual({ role: "delegate" })
    expect(
      classifyJoinCaller({
        userId: "delegate-1",
        expertUserId: "expert-1",
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ error: "NOT_A_PARTICIPANT" })
  })

  it("fits a third participant in room capacity", () => {
    const body = buildSessionRoomBody({
      bookingId: "11111111-1111-4111-8111-111111111111",
      startAt: new Date("2026-10-07T10:00:00.000Z"),
      endAt: new Date("2026-10-07T11:00:00.000Z"),
      extraParticipants: 1,
    })
    expect(body.properties.max_participants).toBe(3)
  })
})
