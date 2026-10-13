import { describe, expect, it } from "vitest"
import {
  elevaCallLabels,
  joinErrorCode,
  joinErrorWindow,
} from "./client/labels"

describe("joinErrorCode", () => {
  it("maps known API error codes and falls back to internal", () => {
    expect(joinErrorCode({ body: { error: "SESSION_NOT_OPEN" } })).toBe(
      "SESSION_NOT_OPEN"
    )
    expect(joinErrorCode({ body: { error: "NOT_A_PARTICIPANT" } })).toBe(
      "NOT_A_PARTICIPANT"
    )
    expect(joinErrorCode({ body: { error: "INVALID_GRANT" } })).toBe(
      "INVALID_GRANT"
    )
    expect(joinErrorCode({ body: { error: "mystery" } })).toBe("internal")
    expect(joinErrorCode(new Error("nope"))).toBe("internal")
  })

  it("reads join-window timestamps from SESSION_NOT_OPEN bodies", () => {
    expect(
      joinErrorWindow({
        body: {
          error: "SESSION_NOT_OPEN",
          startsAt: "2026-10-23T10:00:00.000Z",
          opensAt: "2026-10-23T09:45:00.000Z",
        },
      })
    ).toEqual({
      startsAt: "2026-10-23T10:00:00.000Z",
      opensAt: "2026-10-23T09:45:00.000Z",
    })
    expect(joinErrorWindow(new Error("nope"))).toEqual({})
  })
})

describe("elevaCallLabels", () => {
  it("formats unread chat copy with the incoming count", () => {
    const labels = elevaCallLabels((key, values) => {
      if (key === "chatUnread") return `Chat, ${String(values?.count)} new`
      return key
    })
    expect(labels.chatUnread(1)).toBe("Chat, 1 new")
    expect(labels.chatUnread(3)).toBe("Chat, 3 new")
  })

  it("formats in-call name labels", () => {
    const labels = elevaCallLabels((key, values) => {
      if (key === "youNamed") return `${String(values?.name)} (you)`
      if (key === "screenShareOf") return `${String(values?.name)}'s screen`
      return key
    })
    expect(labels.youNamed("Rodrigo")).toBe("Rodrigo (you)")
    expect(labels.screenShareOf("Ana")).toBe("Ana's screen")
  })
})
