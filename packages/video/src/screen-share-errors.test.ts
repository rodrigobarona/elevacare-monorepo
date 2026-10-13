import { describe, expect, it } from "vitest"
import {
  isScreenShareCancelLog,
  isScreenShareCanceled,
} from "./client/screen-share-errors"

describe("isScreenShareCanceled", () => {
  it("treats Daily picker cancel as expected", () => {
    expect(
      isScreenShareCanceled(
        "Error starting ScreenShare: blocked-by-browser: NotAllowedError: Permission denied by user"
      )
    ).toBe(true)
    expect(
      isScreenShareCanceled({
        type: "screen-share-error",
        errorMsg:
          "blocked-by-browser: NotAllowedError: Permission denied by user",
      })
    ).toBe(true)
    const denied = new Error("Permission denied by user")
    denied.name = "NotAllowedError"
    expect(isScreenShareCanceled(denied)).toBe(true)
  })

  it("does not treat unrelated share failures as cancel", () => {
    expect(
      isScreenShareCanceled({
        type: "screen-share-error",
        errorMsg:
          "Could not start the screen sharing. The screen is already been captured!",
      })
    ).toBe(false)
  })

  it("does not treat a generic NotAllowedError as picker cancellation", () => {
    const denied = new Error("Permission denied")
    denied.name = "NotAllowedError"
    expect(isScreenShareCanceled(denied)).toBe(false)
    expect(
      isScreenShareCanceled(
        "NotAllowedError: Permission denied by permissions policy"
      )
    ).toBe(false)
  })
})

describe("isScreenShareCancelLog", () => {
  it("matches Daily's console.error when the picker is closed", () => {
    expect(
      isScreenShareCancelLog([
        "Error starting ScreenShare: blocked-by-browser: NotAllowedError: Permission denied by user",
      ])
    ).toBe(true)
  })

  it("does not swallow camera permission logs", () => {
    expect(
      isScreenShareCancelLog(["NotAllowedError: Permission denied by user"])
    ).toBe(false)
  })
})
