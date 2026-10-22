import { beforeEach, describe, expect, it, vi } from "vitest"

const init = vi.fn()

vi.mock("@sentry/nextjs", () => ({ init, captureException: vi.fn() }))
vi.mock("@eleva/config/env", () => ({
  env: () => ({
    SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    NODE_ENV: "test",
  }),
}))

import { initSentry } from "./sentry"
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
