import { describe, expect, it } from "vitest"
import { SessionParticipantError } from "./participants"

describe("SessionParticipantError", () => {
  it("carries a closed error code", () => {
    const err = new SessionParticipantError("NOT_ASSIGNED_EXPERT")
    expect(err.code).toBe("NOT_ASSIGNED_EXPERT")
    expect(err.name).toBe("SessionParticipantError")
  })
})
