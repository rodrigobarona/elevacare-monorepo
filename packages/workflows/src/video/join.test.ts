import { describe, expect, it } from "vitest"
import {
  classifyJoinCaller,
  classifyJoinStatus,
  classifyJoinWindow,
  joinWindowDetails,
} from "./join"

const startsAt = new Date("2026-10-07T10:00:00.000Z")
const endsAt = new Date("2026-10-07T11:00:00.000Z")

describe("classifyJoinStatus", () => {
  it("allows scheduled and live", () => {
    expect(classifyJoinStatus("scheduled")).toEqual({ ok: true })
    expect(classifyJoinStatus("live")).toEqual({ ok: true })
  })

  it("rejects a cancelled session and a room that is not ready", () => {
    expect(classifyJoinStatus("cancelled")).toEqual({
      error: "SESSION_NOT_ACTIVE",
    })
    expect(classifyJoinStatus("cancelled", true)).toEqual({
      error: "SESSION_NOT_ACTIVE",
    })
    expect(classifyJoinStatus("room_unresolved")).toEqual({
      error: "ROOM_NOT_READY",
    })
  })

  it("says a finished session has ended, once its start has passed", () => {
    for (const status of ["ended", "no_show", "completed"]) {
      expect(classifyJoinStatus(status, true)).toEqual({
        error: "SESSION_ENDED",
      })
      // A status set before the booked start never reads as "ended".
      expect(classifyJoinStatus(status, false)).toEqual({
        error: "SESSION_NOT_ACTIVE",
      })
    }
  })
})

describe("classifyJoinWindow", () => {
  it("opens 15 minutes before start and closes 30 minutes after end", () => {
    expect(
      classifyJoinWindow(new Date("2026-10-07T09:45:00.000Z"), startsAt, endsAt)
    ).toEqual({ ok: true })
    expect(
      classifyJoinWindow(new Date("2026-10-07T11:30:00.000Z"), startsAt, endsAt)
    ).toEqual({ ok: true })
  })

  it("is not open before the window and ended after it", () => {
    expect(
      classifyJoinWindow(new Date("2026-10-07T09:44:59.000Z"), startsAt, endsAt)
    ).toEqual({ error: "SESSION_NOT_OPEN" })
    expect(
      classifyJoinWindow(new Date("2026-10-07T11:30:01.000Z"), startsAt, endsAt)
    ).toEqual({ error: "SESSION_ENDED" })
  })
})

describe("joinWindowDetails", () => {
  it("names when joining opens and closes, on the server clock", () => {
    expect(
      joinWindowDetails(new Date("2026-10-07T09:30:00.000Z"), startsAt, endsAt)
    ).toEqual({
      startsAt: "2026-10-07T10:00:00.000Z",
      opensAt: "2026-10-07T09:45:00.000Z",
      closesAt: "2026-10-07T11:30:00.000Z",
      now: "2026-10-07T09:30:00.000Z",
    })
  })
})

describe("classifyJoinCaller", () => {
  it("recognizes the assigned expert and the member", () => {
    expect(
      classifyJoinCaller({
        userId: "expert-1",
        isActiveExpert: true,
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ role: "expert" })
    expect(
      classifyJoinCaller({
        userId: "member-1",
        isActiveExpert: false,
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ role: "member" })
  })

  it("rejects the booked expert once removed from the booking's org", () => {
    expect(
      classifyJoinCaller({
        userId: "expert-1",
        isActiveExpert: false,
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ error: "NOT_A_PARTICIPANT" })
  })

  it("rejects another expert of the same org", () => {
    expect(
      classifyJoinCaller({
        userId: "other-expert",
        isActiveExpert: false,
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ error: "NOT_A_PARTICIPANT" })
  })

  it("allows an active delegate and rejects a revoked one", () => {
    expect(
      classifyJoinCaller({
        userId: "delegate-1",
        isActiveExpert: false,
        memberUserId: "member-1",
        hasActiveDelegate: true,
      })
    ).toEqual({ role: "delegate" })
    expect(
      classifyJoinCaller({
        userId: "delegate-1",
        isActiveExpert: false,
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ error: "NOT_A_PARTICIPANT" })
  })
})
