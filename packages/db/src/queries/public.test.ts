import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Unit tests for the public marketplace queries. We mock
 * `withPlatformAdminContext` so the query builders run against a
 * fake transaction handle that records its calls. The intent is to
 * verify behavioural contracts (reserved-name shortcuts, format
 * filtering, pagination clamps, soft-delete filters), not raw SQL.
 */

interface QueryRecorder {
  selectCalls: unknown[]
  whereCalls: unknown[]
  limitCalls: number[]
  orderByCalls: unknown[]
  offsetCalls: number[]
  innerJoinCalls: unknown[]
}

function makeFakeTx(rowsByCall: unknown[][]) {
  const recorder: QueryRecorder = {
    selectCalls: [],
    whereCalls: [],
    limitCalls: [],
    orderByCalls: [],
    offsetCalls: [],
    innerJoinCalls: [],
  }

  let callIndex = 0
  function nextRows(): unknown[] {
    const r = rowsByCall[callIndex] ?? []
    callIndex += 1
    return r
  }

  /**
   * Build a thenable chain that records its calls and resolves to the
   * next queued rows when awaited. Drizzle exposes the same builder
   * shape both for terminal queries (await select().from().where())
   * and for ones that go on to limit/offset, so every method must
   * return the same proxy object.
   */
  function chain(rowsResolver: () => unknown[]): Record<string, unknown> {
    const c: Record<string, unknown> = {}
    c.from = vi.fn().mockReturnValue(c)
    c.innerJoin = vi.fn().mockImplementation((...args: unknown[]) => {
      recorder.innerJoinCalls.push(args)
      return c
    })
    c.where = vi.fn().mockImplementation((arg: unknown) => {
      recorder.whereCalls.push(arg)
      return c
    })
    c.orderBy = vi.fn().mockImplementation((...args: unknown[]) => {
      recorder.orderByCalls.push(args)
      return c
    })
    c.limit = vi.fn().mockImplementation((n: number) => {
      recorder.limitCalls.push(n)
      return c
    })
    c.offset = vi.fn().mockImplementation((n: number) => {
      recorder.offsetCalls.push(n)
      return c
    })
    c.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(rowsResolver()).then(onFulfilled, onRejected)
    return c
  }

  const tx = {
    select: vi.fn().mockImplementation((projection: unknown) => {
      recorder.selectCalls.push(projection)
      return chain(() => nextRows())
    }),
  }

  return { tx, recorder }
}

describe("public queries", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function loadModule(rowsByCall: unknown[][]) {
    const { tx, recorder } = makeFakeTx(rowsByCall)
    vi.doMock("../context", () => ({
      withPlatformAdminContext: <T>(fn: (h: unknown) => Promise<T>) => fn(tx),
    }))
    vi.doMock("../schema/main", () => ({
      expertProfiles: {
        id: { name: "id" },
        username: { name: "username" },
        displayName: { name: "displayName" },
        headline: { name: "headline" },
        bio: { name: "bio" },
        avatarUrl: { name: "avatarUrl" },
        languages: { name: "languages" },
        practiceCountries: { name: "practiceCountries" },
        sessionModes: { name: "sessionModes" },
        topExpertActive: { name: "topExpertActive" },
        worldwideMode: { name: "worldwideMode" },
        status: { name: "status" },
        deletedAt: { name: "deletedAt" },
      },
      clinicProfiles: {
        id: { name: "id" },
        slug: { name: "slug" },
        displayName: { name: "displayName" },
        description: { name: "description" },
        logoUrl: { name: "logoUrl" },
        websiteUrl: { name: "websiteUrl" },
        countryCode: { name: "countryCode" },
        deletedAt: { name: "deletedAt" },
      },
      expertCategories: {
        id: { name: "id" },
        slug: { name: "slug" },
        displayName: { name: "displayName" },
        description: { name: "description" },
        icon: { name: "icon" },
        sortOrder: { name: "sortOrder" },
      },
      expertListings: {
        expertProfileId: { name: "expertProfileId" },
        categoryId: { name: "categoryId" },
        sortOrder: { name: "sortOrder" },
      },
      becomePartnerApplications: {
        id: { name: "id" },
        usernameRequested: { name: "usernameRequested" },
        status: { name: "status" },
      },
    }))

    const mod = await import("./public")
    return { mod, recorder }
  }

  it("findExpertByUsername short-circuits reserved names", async () => {
    const { mod, recorder } = await loadModule([])
    const result = await mod.findExpertByUsername("admin")
    expect(result).toBeNull()
    expect(recorder.selectCalls).toHaveLength(0)
  })

  it("findExpertByUsername short-circuits empty input", async () => {
    const { mod, recorder } = await loadModule([])
    const result = await mod.findExpertByUsername("   ")
    expect(result).toBeNull()
    expect(recorder.selectCalls).toHaveLength(0)
  })

  it("findExpertByUsername returns null when no row matches", async () => {
    const { mod } = await loadModule([[]])
    const result = await mod.findExpertByUsername("ana-silva")
    expect(result).toBeNull()
  })

  it("findExpertByUsername joins category slugs onto the profile", async () => {
    const expertRow = {
      id: "expert-1",
      username: "ana-silva",
      displayName: "Ana Silva",
      headline: null,
      bio: null,
      avatarUrl: null,
      languages: ["pt"],
      practiceCountries: ["PT"],
      sessionModes: ["online"],
      topExpertActive: true,
      worldwideMode: false,
    }
    const { mod } = await loadModule([
      [expertRow],
      [{ slug: "pelvic-health" }, { slug: "wellness" }],
    ])
    const result = await mod.findExpertByUsername("Ana-Silva")
    expect(result).toMatchObject({
      id: "expert-1",
      username: "ana-silva",
      categorySlugs: ["pelvic-health", "wellness"],
    })
  })

  it("findClinicBySlug rejects reserved slugs without hitting the db", async () => {
    const { mod, recorder } = await loadModule([])
    const result = await mod.findClinicBySlug("admin")
    expect(result).toBeNull()
    expect(recorder.selectCalls).toHaveLength(0)
  })

  it("findClinicBySlug returns the row when found", async () => {
    const clinic = {
      id: "clinic-1",
      slug: "clinica-mota",
      displayName: "Clinica Mota",
      description: null,
      logoUrl: null,
      websiteUrl: null,
      countryCode: "PT",
    }
    const { mod } = await loadModule([[clinic]])
    const result = await mod.findClinicBySlug("Clinica-Mota")
    expect(result).toEqual(clinic)
  })

  it("checkPublicSlugAvailability rejects reserved", async () => {
    const { mod } = await loadModule([])
    expect(await mod.checkPublicSlugAvailability("admin")).toEqual({
      available: false,
      reason: "reserved",
    })
  })

  it("checkPublicSlugAvailability rejects empty after trim", async () => {
    const { mod } = await loadModule([])
    expect(await mod.checkPublicSlugAvailability("   ")).toEqual({
      available: false,
      reason: "format-invalid",
    })
  })

  it("checkPublicSlugAvailability flags expert collisions first", async () => {
    const { mod } = await loadModule([[{ id: "expert-hit" }]])
    expect(await mod.checkPublicSlugAvailability("ana-silva")).toEqual({
      available: false,
      reason: "expert-taken",
    })
  })

  it("checkPublicSlugAvailability flags clinic collisions next", async () => {
    const { mod } = await loadModule([[], [{ id: "clinic-hit" }]])
    expect(await mod.checkPublicSlugAvailability("clinica-mota")).toEqual({
      available: false,
      reason: "clinic-taken",
    })
  })

  it("checkPublicSlugAvailability flags pending applications", async () => {
    const { mod } = await loadModule([[], [], [{ id: "app-hit" }]])
    expect(await mod.checkPublicSlugAvailability("ana-silva")).toEqual({
      available: false,
      reason: "pending-application",
    })
  })

  it("checkPublicSlugAvailability returns available when no hits", async () => {
    const { mod } = await loadModule([[], [], []])
    expect(await mod.checkPublicSlugAvailability("ana-silva")).toEqual({
      available: true,
    })
  })

  it("listCategories proxies through the platform-admin context", async () => {
    const cats = [
      {
        id: "c1",
        slug: "pelvic-health",
        displayName: { en: "Pelvic Health" },
        description: null,
        icon: null,
        sortOrder: 1,
      },
    ]
    const { mod } = await loadModule([cats])
    const result = await mod.listCategories()
    expect(result).toEqual(cats)
  })

  it("listExperts clamps page size between 1 and 50", async () => {
    const { mod, recorder } = await loadModule([[{ count: 0 }], []])
    await mod.listExperts({ page: 0, pageSize: 999 })
    expect(recorder.limitCalls).toContain(50)
    expect(recorder.offsetCalls.every((o) => o >= 0)).toBe(true)
  })

  it("listExperts paginates with offset = (page - 1) * pageSize", async () => {
    const { mod, recorder } = await loadModule([[{ count: 100 }], []])
    await mod.listExperts({ page: 3, pageSize: 24 })
    expect(recorder.limitCalls).toContain(24)
    expect(recorder.offsetCalls).toContain(48)
  })

  it("listExperts skips listings join when no experts match", async () => {
    const { mod, recorder } = await loadModule([[{ count: 0 }], []])
    const result = await mod.listExperts()
    expect(result).toEqual({
      experts: [],
      total: 0,
      page: 1,
      pageSize: 24,
    })
    expect(recorder.innerJoinCalls).toHaveLength(0)
  })
})
