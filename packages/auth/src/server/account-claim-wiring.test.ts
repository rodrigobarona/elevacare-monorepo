import { describe, expect, it, vi } from "vitest"

const { purgeBeforeClaim, refuseUnverifiedSession } = vi.hoisted(() => ({
  purgeBeforeClaim: vi.fn(async () => {}),
  refuseUnverifiedSession: vi.fn(async () => {
    throw new Error("unverified")
  }),
}))

vi.mock("@eleva/db", () => ({ db: () => ({}), auth: {} }))
vi.mock("./account-claim", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./account-claim")>()),
  purgeBeforeClaim,
  refuseUnverifiedSession,
}))
vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-32")

import { guardAccountLink } from "./account-claim"
import { getAuth } from "./auth"

type ResolvedOptions = {
  user?: { validateUserInfo?: unknown }
  databaseHooks?: {
    account?: {
      create?: { before?: (account: unknown, ctx: unknown) => unknown }
    }
    session?: {
      create?: { before?: (session: unknown) => unknown }
    }
  }
  account?: {
    accountLinking?: {
      disableImplicitLinking?: boolean
      requireLocalEmailVerified?: boolean
    }
  }
}

// The config is cast `as never`, so a renamed Better Auth option would not
// fail tsc. These assertions read the options Better Auth actually resolved.
describe("account-claim wiring", () => {
  const options = (getAuth() as unknown as { options: ResolvedOptions }).options

  it("registers the link gate as user.validateUserInfo", () => {
    expect(options.user?.validateUserInfo).toBe(guardAccountLink)
  })

  it("runs the claim purge before an account row is created", async () => {
    const before = options.databaseHooks?.account?.create?.before
    expect(before).toBeTypeOf("function")
    const account = { userId: "user-1", providerId: "google" }
    await before?.(account, null)
    expect(purgeBeforeClaim).toHaveBeenCalledWith(account, null)
  })

  it("refuses a session for an unverified row before creating it", async () => {
    const before = options.databaseHooks?.session?.create?.before
    expect(before).toBeTypeOf("function")
    const session = { userId: "user-1", activeOrganizationId: "org-1" }
    await expect(before?.(session)).rejects.toThrow("unverified")
    expect(refuseUnverifiedSession).toHaveBeenCalledWith(session)
  })

  it("refuses a staff impersonation session before anything else", async () => {
    const before = options.databaseHooks?.session?.create?.before
    refuseUnverifiedSession.mockClear()
    await expect(
      before?.({ userId: "user-1", impersonatedBy: "staff-1" })
    ).rejects.toThrow(/another person/)
    expect(refuseUnverifiedSession).not.toHaveBeenCalled()
  })

  it("keeps implicit linking on so unverified rows stay claimable", () => {
    expect(options.account?.accountLinking).toMatchObject({
      disableImplicitLinking: false,
      requireLocalEmailVerified: false,
    })
  })
})
