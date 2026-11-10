import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A clinic clinician lists only invoices for their own bookings, and that
 * holds for the cursor too: a colleague's invoice id must not resolve as a
 * page cursor (it would confirm the id exists). Queries run through a
 * drizzle pg-proxy so the real SQL can be checked.
 */

const { queries } = vi.hoisted(() => ({
  queries: [] as Array<{ sql: string; params: unknown[] }>,
}))

vi.mock("@eleva/db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy")
  const main = await import("@eleva/db/schema")
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params })
    return { rows: [] }
  })
  return {
    main,
    withOrgContext: (_orgId: string, fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock("@eleva/audit", () => ({ withAudit: vi.fn() }))
vi.mock("@eleva/flags", () => ({ getFlag: vi.fn() }))
vi.mock("./dispatch", () => ({ issueExpertServiceInvoice: vi.fn() }))

import { listExpertInvoices } from "./invoice-ops"

const ORG_ID = "00000000-0000-4000-8000-000000000002"
const OWN_PROFILE_ID = "00000000-0000-4000-8000-000000000020"
const COLLEAGUE_INVOICE_ID = "00000000-0000-4000-8000-000000000030"

describe("listExpertInvoices clinician scope", () => {
  beforeEach(() => {
    queries.length = 0
  })

  it("checks a clinician's cursor against their own bookings", async () => {
    await expect(
      listExpertInvoices({
        orgId: ORG_ID,
        cursor: COLLEAGUE_INVOICE_ID,
        expertProfileId: OWN_PROFILE_ID,
      })
    ).resolves.toEqual({ invoices: [], nextCursor: null })

    // The cursor lookup is the only query: an unknown cursor ends the page.
    expect(queries).toHaveLength(1)
    const [cursorLookup] = queries
    expect(cursorLookup?.sql).toContain('"expert_profile_id"')
    expect(cursorLookup?.params).toEqual(
      expect.arrayContaining([COLLEAGUE_INVOICE_ID, OWN_PROFILE_ID])
    )
  })

  it("filters the page itself to a clinician's own bookings", async () => {
    await listExpertInvoices({ orgId: ORG_ID, expertProfileId: OWN_PROFILE_ID })
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toContain('"expert_profile_id"')
    expect(queries[0]?.params).toContain(OWN_PROFILE_ID)
  })

  it("keeps the whole org for experts and clinic admins", async () => {
    await listExpertInvoices({ orgId: ORG_ID, cursor: COLLEAGUE_INVOICE_ID })
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).not.toContain('"expert_profile_id"')
  })
})
