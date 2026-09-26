import { describe, expect, it } from "vitest"
import {
  CalendarTokenError,
  createCredentialManager,
} from "./credential-manager"
import { calendarProviderForSlug } from "./registry"

function managerThrowing(err: unknown) {
  return createCredentialManager({
    getProviderAccessToken: async () => {
      throw err
    },
  })
}

async function codeFor(err: unknown): Promise<string> {
  try {
    await managerThrowing(err).getCalendarToken("user-1", "google", "acc-1")
  } catch (caught) {
    if (caught instanceof CalendarTokenError) return caught.code
    throw caught
  }
  throw new Error("expected a CalendarTokenError")
}

describe("createCredentialManager", () => {
  it("treats a missing token as a confirmed reauthorization", async () => {
    await expect(codeFor(new Error("needs_reauthorization"))).resolves.toBe(
      "needs_reauthorization"
    )
  })

  it("maps an unlinked Better Auth account to account_not_found", async () => {
    await expect(
      codeFor(
        Object.assign(new Error("x"), { body: { code: "ACCOUNT_NOT_FOUND" } })
      )
    ).resolves.toBe("account_not_found")
  })

  it("keeps ambiguous refresh failures distinguishable from revocation", async () => {
    await expect(
      codeFor(
        Object.assign(new Error("x"), {
          body: { code: "FAILED_TO_GET_ACCESS_TOKEN" },
        })
      )
    ).resolves.toBe("token_unavailable")
    await expect(codeFor(new Error("ECONNRESET"))).resolves.toBe(
      "token_unavailable"
    )
  })
})

describe("calendarProviderForSlug", () => {
  it("maps known slugs and ignores inherited property names", () => {
    expect(calendarProviderForSlug("google-calendar")).toBe("google")
    expect(calendarProviderForSlug("constructor")).toBeNull()
    expect(calendarProviderForSlug("toString")).toBeNull()
  })
})
