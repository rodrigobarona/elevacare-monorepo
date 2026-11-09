import { describe, expect, it, vi } from "vitest"
import { signOutAndLeave } from "./sign-out"

describe("signOutAndLeave", () => {
  it("leaves after a successful sign-out", async () => {
    const leave = vi.fn()
    const outcome = await signOutAndLeave({
      signOut: async () => ({ error: null }),
      leave,
    })
    expect(outcome).toBe("left")
    expect(leave).toHaveBeenCalledOnce()
  })

  it("treats no session (401) as signed out", async () => {
    const leave = vi.fn()
    const outcome = await signOutAndLeave({
      signOut: async () => ({ error: { status: 401 } }),
      leave,
    })
    expect(outcome).toBe("left")
    expect(leave).toHaveBeenCalledOnce()
  })

  it("stays on the page when the auth server refuses (403)", async () => {
    const leave = vi.fn()
    const outcome = await signOutAndLeave({
      signOut: async () => ({ error: { status: 403 } }),
      leave,
    })
    expect(outcome).toBe("failed")
    expect(leave).not.toHaveBeenCalled()
  })

  it("stays on the page when the request throws", async () => {
    const leave = vi.fn()
    const outcome = await signOutAndLeave({
      signOut: async () => {
        throw new Error("network down")
      },
      leave,
    })
    expect(outcome).toBe("failed")
    expect(leave).not.toHaveBeenCalled()
  })
})
