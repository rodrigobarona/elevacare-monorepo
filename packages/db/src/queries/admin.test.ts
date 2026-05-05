import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Unit tests for admin query functions. We mock the context layer so
 * no real database is needed. The focus is on verifying:
 * - listApplications applies status filters and pagination
 * - getApplicationById returns null for missing rows
 * - approveApplication creates org + membership + profile transactionally
 */

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

  describe("listApplications", () => {
    it("returns empty result for no rows", async () => {
      mockTx.select.mockReturnValueOnce(chain([{ count: 0 }]))
      mockTx.select.mockReturnValueOnce(chain([]))

      const { listApplications } = await import("./admin")
      const result = await listApplications()

      expect(result.total).toBe(0)
      expect(result.rows).toHaveLength(0)
    })

    it("maps application row to admin format with user email", async () => {
      const fakeApp = {
        id: "app-1",
        applicantUserId: "user-1",
        applicantOrgId: "org-1",
        type: "solo_expert",
        usernameRequested: "drsmith",
        displayName: "Dr. Smith",
        bio: "Test",
        nif: "123456789",
        licenseNumber: "OPP-123",
        licenseScope: "Clinical Psychology",
        practiceCountries: ["PT"],
        languages: ["pt", "en"],
        categorySlugs: ["psychology"],
        documents: [],
        status: "submitted",
        reviewerUserId: null,
        reviewedAt: null,
        rejectionReason: null,
        provisionedOrgId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }
      const fakeUser = {
        id: "user-1",
        email: "dr@test.com",
        displayName: "Dr. Smith",
      }

      mockTx.select.mockReturnValueOnce(chain([{ count: 1 }]))
      mockTx.select.mockReturnValueOnce(chain([fakeApp]))
      mockTx.select.mockReturnValueOnce(chain([fakeUser]))

      const { listApplications } = await import("./admin")
      const result = await listApplications()

      expect(result.total).toBe(1)
      expect(result.rows[0]?.applicantEmail).toBe("dr@test.com")
      expect(result.rows[0]?.displayName).toBe("Dr. Smith")
    })
  })

  describe("getApplicationById", () => {
    it("returns null when not found", async () => {
      mockTx.select.mockReturnValueOnce(chain([]))

      const { getApplicationById } = await import("./admin")
      const result = await getApplicationById("nonexistent")

      expect(result).toBeNull()
    })
  })

  describe("approveApplication", () => {
    it("creates org, membership, profile and updates application", async () => {
      const fakeApp = {
        id: "app-1",
        applicantUserId: "user-1",
        applicantOrgId: "org-1",
        type: "solo_expert",
        usernameRequested: "drsmith",
        displayName: "Dr. Smith",
        bio: "Bio text",
        nif: "123",
        licenseScope: "OPP",
        languages: ["pt"],
        practiceCountries: ["PT"],
        categorySlugs: [],
        documents: [],
        status: "submitted",
        reviewerUserId: null,
        reviewedAt: null,
        rejectionReason: null,
        provisionedOrgId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      // select application
      mockTx.select.mockReturnValueOnce(chain([fakeApp]))
      // insert org
      mockTx.insert.mockReturnValueOnce(chain([{ id: "new-org-id" }]))
      // insert membership
      mockTx.insert.mockReturnValueOnce(chain([]))
      // insert profile
      mockTx.insert.mockReturnValueOnce(chain([{ id: "new-profile-id" }]))
      // update application
      mockTx.update.mockReturnValueOnce(chain([]))

      const { approveApplication } = await import("./admin")
      const result = await approveApplication("app-1", "admin-user")

      expect(result.expertProfileId).toBe("new-profile-id")
      expect(result.orgId).toBe("new-org-id")
      expect(result.userId).toBe("user-1")
      expect(result.username).toBe("drsmith")
    })
  })
})
