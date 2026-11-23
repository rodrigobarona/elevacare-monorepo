import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A person removed from a session must not stay in the call. The job
 * that finishes a removal the video service did not take runs hourly, so
 * these routes ask for a run soon whenever one may be needed.
 */

const {
  addSessionParticipant,
  removeSessionParticipant,
  SessionParticipantError,
  afterResponse,
  runJobAgain,
} = vi.hoisted(() => {
  class SessionParticipantError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }
  return {
    addSessionParticipant: vi.fn(),
    removeSessionParticipant: vi.fn(),
    SessionParticipantError,
    afterResponse: vi.fn((_task: () => unknown) => true),
    runJobAgain: vi.fn(async (..._args: unknown[]) => "asked" as const),
  }
})

vi.mock("@eleva/workflows/video", () => ({
  addSessionParticipant,
  removeSessionParticipant,
  SessionParticipantError,
}))
vi.mock("@eleva/observability", () => ({ logError: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  requireApiAuth: vi.fn(async () => ({ user: { id: EXPERT } })),
  apiAuthFailure: vi.fn(() => null),
}))
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: vi.fn(() => "key"),
  RATE_LIMITS: { authenticated: {} },
}))
vi.mock("@/lib/after-response", () => ({ afterResponse }))
vi.mock("@/lib/run-job-at", () => ({ runJobAgain }))

import { POST } from "./route"
import { DELETE } from "./[userId]/route"

const BOOKING = "7b0f3a52-6c1d-4a8e-9f21-0d5c4e3b2a10"
const EXPERT = "1c9d7e64-2b3a-4f5c-8d6e-7f8091a2b3c4"
const DELEGATE = "9e8d7c6b-5a49-4382-b716-0f1e2d3c4b5a"
const url = `https://api.eleva.test/sessions/${BOOKING}/participants`

const remove = () =>
  DELETE(new Request(`${url}/${DELEGATE}`, { method: "DELETE" }), {
    params: Promise.resolve({ bookingId: BOOKING, userId: DELEGATE }),
  })

const add = () =>
  POST(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: DELEGATE, role: "delegate" }),
    }),
    { params: Promise.resolve({ bookingId: BOOKING }) }
  )

/** What was handed to "after the answer", run now. */
async function afterTheAnswer() {
  for (const [task] of afterResponse.mock.calls) await task()
}

beforeEach(() => {
  addSessionParticipant.mockReset()
  removeSessionParticipant.mockReset()
  afterResponse.mockClear()
  runJobAgain.mockClear()
})

describe("removing someone from a session", () => {
  it("asks for nothing when the video service put them out", async () => {
    removeSessionParticipant.mockResolvedValue({ ok: true })
    expect((await remove()).status).toBe(200)
    expect(afterResponse).not.toHaveBeenCalled()
  })

  it("asks for a run soon when they are removed here and still in the call", async () => {
    removeSessionParticipant.mockResolvedValue({ ejectionPending: true })
    expect((await remove()).status).toBe(202)
    await afterTheAnswer()
    expect(runJobAgain).toHaveBeenCalledWith("video-eject-retry", 0)
  })

  it("asks for a run when it failed in a way it cannot name: the removal may be written", async () => {
    removeSessionParticipant.mockRejectedValue(new Error("something else"))
    expect((await remove()).status).toBe(500)
    await afterTheAnswer()
    expect(runJobAgain).toHaveBeenCalledWith("video-eject-retry", 0)
  })

  it("asks for nothing when nobody was removed", async () => {
    removeSessionParticipant.mockRejectedValue(
      new SessionParticipantError("NOT_FOUND")
    )
    expect((await remove()).status).toBe(404)
    expect(afterResponse).not.toHaveBeenCalled()
  })
})

describe("adding someone to a session", () => {
  const participant = { id: DELEGATE, userId: DELEGATE, role: "delegate" }

  it("asks for nothing when the room was made bigger", async () => {
    addSessionParticipant.mockResolvedValue(participant)
    expect((await add()).status).toBe(200)
    expect(afterResponse).not.toHaveBeenCalled()
  })

  it("asks for a run soon when the room is still too small for them", async () => {
    addSessionParticipant.mockResolvedValue({
      ...participant,
      capacityPending: true,
    })
    expect((await add()).status).toBe(202)
    await afterTheAnswer()
    expect(runJobAgain).toHaveBeenCalledWith("video-eject-retry", 0)
  })
})
