import { beforeEach, describe, expect, it, vi } from "vitest"

const { getExpertProfileForOrg } = vi.hoisted(() => ({
  getExpertProfileForOrg: vi.fn(),
}))

vi.mock("@eleva/db", () => ({ getExpertProfileForOrg }))

import { resolveFinanceScope } from "./finance-scope"

const user = { id: "user-1", email: "a@example.com" }

describe("resolveFinanceScope", () => {
  beforeEach(() => {
    getExpertProfileForOrg.mockReset()
  })

  it("keeps the whole org for an independent expert", async () => {
    await expect(
      resolveFinanceScope({
        user,
        orgId: "org-1",
        orgType: "expert",
        membershipRole: "admin",
      })
    ).resolves.toEqual({})
    expect(getExpertProfileForOrg).not.toHaveBeenCalled()
  })

  it("keeps the whole clinic for a clinic admin", async () => {
    await expect(
      resolveFinanceScope({
        user,
        orgId: "clinic-1",
        orgType: "team",
        membershipRole: "admin",
      })
    ).resolves.toEqual({})
  })

  it("limits a clinician to their own expert profile in that clinic", async () => {
    getExpertProfileForOrg.mockResolvedValue({ id: "profile-1" })
    await expect(
      resolveFinanceScope({
        user,
        orgId: "clinic-1",
        orgType: "team",
        membershipRole: "member",
      })
    ).resolves.toEqual({ expertProfileId: "profile-1" })
    expect(getExpertProfileForOrg).toHaveBeenCalledWith("user-1", "clinic-1")
  })

  it("denies a clinician with no expert profile in that clinic", async () => {
    getExpertProfileForOrg.mockResolvedValue(null)
    await expect(
      resolveFinanceScope({
        user,
        orgId: "clinic-1",
        orgType: "team",
        membershipRole: "member",
      })
    ).resolves.toBeNull()
  })
})
