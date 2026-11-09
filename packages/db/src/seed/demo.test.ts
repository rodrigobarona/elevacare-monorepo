import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Unit tests for the demo seed. The @eleva/db client is mocked so we
 * do not need a live Neon connection — we verify the contract:
 *
 *   - Three personas seeded: expert, team, personal.
 *   - Idempotent: when select returns an existing row, we do NOT
 *     re-insert.
 *   - Each persona produces one user row + one org row + one membership.
 */

describe("seedDemo", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function setup({
    userExists = false,
    orgExists = false,
    memExists = false,
  } = {}) {
    const ensureFixtureLicenceApproved = vi.fn().mockResolvedValue(undefined)
    const returning = vi.fn().mockResolvedValue([{ id: "new-id" }])
    const valuesInsert = vi.fn().mockReturnValue({ returning })
    const valuesInsertVoid = vi.fn().mockResolvedValue(undefined)
    const insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((row: unknown) => {
        if (
          (row as { role?: string }).role &&
          !(row as { email?: string }).email
        ) {
          return valuesInsertVoid(row)
        }
        return valuesInsert(row)
      }),
    }))

    const selectChain = () => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    })
    let selectCall = 0
    const select = vi.fn().mockImplementation(() => {
      const chain = selectChain()
      selectCall += 1
      const pos = ((selectCall - 1) % 3) + 1
      ;(chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(
        (pos === 1 && userExists) ||
          (pos === 2 && orgExists) ||
          (pos === 3 && memExists)
          ? [{ id: `existing-${pos}` }]
          : []
      )
      return chain
    })

    vi.doMock("../client", () => ({
      db: () => ({ insert, select, update: vi.fn() }),
    }))
    vi.doMock("../schema/auth", () => ({
      user: { id: {}, email: {}, name: {}, emailVerified: {} },
      organization: { id: {}, slug: {}, name: {}, type: {} },
      member: { id: {}, userId: {}, organizationId: {}, role: {} },
    }))
    vi.doMock("../schema/main", () => ({
      expertProfiles: {
        id: {},
        username: {},
        userId: {},
        orgId: {},
        displayName: {},
        status: {},
      },
      clinicProfiles: { id: {}, slug: {}, orgId: {}, displayName: {} },
    }))
    vi.doMock("../context", () => ({
      withPlatformAdminContext: <T>(fn: (tx: unknown) => Promise<T>) =>
        fn({ insert, select }),
    }))
    vi.doMock("./licence-fixture", () => ({ ensureFixtureLicenceApproved }))
    vi.doMock("drizzle-orm", async () => {
      const actual =
        await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm")
      return { ...actual }
    })

    const { seedDemo } = await import("./demo")
    return { seedDemo, insert, select, ensureFixtureLicenceApproved }
  }

  it("seeds three personas with user + org + membership rows each plus profile rows", async () => {
    const { seedDemo, insert, ensureFixtureLicenceApproved } = await setup()
    const results = await seedDemo()
    expect(results).toHaveLength(3)
    expect(results.map((r) => r.email).sort()).toEqual([
      "clinic.admin@example.test",
      "member.demo@example.test",
      "pat.mota@example.test",
    ])
    // Three personas * (user + org + membership) = 9 inserts
    // plus expert_profiles + clinic_profiles.
    expect(insert).toHaveBeenCalledTimes(11)
    // The expert fixture is public only with an approved licence row.
    expect(ensureFixtureLicenceApproved).toHaveBeenCalledTimes(1)
    // patimota carries her public Ordem dos Fisioterapeutas cédula.
    expect(ensureFixtureLicenceApproved).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        licence: {
          professionalBody: "ordem_fisioterapeutas",
          licenceNumber: "9115",
          ersRegistrationNumber: "182844",
        },
      })
    )
  })

  it("is idempotent when all rows already exist", async () => {
    const { seedDemo, insert } = await setup({
      userExists: true,
      orgExists: true,
      memExists: true,
    })
    const results = await seedDemo()
    expect(results).toHaveLength(3)
    expect(insert).not.toHaveBeenCalled()
  })
})
