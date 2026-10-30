import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const send = vi.hoisted(() => vi.fn())

vi.mock("resend", () => ({
  Resend: class {
    emails = { send }
  },
}))

const { sendViaResend } = await import("./send-email")

const input = {
  to: "member@eleva.care",
  subject: "Your session",
  html: "<p>Hi</p>",
  deliveryId: "delivery-1",
}

describe("sendViaResend failure classification", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("VERCEL_ENV", "production")
    send.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it("marks a Resend validation rejection as permanent", async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `to` field." },
    })
    await expect(sendViaResend(input)).rejects.toMatchObject({
      permanent: true,
    })
  })

  it("leaves rate limits and outages retryable", async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: "rate_limit_exceeded", message: "Too many requests" },
    })
    const error = await sendViaResend(input).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(Error)
    expect((error as { permanent?: boolean }).permanent).toBeUndefined()
  })
})
