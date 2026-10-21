import { beforeEach, describe, expect, it, vi } from "vitest"

const tx = { marker: "tx" }
const loadOfferForResolve = vi.fn()
const getScheduleForBooking = vi.fn()
const withOrgContext = vi.fn(
  async (_orgId: string, fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
)

vi.mock("@eleva/db", () => ({
  loadOfferForResolve: (...args: unknown[]) => loadOfferForResolve(...args),
  getScheduleForBooking: (...args: unknown[]) => getScheduleForBooking(...args),
  withOrgContext: (orgId: string, fn: (t: typeof tx) => Promise<unknown>) =>
    withOrgContext(orgId, fn),
}))

const { resolveOfferWithSchedule } = await import("./resolve-offer")

const loaded = {
  mode: {
    id: "mode-1",
    orgId: "org-1",
    eventTypeId: "et-1",
    mode: "online",
    scheduleId: "sched-1",
    priceCents: null,
    durationMinutes: null,
    countryScopeType: "worldwide",
    countryScopeCodes: [],
    languages: ["pt"],
    active: true,
  },
  eventType: {
    id: "et-1",
    expertProfileId: "expert-1",
    durationMinutes: 50,
    priceAmount: 6000,
    published: true,
    bookingWindowDays: 60,
    minimumNoticeMinutes: 0,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    cancellationPolicy: "flexible",
    requiresApproval: false,
    instantBookLeadMinutes: null,
  },
  link: null,
}

describe("resolveOfferWithSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads the offer and its schedule in one org transaction", async () => {
    loadOfferForResolve.mockResolvedValue(loaded)
    const schedule = {
      schedule: { id: "sched-1", timezone: "Europe/Lisbon" },
      rules: [],
      overrides: [],
    }
    getScheduleForBooking.mockResolvedValue(schedule)

    const result = await resolveOfferWithSchedule({
      expertOrgId: "org-1",
      eventTypeModeId: "mode-1",
    })

    expect(withOrgContext).toHaveBeenCalledTimes(1)
    expect(loadOfferForResolve).toHaveBeenCalledWith(
      { expertOrgId: "org-1", eventTypeModeId: "mode-1", tokenHash: undefined },
      tx
    )
    expect(getScheduleForBooking).toHaveBeenCalledWith("org-1", "sched-1", tx)
    expect(result).toMatchObject({
      ok: true,
      offer: { scheduleId: "sched-1", priceCents: 6000, durationMinutes: 50 },
      schedule,
    })
  })

  it("returns not_found without loading a schedule for an unknown mode", async () => {
    loadOfferForResolve.mockResolvedValue(null)
    const result = await resolveOfferWithSchedule({
      expertOrgId: "org-1",
      eventTypeModeId: "missing",
    })
    expect(result).toEqual({ ok: false, error: "not_found" })
    expect(getScheduleForBooking).not.toHaveBeenCalled()
  })

  it("returns not_found for an inactive mode", async () => {
    loadOfferForResolve.mockResolvedValue({
      ...loaded,
      mode: { ...loaded.mode, active: false },
    })
    const result = await resolveOfferWithSchedule({
      expertOrgId: "org-1",
      eventTypeModeId: "mode-1",
    })
    expect(result).toEqual({ ok: false, error: "not_found" })
    expect(getScheduleForBooking).not.toHaveBeenCalled()
  })
})
