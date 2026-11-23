import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * An export that fails is recorded by the job itself and nothing is
 * thrown, so the route is the only place Sentry can hear of it.
 */

const { processDsarExport, captureException } = vi.hoisted(() => ({
  processDsarExport: vi.fn(),
  captureException: vi.fn(async () => {}),
}))

vi.mock("@eleva/compliance", () => ({ processDsarExport }))
vi.mock("@eleva/observability", () => ({
  captureException,
  reportJobRun: vi.fn(async () => {}),
}))
vi.mock("@/lib/internal-workflow", () => ({
  authorizeInternalWorkflow: vi.fn(async () => null),
}))

import { POST } from "./route"

const BODY = {
  dsarId: "7b0f3a52-6c1d-4a8e-9f21-0d5c4e3b2a10",
  userId: "1c9d7e64-2b3a-4f5c-8d6e-7f8091a2b3c4",
  orgId: "9e8d7c6b-5a49-4382-b716-0f1e2d3c4b5a",
}

const run = () =>
  POST(
    new Request("https://api.eleva.test/workflows/dsar-export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(BODY),
    })
  )

describe("POST /workflows/dsar-export", () => {
  beforeEach(() => {
    processDsarExport.mockReset()
    captureException.mockClear()
  })

  it("tells Sentry when the export failed, with the request and nothing about the person", async () => {
    processDsarExport.mockResolvedValue({ status: "failed" })
    const answer = await run()
    expect(answer.status).toBe(200)
    expect(await answer.json()).toMatchObject({ status: "failed" })
    expect(captureException).toHaveBeenCalledTimes(1)
    const [error, context] = captureException.mock.calls[0] as unknown as [
      Error,
      Record<string, unknown>,
    ]
    expect(error).toBeInstanceOf(Error)
    expect(context).toEqual({ probe: "dsar-export", dsarId: BODY.dsarId })
  })

  it.each([{ status: "ready" }, { status: "skipped" }])(
    "says nothing to Sentry for %j",
    async (result) => {
      processDsarExport.mockResolvedValue(result)
      expect((await run()).status).toBe(200)
      expect(captureException).not.toHaveBeenCalled()
    }
  )

  it("asks to be run again while another run holds the export", async () => {
    processDsarExport.mockResolvedValue({ status: "skipped", retry: true })
    expect((await run()).status).toBe(500)
    expect(captureException).not.toHaveBeenCalled()
  })

  it("tells Sentry what was thrown", async () => {
    const boom = new Error("storage is down")
    processDsarExport.mockRejectedValue(boom)
    expect((await run()).status).toBe(500)
    expect(captureException).toHaveBeenCalledWith(boom, {
      probe: "dsar-export",
    })
  })
})
