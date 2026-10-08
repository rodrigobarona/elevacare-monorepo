import { describe, expect, it } from "vitest"
import { joinErrorCode } from "./client/labels"

describe("joinErrorCode", () => {
  it("maps known API error codes and falls back to internal", () => {
    expect(joinErrorCode({ body: { error: "SESSION_NOT_OPEN" } })).toBe(
      "SESSION_NOT_OPEN"
    )
    expect(joinErrorCode({ body: { error: "NOT_A_PARTICIPANT" } })).toBe(
      "NOT_A_PARTICIPANT"
    )
    expect(joinErrorCode({ body: { error: "mystery" } })).toBe("internal")
    expect(joinErrorCode(new Error("nope"))).toBe("internal")
  })
})
