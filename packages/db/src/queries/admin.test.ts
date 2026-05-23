import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockTx = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
}

function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {}
  c.from = vi.fn().mockReturnValue(c)
  c.where = vi.fn().mockReturnValue(c)
  c.orderBy = vi.fn().mockReturnValue(c)
  c.limit = vi.fn().mockReturnValue(c)
  c.offset = vi.fn().mockReturnValue(c)
  c.values = vi.fn().mockReturnValue(c)
  c.returning = vi.fn().mockReturnValue(rows)
  c.onConflictDoUpdate = vi.fn().mockReturnValue(c)
  c.onConflictDoNothing = vi.fn().mockReturnValue(c)
  c.set = vi.fn().mockReturnValue(c)
  c.then = vi.fn((resolve: (v: unknown) => void) => resolve(rows))
  return c
}

vi.mock("../context", () => ({
  withPlatformAdminContext: vi.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockTx)
    }
  ),
  withOrgContext: vi.fn(
    async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => {
      return fn(mockTx)
    }
  ),
}))

describe("admin queries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getExpertProfileByUserId", () => {
    it("returns null when no profile found", async () => {
      mockTx.select.mockReturnValueOnce(chain([]))

      const { getExpertProfileByUserId } = await import("./admin")
      const result = await getExpertProfileByUserId("nonexistent")

      expect(result).toBeNull()
    })

    it("returns profile when found", async () => {
      const fakeProfile = {
        id: "profile-1",
        userId: "user-1",
        orgId: "org-1",
        username: "drsmith",
        displayName: "Dr. Smith",
        status: "draft",
      }
      mockTx.select.mockReturnValueOnce(chain([fakeProfile]))

      const { getExpertProfileByUserId } = await import("./admin")
      const result = await getExpertProfileByUserId("user-1")

      expect(result).toEqual(fakeProfile)
    })
  })

  describe("updateExpertProfile", () => {
    it("calls update with set and where using correct args", async () => {
      const chainObj = chain([])
      mockTx.update.mockReturnValueOnce(chainObj)

      const { updateExpertProfile } = await import("./admin")
      await updateExpertProfile("profile-1", "org-1", {
        displayName: "New Name",
      })

      expect(mockTx.update).toHaveBeenCalled()
      expect(chainObj.set).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: "New Name" })
      )
      expect(chainObj.where).toHaveBeenCalled()
    })
  })
})
