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

  describe("getExpertProfileForOrg", () => {
    it("returns null when the user has no profile in that org", async () => {
      mockTx.select.mockReturnValueOnce(chain([]))

      const { getExpertProfileForOrg } = await import("./admin")
      const result = await getExpertProfileForOrg("user-1", "org-2")

      expect(result).toBeNull()
    })

    it("runs in the named org's context", async () => {
      const fakeProfile = { id: "profile-1", userId: "user-1", orgId: "org-1" }
      mockTx.select.mockReturnValueOnce(chain([fakeProfile]))

      const { withOrgContext } = await import("../context")
      const { getExpertProfileForOrg } = await import("./admin")
      const result = await getExpertProfileForOrg("user-1", "org-1")

      expect(result).toEqual(fakeProfile)
      expect(withOrgContext).toHaveBeenCalledWith("org-1", expect.any(Function))
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

    it("mirrors legacy practiceCountries and worldwideMode onto authoritative columns", async () => {
      const chainObj = chain([])
      mockTx.update.mockReturnValueOnce(chainObj)

      const { updateExpertProfile } = await import("./admin")
      await updateExpertProfile("profile-1", "org-1", {
        practiceCountries: ["pt", "es"],
        worldwideMode: true,
      })

      expect(chainObj.set).toHaveBeenCalledWith(
        expect.objectContaining({
          practiceCountries: ["pt", "es"],
          practiceCountry: "PT",
          serviceCountries: ["PT", "ES"],
          worldwideMode: true,
          worldwideRemote: true,
        })
      )
    })
  })

  describe("_ensureExpertProfileForOrgDetailed", () => {
    it("targets the partial user/org index, predicate included", async () => {
      const insertChain = chain([{ id: "profile-1" }])
      mockTx.insert.mockReturnValueOnce(insertChain)
      const { _ensureExpertProfileForOrgDetailed } = await import("./admin")
      const { PgDialect } = await import("drizzle-orm/pg-core")
      const main = await import("../schema/main")

      const result = await _ensureExpertProfileForOrgDetailed(
        {
          userId: "user-1",
          orgId: "org-1",
          orgSlug: "patimota",
          displayName: "Patricia Mota",
        },
        mockTx as never
      )

      expect(result.created).toBe(true)
      const config = (
        insertChain.onConflictDoNothing as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0]
      expect(config.target).toEqual([
        main.expertProfiles.userId,
        main.expertProfiles.orgId,
      ])
      // Without this, Postgres rejects the insert (42P10): the unique
      // index is `WHERE deleted_at IS NULL`.
      expect(new PgDialect().sqlToQuery(config.where).sql).toBe(
        '"expert_profiles"."deleted_at" is null'
      )
    })
  })
})
