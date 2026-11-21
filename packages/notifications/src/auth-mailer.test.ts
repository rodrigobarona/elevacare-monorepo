import { createHash, createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createAuthMailer } from "./auth-mailer"

const ORG_ID = "00000000-0000-4000-8000-000000000001"
const USER_ID = "00000000-0000-4000-8000-000000000002"

describe("createAuthMailer", () => {
  const send = vi
    .fn()
    .mockResolvedValue({ kind: "auth.magic_link", deliveries: [] })

  beforeEach(() => {
    send.mockClear()
    process.env.RESEND_API_KEY = "re_test"
    delete process.env.VERCEL_ENV
    delete process.env.BETTER_AUTH_SECRET
  })

  it("sends user-scoped auth.verify_email through sendNotification", async () => {
    const mailer = createAuthMailer({ send })
    await mailer.sendVerifyEmail({
      user: {
        id: USER_ID,
        email: "ana@example.com",
        name: "Ana",
        locale: "pt",
      },
      url: "https://eleva.care/verify?t=1",
    })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "verify-email",
        locale: "pt",
        recipient: { userId: USER_ID },
        idempotencyKey: expect.stringMatching(
          /^auth\.verify_email:ana@example.com:/
        ),
      })
    )
  })

  it("sends magic-link as email-mode with a url-scoped idempotency key", async () => {
    const mailer = createAuthMailer({ send })
    await mailer.sendMagicLink({
      email: "guest@example.com",
      url: "https://eleva.care/magic?t=abc",
    })
    await mailer.sendMagicLink({
      email: "guest@example.com",
      url: "https://eleva.care/magic?t=abc",
    })
    const first = send.mock.calls[0]?.[0].idempotencyKey
    const second = send.mock.calls[1]?.[0].idempotencyKey
    expect(first).toBe(second)
    expect(send.mock.calls[0]?.[0].recipient).toEqual({
      email: "guest@example.com",
    })
  })

  it("HMACs the OTP into the idempotency key", async () => {
    process.env.BETTER_AUTH_SECRET = "test-secret"
    const mailer = createAuthMailer({ send })
    await mailer.sendTwoFactorOtp({
      user: { email: "ana@example.com" },
      otp: "123456",
    })
    const key = send.mock.calls[0]?.[0].idempotencyKey as string
    const expected = createHmac("sha256", "test-secret")
      .update("ana@example.com:123456")
      .digest("hex")
      .slice(0, 24)
    expect(key).toBe(`auth.two_factor_otp:ana@example.com:${expected}`)
    expect(key).not.toContain("123456")
    const unsalted = createHash("sha256")
      .update("123456")
      .digest("hex")
      .slice(0, 24)
    expect(key).not.toContain(unsalted)
  })

  it("uses userId for an existing invitee and email-mode for an unknown address", async () => {
    const loadUser = vi
      .fn()
      .mockResolvedValueOnce({
        userId: USER_ID,
        email: "ana@example.com",
        locale: "pt",
      })
      .mockResolvedValueOnce(null)
    const mailer = createAuthMailer({ send, loadUser })

    await mailer.sendOrgInvitation({
      email: "ana@example.com",
      url: "https://eleva.care/invite/1",
      orgId: ORG_ID,
      invitationId: "inv_1",
    })
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      kind: "organization-invitation",
      orgId: ORG_ID,
      recipient: { userId: USER_ID },
      idempotencyKey: "auth.org_invitation:inv_1",
    })

    await mailer.sendOrgInvitation({
      email: "new@example.com",
      url: "https://eleva.care/invite/2",
      orgId: ORG_ID,
      invitationId: "inv_2",
    })
    expect(send.mock.calls[1]?.[0].recipient).toEqual({
      email: "new@example.com",
    })
    expect(send.mock.calls[1]?.[0].orgId).toBe(ORG_ID)
  })

  it("delivers a renewed invitation as a new email, naming who invites", async () => {
    const loadUser = vi.fn().mockResolvedValue(null)
    const mailer = createAuthMailer({ send, loadUser })
    const invitation = {
      email: "new@example.com",
      url: "https://eleva.care/invite/3",
      orgId: ORG_ID,
      invitationId: "inv_3",
      organizationName: "Clínica Lumen",
      inviterName: "Ana Mota",
      fallbackLocale: "pt",
    }
    await mailer.sendOrgInvitation({ ...invitation, sendKey: "1000" })
    await mailer.sendOrgInvitation({ ...invitation, sendKey: "2000" })
    expect(send.mock.calls.map((call) => call[0].idempotencyKey)).toEqual([
      "auth.org_invitation:inv_3:1000",
      "auth.org_invitation:inv_3:2000",
    ])
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      organizationName: "Clínica Lumen",
      inviterName: "Ana Mota",
      // No account yet: the inviter's language.
      locale: "pt",
    })
  })

  it("reports whether the invitation email left", async () => {
    const loadUser = vi.fn().mockResolvedValue(null)
    const mailer = createAuthMailer({ send, loadUser })
    const invitation = {
      email: "new@example.com",
      url: "https://eleva.care/invite/4",
      orgId: ORG_ID,
      invitationId: "inv_4",
    }
    const outcome = (status: string) => ({
      kind: "auth.org_invitation",
      deliveries: [{ channel: "email", deliveryId: "d1", status }],
    })
    send.mockResolvedValueOnce(outcome("sent"))
    await expect(mailer.sendOrgInvitation(invitation)).resolves.toBe(true)
    for (const status of ["suppressed", "held", "failed", "bounced"]) {
      send.mockResolvedValueOnce(outcome(status))
      await expect(mailer.sendOrgInvitation(invitation)).resolves.toBe(false)
    }
    // A send that throws outside production is a failure, not a skip.
    send.mockRejectedValueOnce(new Error("provider down"))
    await expect(mailer.sendOrgInvitation(invitation)).resolves.toBe(false)
    // Nothing delivered at all (every channel skipped).
    send.mockResolvedValueOnce({ kind: "auth.org_invitation", deliveries: [] })
    await expect(mailer.sendOrgInvitation(invitation)).resolves.toBe(false)
  })

  it("counts a local skip without a mail key as sent", async () => {
    delete process.env.RESEND_API_KEY
    const mailer = createAuthMailer({ send, loadUser: vi.fn() })
    await expect(
      mailer.sendOrgInvitation({
        email: "new@example.com",
        url: "https://eleva.care/invite/5",
        orgId: ORG_ID,
        invitationId: "inv_5",
      })
    ).resolves.toBe(true)
    expect(send).not.toHaveBeenCalled()
  })

  it("skips the provider when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    const mailer = createAuthMailer({ send })
    await mailer.sendMagicLink({
      email: "guest@example.com",
      url: "https://eleva.care/magic",
    })
    expect(send).not.toHaveBeenCalled()
  })

  it("throws in production when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    process.env.VERCEL_ENV = "production"
    const mailer = createAuthMailer({ send })
    await expect(
      mailer.sendMagicLink({
        email: "guest@example.com",
        url: "https://eleva.care/magic",
      })
    ).rejects.toThrow(/RESEND_API_KEY is required/)
    expect(send).not.toHaveBeenCalled()
  })

  it("throws on preview when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY
    process.env.VERCEL_ENV = "preview"
    const mailer = createAuthMailer({ send })
    await expect(
      mailer.sendMagicLink({
        email: "guest@example.com",
        url: "https://eleva.care/magic",
      })
    ).rejects.toThrow(/RESEND_API_KEY is required/)
    expect(send).not.toHaveBeenCalled()
  })

  it("rethrows provider failures on preview without logging PII", async () => {
    process.env.VERCEL_ENV = "preview"
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    send.mockRejectedValueOnce(new Error("recipient guest@example.com bounced"))
    const mailer = createAuthMailer({ send })
    await expect(
      mailer.sendMagicLink({
        email: "guest@example.com",
        url: "https://eleva.care/magic",
      })
    ).rejects.toThrow("AUTH_MAIL_SEND_FAILED")
    expect(logged.mock.calls.flat().join(" ")).toMatch(/AUTH_MAIL_SEND_FAILED/)
    expect(logged.mock.calls.flat().join(" ")).not.toContain(
      "guest@example.com"
    )
    logged.mockRestore()
  })
})
