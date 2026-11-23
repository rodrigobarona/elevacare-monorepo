import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { publishJSON } = vi.hoisted(() => ({
  publishJSON: vi.fn(async (_message: Record<string, unknown>) => ({})),
}))
vi.mock("@upstash/qstash", () => ({
  Client: class {
    publishJSON = publishJSON
  },
}))

import { publishWorkflowJob } from "./qstash-publish"

describe("publishWorkflowJob", () => {
  beforeEach(() => {
    publishJSON.mockClear()
    vi.stubEnv("QSTASH_TOKEN", "qstash-token")
    vi.stubEnv("WORKFLOWS_DRAIN_SECRET", "drain-secret")
    vi.stubEnv("API_URL", "https://api.eleva.test/")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("sends the job to its route, with the secret the route asks for", async () => {
    expect(await publishWorkflowJob("/workflows/dsar-export", { a: 1 })).toBe(
      "published"
    )
    expect(publishJSON).toHaveBeenCalledWith({
      url: "https://api.eleva.test/workflows/dsar-export",
      body: { a: 1 },
      headers: { Authorization: "Bearer drain-secret" },
    })
  })

  it("for later: not before the moment, in whole seconds rounded up, and once", async () => {
    await publishWorkflowJob(
      "/workflows/slot-reservation-expiry",
      {},
      {
        notBefore: new Date("2026-12-01T10:05:00.200Z"),
        deduplicationId: "slot-reservation-expiry:1:0",
      }
    )
    const [message] = publishJSON.mock.calls[0]!
    expect(message).toMatchObject({
      url: "https://api.eleva.test/workflows/slot-reservation-expiry",
      notBefore: Date.parse("2026-12-01T10:05:01Z") / 1000,
      // Another deployment asking for the same run is another message.
      deduplicationId: "api.eleva.test:slot-reservation-expiry:1:0",
    })
  })

  it("sends no time and no id for a message that goes now", async () => {
    await publishWorkflowJob("/workflows/dsar-export", {})
    const [message] = publishJSON.mock.calls[0]!
    expect(message).not.toHaveProperty("notBefore")
    expect(message).not.toHaveProperty("deduplicationId")
  })

  it.each([
    ["no queue token", "QSTASH_TOKEN", ""],
    ["no secret", "WORKFLOWS_DRAIN_SECRET", ""],
    ["no address", "API_URL", ""],
    ["a laptop", "API_URL", "http://localhost:3002"],
  ])("sends nothing with %s, and says so", async (_what, name, value) => {
    vi.stubEnv(name, value)
    vi.stubEnv("NEXT_PUBLIC_API_URL", "")
    expect(await publishWorkflowJob("/workflows/dsar-export", {})).toBe(
      "inline"
    )
    expect(publishJSON).not.toHaveBeenCalled()
  })

  it("refuses an address that is not https", async () => {
    vi.stubEnv("API_URL", "http://api.eleva.test")
    await expect(
      publishWorkflowJob("/workflows/dsar-export", {})
    ).rejects.toThrow(/https/)
  })
})
