import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ElevaSession } from "@eleva/auth"

const { resolveFinanceScope, financeSummary, listFinanceBookings } = vi.hoisted(
  () => ({
    resolveFinanceScope: vi.fn(),
    financeSummary: vi.fn(async () => ({ grossCents: 0 })),
    listFinanceBookings: vi.fn(async () => []),
  })
)

vi.mock("@eleva/auth/finance-scope", () => ({ resolveFinanceScope }))
vi.mock("@eleva/billing/server", () => ({
  financeSummary,
  listFinanceBookings,
}))

import { loadFinanceOverview } from "./finance-overview"

const session = {
  user: { id: "user-1", email: "a@example.com" },
  orgId: "clinic-1",
  orgSlug: "clinic",
  productLabel: "expert",
  orgType: "team",
  membershipRole: "member",
  capabilities: ["payouts:view_own"],
} satisfies ElevaSession

describe("loadFinanceOverview", () => {
  beforeEach(() => {
    resolveFinanceScope.mockReset()
    financeSummary.mockClear()
    listFinanceBookings.mockClear()
  })

  it("reads only a clinic clinician's own bookings", async () => {
    resolveFinanceScope.mockResolvedValue({ expertProfileId: "profile-1" })
    await expect(loadFinanceOverview(session)).resolves.toEqual({
      summary: { grossCents: 0 },
      bookings: [],
    })
    expect(resolveFinanceScope).toHaveBeenCalledWith(session)
    expect(financeSummary).toHaveBeenCalledWith("clinic-1", {
      expertProfileId: "profile-1",
    })
    expect(listFinanceBookings).toHaveBeenCalledWith("clinic-1", {
      expertProfileId: "profile-1",
    })
  })

  it("reads the whole org when the scope allows it", async () => {
    resolveFinanceScope.mockResolvedValue({})
    await loadFinanceOverview({
      ...session,
      orgType: "expert",
      membershipRole: "admin",
    })
    expect(financeSummary).toHaveBeenCalledWith("clinic-1", {})
  })

  it("reads nothing for a clinician without a profile here", async () => {
    resolveFinanceScope.mockResolvedValue(null)
    await expect(loadFinanceOverview(session)).resolves.toBeNull()
    expect(financeSummary).not.toHaveBeenCalled()
    expect(listFinanceBookings).not.toHaveBeenCalled()
  })
})
