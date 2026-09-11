import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  pseudonymiseBookingConsents,
  subjectPseudonymForUser,
} from "./retention"

const withPlatformAdminContext = vi.fn()

vi.mock("@eleva/db", () => ({
  withPlatformAdminContext: (fn: (tx: unknown) => unknown) =>
    withPlatformAdminContext(fn),
}))

vi.mock("@eleva/db/schema", () => ({
  consents: {
    userId: "user_id",
    bookingId: "booking_id",
  },
}))

afterEach(() => {
  vi.unstubAllEnvs()
  withPlatformAdminContext.mockReset()
})

describe("ACCOUNT_DELETION_GRACE_DAYS", () => {
  it("is the 14-day working pre-launch product grace", () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(14)
  })
})

describe("subjectPseudonymForUser", () => {
  it("returns a 32-byte HMAC-SHA256 digest of the user id", () => {
    const secret = "b".repeat(32)
    const token = subjectPseudonymForUser("user-1", secret)
    expect(token).toBeInstanceOf(Buffer)
    expect(token).toHaveLength(32)
    expect(token.equals(subjectPseudonymForUser("user-1", secret))).toBe(true)
    expect(token.equals(subjectPseudonymForUser("user-2", secret))).toBe(false)
  })

  it("refuses a short or missing RETENTION_PSEUDONYM_KEY", () => {
    expect(() => subjectPseudonymForUser("user-1", "short")).toThrow(
      /RETENTION_PSEUDONYM_KEY/
    )
    vi.stubEnv("RETENTION_PSEUDONYM_KEY", "")
    expect(() => subjectPseudonymForUser("user-1")).toThrow(
      /RETENTION_PSEUDONYM_KEY/
    )
  })
})

describe("pseudonymiseBookingConsents", () => {
  it("nulls identity columns and sets subject_pseudonym for booking-scope rows", async () => {
    const secret = "c".repeat(32)
    vi.stubEnv("RETENTION_PSEUDONYM_KEY", secret)
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    })
    const update = vi.fn().mockReturnValue({ set })
    withPlatformAdminContext.mockImplementation(
      async (fn: (tx: { update: typeof update }) => Promise<void>) =>
        fn({ update })
    )

    await pseudonymiseBookingConsents("user-1")
    expect(update).toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith({
      userId: null,
      guestEmailHash: null,
      subjectPseudonym: subjectPseudonymForUser("user-1", secret),
    })
  })
})
