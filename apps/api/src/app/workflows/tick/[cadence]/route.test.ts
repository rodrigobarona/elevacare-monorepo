import { beforeEach, describe, expect, it, vi } from "vitest"

const ok = vi.fn(async (_request: Request) =>
  Response.json({ ok: true, done: 1 })
)
const broken = vi.fn(async () =>
  Response.json({ ok: false, error: "internal" }, { status: 500 })
)
const throws = vi.fn(async (): Promise<Response> => {
  throw new Error("boom")
})

vi.mock("@/lib/workflow-ticks", () => ({
  WORKFLOW_TICKS: {
    minutely: { "job-a": ok, "job-b": broken },
    hourly: { "job-a": ok, "job-c": throws },
    "10min": { "job-a": ok },
  },
  isWorkflowTickCadence: (value: string) =>
    ["minutely", "hourly", "10min"].includes(value),
}))

const authorize = vi.fn(async (): Promise<Response | null> => null)
vi.mock("@/lib/internal-workflow", () => ({
  authorizeInternalWorkflow: () => authorize(),
  internalWorkflowOptions: () => new Response(null, { status: 204 }),
}))

const { POST } = await import("./route")

function tick(cadence: string) {
  return POST(
    new Request(`https://api.eleva.care/workflows/tick/${cadence}`, {
      method: "POST",
      headers: { authorization: "Bearer outer" },
    }),
    { params: Promise.resolve({ cadence }) }
  )
}

describe("POST /workflows/tick/{cadence}", () => {
  beforeEach(() => {
    vi.stubEnv("WORKFLOWS_DRAIN_SECRET", "inner-secret")
    ok.mockClear()
    broken.mockClear()
    throws.mockClear()
    authorize.mockResolvedValue(null)
  })

  it("runs every job of the cadence with the server secret", async () => {
    const response = await tick("10min")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, failed: 0 })
    const inner = ok.mock.calls[0]?.[0] as Request
    expect(inner.headers.get("authorization")).toBe("Bearer inner-secret")
    expect(new URL(inner.url).pathname).toBe("/workflows/job-a")
  })

  it("reports a failing job without skipping the others", async () => {
    const response = await tick("minutely")
    expect(response.status).toBe(500)
    const body = (await response.json()) as {
      failed: number
      results: Record<string, { status: number }>
    }
    expect(body.failed).toBe(1)
    expect(body.results["job-a"]?.status).toBe(200)
    expect(body.results["job-b"]?.status).toBe(500)
    expect(ok).toHaveBeenCalledOnce()
  })

  it("isolates a job that throws", async () => {
    const response = await tick("hourly")
    const body = (await response.json()) as {
      results: Record<string, { status: number }>
    }
    expect(body.results["job-a"]?.status).toBe(200)
    expect(body.results["job-c"]?.status).toBe(500)
  })

  it("404s an unknown cadence and enforces auth", async () => {
    expect((await tick("weekly")).status).toBe(404)
    authorize.mockResolvedValue(new Response(null, { status: 401 }))
    expect((await tick("minutely")).status).toBe(401)
    expect(ok).not.toHaveBeenCalled()
  })
})
