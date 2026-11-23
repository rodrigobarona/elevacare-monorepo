import { describe, expect, it, vi } from "vitest"

const { after } = vi.hoisted(() => ({ after: vi.fn() }))
vi.mock("next/server", () => ({ after }))

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
})
