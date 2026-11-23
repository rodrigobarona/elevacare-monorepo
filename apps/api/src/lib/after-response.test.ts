import { describe, expect, it, vi } from "vitest"

const { after, logError } = vi.hoisted(() => ({
  after: vi.fn(),
  logError: vi.fn(),
}))
vi.mock("next/server", () => ({ after }))
vi.mock("@eleva/observability", () => ({ logError }))

import { afterResponse } from "./after-response"

describe("afterResponse", () => {
  it("hands the task to Next and says so", () => {
    const task = () => {}
    expect(afterResponse(task)).toBe(true)
    expect(after).toHaveBeenCalledWith(task)
  })

  it("does not throw where there is no request, and says the task will not run", () => {
    after.mockImplementationOnce(() => {
      throw new Error("`after` was called outside a request scope.")
    })
    const task = vi.fn()
    expect(afterResponse(task)).toBe(false)
    expect(task).not.toHaveBeenCalled()
  })

  it("says so once where it is deployed: there, every call should be in a request", () => {
    const outside = () => {
      throw new Error("`after` was called outside a request scope.")
    }
    after.mockImplementationOnce(outside)
    afterResponse(() => {})
    expect(logError).not.toHaveBeenCalled()

    vi.stubEnv("VERCEL_ENV", "production")
    after.mockImplementationOnce(outside).mockImplementationOnce(outside)
    afterResponse(() => {})
    afterResponse(() => {})
    vi.unstubAllEnvs()
    expect(logError).toHaveBeenCalledTimes(1)
  })
})
