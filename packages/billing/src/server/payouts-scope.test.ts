import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `paymentIdsForExpert` is the access boundary for a clinic clinician's
 * payouts and finance views. Queries run through a drizzle pg-proxy so the
 * real SQL is checked: scoped calls filter on the booking's expert
 * profile, unscoped calls (independent experts, clinic admins) do not.
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
    withPlatformAdminContext: (fn: (tx: unknown) => unknown) => fn(db),
  }
})
vi.mock("@eleva/audit", () => ({
  withAudit: vi.fn(),
  withPlatformAudit: vi.fn(),
}))
vi.mock("@eleva/observability", () => ({ captureException: vi.fn() }))
vi.mock("../emit-domain-event", () => ({
  emitPaymentPayoutNotificationEvent: vi.fn(),
}))
vi.mock("./client", () => ({ stripe: vi.fn() }))

import { financeSummary, listFinanceBookings, listPayouts } from "./payouts"

const ORG_ID = "00000000-0000-4000-8000-000000000002"
const OWN_PROFILE_ID = "00000000-0000-4000-8000-000000000020"

/** Every query the call ran is limited to the clinician's own bookings. */
function expectEveryQueryScoped(expectedQueries: number) {
  expect(queries).toHaveLength(expectedQueries)
  for (const query of queries) {
    expect(query.sql).toContain('"expert_profile_id"')
    expect(query.params).toContain(OWN_PROFILE_ID)
  }
}

/** No query the call ran carries the clinician filter. */
function expectNoQueryScoped() {
  expect(queries.length).toBeGreaterThan(0)
  for (const query of queries) {
    expect(query.sql).not.toContain('"expert_profile_id"')
  }
}

describe("clinician finance scope (real SQL)", () => {
  beforeEach(() => {
    queries.length = 0
  })

  it("listPayouts filters a clinician to their own bookings", async () => {
    await listPayouts({
      orgId: ORG_ID,
      platformAdmin: false,
      expertProfileId: OWN_PROFILE_ID,
    })
    expectEveryQueryScoped(1)
  })

  it("listPayouts keeps the whole org without a scope", async () => {
    await listPayouts({ orgId: ORG_ID, platformAdmin: false })
    expectNoQueryScoped()
  })

  it("financeSummary filters a clinician to their own bookings", async () => {
    await financeSummary(ORG_ID, { expertProfileId: OWN_PROFILE_ID })
    // Payments and payout states: both queries carry the filter.
    expectEveryQueryScoped(2)
  })

  it("financeSummary keeps the whole org without a scope", async () => {
    await financeSummary(ORG_ID)
    expectNoQueryScoped()
  })

  it("listFinanceBookings filters a clinician to their own bookings", async () => {
    await listFinanceBookings(ORG_ID, { expertProfileId: OWN_PROFILE_ID })
    expectEveryQueryScoped(1)
  })

  it("listFinanceBookings keeps the whole org without a scope", async () => {
    await listFinanceBookings(ORG_ID)
    expectNoQueryScoped()
  })
})
