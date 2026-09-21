import { describe, expect, it } from "vitest"
import {
  hashPhoneOtp,
  PHONE_OTP_MAX_ATTEMPTS,
  PhoneVerifyError,
  verifyPhoneConfirm,
  verifyPhoneStart,
} from "./verify-phone"

describe("verifyPhone", () => {
  it("rejects a non-E.164 phone before any write", async () => {
    await expect(
      verifyPhoneStart({
        userId: "00000000-0000-4000-8000-000000000002",
        orgId: "00000000-0000-4000-8000-000000000001",
        phoneE164: "910000002",
      })
    ).rejects.toMatchObject({ code: "VALIDATION" })
  })

  it("rejects a non-6-digit confirm code before any write", async () => {
    await expect(
      verifyPhoneConfirm({
        userId: "00000000-0000-4000-8000-000000000002",
        orgId: "00000000-0000-4000-8000-000000000001",
        phoneE164: "+351910000002",
        code: "12",
      })
    ).rejects.toBeInstanceOf(PhoneVerifyError)
  })

  it("caps OTP guesses at five attempts", () => {
    expect(PHONE_OTP_MAX_ATTEMPTS).toBe(5)
  })

  it("fails closed when BETTER_AUTH_SECRET is missing", () => {
    const previous = process.env.BETTER_AUTH_SECRET
    delete process.env.BETTER_AUTH_SECRET
    try {
      expect(() =>
        hashPhoneOtp({
          userId: "user-1",
          phoneE164: "+351910000002",
          code: "123456",
        })
      ).toThrow(/BETTER_AUTH_SECRET/)
    } finally {
      if (previous === undefined) delete process.env.BETTER_AUTH_SECRET
      else process.env.BETTER_AUTH_SECRET = previous
    }
  })

  it("hashes OTP with the user, phone, and pepper", () => {
    const previous = process.env.BETTER_AUTH_SECRET
    process.env.BETTER_AUTH_SECRET = "test-pepper"
    try {
      expect(
        hashPhoneOtp({
          userId: "user-1",
          phoneE164: "+351910000002",
          code: "123456",
        })
      ).toBe(
        hashPhoneOtp({
          userId: "user-1",
          phoneE164: "+351910000002",
          code: "123456",
        })
      )
      expect(
        hashPhoneOtp({
          userId: "user-1",
          phoneE164: "+351910000002",
          code: "123456",
        })
      ).not.toBe(
        hashPhoneOtp({
          userId: "user-1",
          phoneE164: "+351910000002",
          code: "000000",
        })
      )
    } finally {
      if (previous === undefined) delete process.env.BETTER_AUTH_SECRET
      else process.env.BETTER_AUTH_SECRET = previous
    }
  })
})
