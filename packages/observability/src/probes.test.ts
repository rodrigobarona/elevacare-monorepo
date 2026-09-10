import { beforeEach, describe, expect, it, vi } from "vitest"

const captureException = vi.fn()

vi.mock("./sentry", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

import { reportProbeFailure } from "./probes"

describe("reportProbeFailure", () => {
  beforeEach(() => {
    captureException.mockReset()
  })

  it("forwards the probe name and extra context to captureException", async () => {
    const err = new Error("slots 500")
    await reportProbeFailure("booking-probes", err, { status: 500 })

    expect(captureException).toHaveBeenCalledWith(err, {
      probe: "booking-probes",
      status: 500,
    })
  })

  it("keeps the probe name when extra also sets probe", async () => {
    const err = new Error("slots 500")
    await reportProbeFailure("booking-probes", err, { probe: "other" })

    expect(captureException).toHaveBeenCalledWith(err, {
      probe: "booking-probes",
    })
  })
})
