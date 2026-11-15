import { beforeEach, describe, expect, it, vi } from "vitest"

const create = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({ accountSessions: { create } }),
}))

const { createAccountSession } = await import("./account-session")

describe("createAccountSession", () => {
  beforeEach(() => {
    create.mockReset()
    create.mockResolvedValue({ client_secret: "cs_x", expires_at: 1 })
  })

  it("sends the same payout features for balances and payouts", async () => {
    await createAccountSession({
      stripeAccountId: "acct_1",
      components: ["balances", "payouts"],
    })

    const { components } = create.mock.calls[0]![0]
    expect(components.balances.features).toEqual(components.payouts.features)
  })

  it("returns the client secret and expiry", async () => {
    await expect(
      createAccountSession({
        stripeAccountId: "acct_1",
        components: ["account_onboarding"],
      })
    ).resolves.toEqual({ clientSecret: "cs_x", expiresAt: 1 })
  })
})
