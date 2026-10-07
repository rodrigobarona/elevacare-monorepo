import { describe, expect, it } from "vitest"
import {
  classifyJoinCaller,
  classifyJoinStatus,
  classifyJoinWindow,
} from "./join"

const startsAt = new Date("2026-10-07T10:00:00.000Z")
const endsAt = new Date("2026-10-07T11:00:00.000Z")

describe("classifyJoinStatus", () => {
  it("allows scheduled and live", () => {
    expect(classifyJoinStatus("scheduled")).toEqual({ ok: true })
    expect(classifyJoinStatus("live")).toEqual({ ok: true })
  })

  it("rejects terminal statuses", () => {
    expect(classifyJoinStatus("cancelled")).toEqual({
      error: "SESSION_NOT_ACTIVE",
    })
    expect(classifyJoinStatus("ended")).toEqual({
      error: "SESSION_NOT_ACTIVE",
    })
    expect(classifyJoinStatus("no_show")).toEqual({
      error: "SESSION_NOT_ACTIVE",
    })
    expect(classifyJoinStatus("room_unresolved")).toEqual({
      error: "ROOM_NOT_READY",
    })
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

  it("rejects outside the window", () => {
    expect(
      classifyJoinWindow(new Date("2026-10-07T09:44:59.000Z"), startsAt, endsAt)
    ).toEqual({ error: "SESSION_NOT_OPEN" })
    expect(
      classifyJoinWindow(new Date("2026-10-07T11:30:01.000Z"), startsAt, endsAt)
    ).toEqual({ error: "SESSION_NOT_OPEN" })
  })
})

describe("classifyJoinCaller", () => {
  it("recognizes the assigned expert and the member", () => {
    expect(
      classifyJoinCaller({
        userId: "expert-1",
        expertUserId: "expert-1",
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ role: "expert" })
    expect(
      classifyJoinCaller({
        userId: "member-1",
        expertUserId: "expert-1",
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ role: "member" })
  })

  it("rejects another expert of the same org", () => {
    expect(
      classifyJoinCaller({
        userId: "other-expert",
        expertUserId: "expert-1",
        memberUserId: "member-1",
        hasActiveDelegate: false,
      })
    ).toEqual({ error: "NOT_A_PARTICIPANT" })
  })

  it("allows an active delegate and rejects a revoked one", () => {
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
})
