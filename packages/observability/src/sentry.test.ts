import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  init,
  captureException: sentryCaptureException,
  captureRequestError: sentryCaptureRequestError,
} = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureRequestError: vi.fn(),
}))

vi.mock("@sentry/nextjs", () => ({
  init,
  captureException: sentryCaptureException,
  captureRequestError: sentryCaptureRequestError,
}))
vi.mock("@eleva/config/env", () => ({
  env: () => ({
    SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    NODE_ENV: "test",
  }),
}))

import { captureException, captureRequestError, initSentry } from "./sentry"
import { Decrypted, registerPhi, withPhiScope } from "./phi"

type SentryOptions = {
  beforeSend: (event: Record<string, unknown>) => Record<string, unknown> | null
  beforeBreadcrumb: (b: Record<string, unknown>) => Record<string, unknown>
  sendDefaultPii: boolean
}

async function initialised(app: string): Promise<SentryOptions> {
  await initSentry({ app })
  return init.mock.calls.at(-1)![0] as SentryOptions
}

beforeEach(() => init.mockReset())

describe("initSentry for PHI-rendering apps", () => {
  it("tags the app and never sends default PII", async () => {
    const options = await initialised("expert")
    expect(options.sendDefaultPii).toBe(false)
    const out = options.beforeSend({ message: "boom" })
    expect(out?.tags).toMatchObject({ app: "expert" })
  })

  it("redacts clinical content from every event location", async () => {
    const options = await initialised("expert")
    const note = "Lumbar pain radiating to left leg after the fall"
    await withPhiScope(async () => {
      registerPhi(note)
      const event = options.beforeSend({
        message: `failed saving ${note}`,
        exception: {
          values: [{ type: "Error", value: `bad record: ${note}` }],
        },
        extra: { body: note, record: new Decrypted({ body: note }) },
        request: { data: { transcript: note } },
        breadcrumbs: [{ message: note, data: { notes: note } }],
        tags: { detail: note },
        contexts: { trace: { data: { summary: note } } },
      })
      expect(JSON.stringify(event)).not.toContain("Lumbar pain")
      expect(JSON.stringify(event)).not.toContain("left leg")
    })
  })

  it("redacts PHI in breadcrumbs", async () => {
    const options = await initialised("app")
    const crumb = options.beforeBreadcrumb({
      message: "saved",
      data: { body: "private note", title: "Session notes" },
    })
    expect(JSON.stringify(crumb)).not.toContain("private note")
  })
})

describe("captureRequestError", () => {
  it("forwards Next.js request errors to Sentry when a DSN is configured", async () => {
    sentryCaptureRequestError.mockReset()
    const error = new Error("render failed")
    const request = { path: "/sessions/1", method: "GET", headers: {} }
    const context = {
      routerKind: "App Router",
      routePath: "/sessions/[id]",
      routeType: "render",
      renderSource: "react-server-components",
    } as const
    await captureRequestError(error, request, context)
    expect(sentryCaptureRequestError).toHaveBeenCalledWith(
      error,
      request,
      context
    )
  })
})

describe("captureException", () => {
  // In braces: a hook that returns a function has it run as its clean-up,
  // and `mockReset()` returns the mock.
  beforeEach(() => {
    sentryCaptureException.mockReset()
  })

  it("sends the error with its context", async () => {
    const boom = new Error("boom")
    await captureException(boom, { probe: "dsar-export" })
    expect(sentryCaptureException).toHaveBeenCalledWith(boom, {
      extra: { probe: "dsar-export" },
    })
  })

  it("never rejects, so a caller that does not wait for it is safe", async () => {
    sentryCaptureException.mockImplementation(() => {
      throw new Error("the SDK is not there")
    })
    await expect(
      captureException(new Error("boom"), { probe: "booking-reminder" })
    ).resolves.toBeUndefined()
  })
})
