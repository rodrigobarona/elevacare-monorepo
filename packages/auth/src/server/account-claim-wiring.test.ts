import { describe, expect, it, vi } from "vitest"

const { purgeBeforeClaim } = vi.hoisted(() => ({
  purgeBeforeClaim: vi.fn(async () => {}),
}))

vi.mock("@eleva/db", () => ({ db: () => ({}), auth: {} }))
vi.mock("./account-claim", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./account-claim")>()),
  purgeBeforeClaim,
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

  it("keeps implicit linking on so unverified rows stay claimable", () => {
    expect(options.account?.accountLinking).toMatchObject({
      disableImplicitLinking: false,
      requireLocalEmailVerified: false,
    })
  })
})
