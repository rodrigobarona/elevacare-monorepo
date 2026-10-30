import { beforeEach, describe, expect, it, vi } from "vitest"

const emit = vi.fn()
const emitEvent = vi.fn()
const updates: Array<Record<string, unknown>> = []
let selects: unknown[][]

function chain(rows: unknown[]) {
  const query = {
    from: () => query,
    where: () => query,
    limit: () => query,
    for: () => query,
    then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
  }
  return query
}

const tx = {
  select: () => chain(selects.shift() ?? []),
  update: () => ({
    set: (values: Record<string, unknown>) => {
      updates.push(values)
      return { where: async () => undefined }
    },
  }),
}

vi.mock("@eleva/db", () => ({
  main: {
    OPEN_PARTNER_APPLICATION_STATUSES: ["pending", "needs_changes"],
    becomePartnerApplications: {},
    expertProfiles: {},
  },
  withPlatformAdminContext: (fn: (t: typeof tx) => unknown) => fn(tx),
}))
vi.mock("@eleva/db/queries/partner-applications", () => ({
  _emitPartnerDecisionEvent: (...args: unknown[]) => emitEvent(...args),
}))
vi.mock("@eleva/audit", () => ({
  withPlatformAudit: async (
    _options: unknown,
    fn: (t: typeof tx, ctx: { emit: typeof emit }) => unknown
  ) => fn(tx, { emit }),
}))
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}))

import { decideLicenceApplication, PartnerReviewError } from "./partner-review"

const SUBMITTED = new Date("2026-10-30T10:00:00.000Z")
const CHECKLIST = {
  register_checked: true,
  name_matches: true,
  ers_checked: true,
} as const
const APPLICATION = {
  id: "application-1",
  status: "pending",
  professionalBody: "ordem_psicologos",
  licenceNumber: "12345",
  ersRegistrationNumber: "E123",
  submittedAt: SUBMITTED,
}

function decide(
  decision: Parameters<typeof decideLicenceApplication>[0]["decision"],
  overrides: Partial<Parameters<typeof decideLicenceApplication>[0]> = {}
) {
  return decideLicenceApplication({
    expertProfileId: "profile-1",
    applicationId: "application-1",
    submittedAt: SUBMITTED,
    actorUserId: "staff-1",
    decision,
    ...overrides,
  })
}

function queue(profileStatus: string, application: unknown = APPLICATION) {
  selects = [
    [{ orgId: "org-1" }],
    [{ status: profileStatus, userId: "expert-1" }],
    application ? [application] : [],
  ]
}

describe("decideLicenceApplication", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updates.length = 0
  })

  it("approve records the verification and lists an approved profile", async () => {
    queue("approved")
    await expect(
      decide({ decision: "approve", checklist: CHECKLIST })
    ).resolves.toEqual({ status: "approved", profileStatus: "active" })

    expect(updates[0]).toMatchObject({
      status: "approved",
      reviewerUserId: "staff-1",
      reason: null,
      checklist: CHECKLIST,
    })
    expect(updates[0]?.reviewedAt).toBeInstanceOf(Date)
    expect(updates[1]).toMatchObject({
      status: "active",
      licenceNumber: "12345",
    })
    expect(emitEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: "partner.approved", reason: null })
    )
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "partner_application",
        action: "approved",
      })
    )
  })

  it("approve keeps an active profile active", async () => {
    queue("active")
    await expect(
      decide({ decision: "approve", checklist: CHECKLIST })
    ).resolves.toEqual({ status: "approved", profileStatus: "active" })
  })

  it("approve does not lift a suspension", async () => {
    queue("suspended")
    await expect(
      decide({ decision: "approve", checklist: CHECKLIST })
    ).resolves.toEqual({ status: "approved", profileStatus: "suspended" })
  })

  it.each([
    [
      "needs_changes",
      "needs_changes",
      "partner.needs_changes",
      "changes_requested",
    ],
    ["reject", "rejected", "partner.rejected", "rejected"],
  ] as const)(
    "%s keeps the reason and leaves the profile alone",
    async (decision, status, type, action) => {
      queue("active")
      await expect(
        decide({ decision, reason: "Number not on the register" })
      ).resolves.toEqual({ status, profileStatus: "active" })

      expect(updates).toHaveLength(1)
      expect(updates[0]).toMatchObject({
        status,
        reason: "Number not on the register",
        checklist: {},
      })
      expect(emitEvent).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ type, reason: "Number not on the register" })
      )
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({ action }))
    }
  )

  it("refuses an unknown application", async () => {
    selects = [[]]
    await expect(
      decide({ decision: "reject", reason: "x" })
    ).rejects.toMatchObject({ code: "APPLICATION_NOT_FOUND", status: 404 })
  })

  it("refuses a decided application", async () => {
    queue("approved", null)
    await expect(
      decide({ decision: "reject", reason: "x" })
    ).rejects.toMatchObject({
      code: "APPLICATION_ALREADY_DECIDED",
      status: 409,
    })
    expect(updates).toHaveLength(0)
  })

  it("refuses a decision on a filing staff have not seen", async () => {
    queue("approved")
    await expect(
      decide(
        { decision: "approve", checklist: CHECKLIST },
        { submittedAt: new Date("2026-10-29T10:00:00.000Z") }
      )
    ).rejects.toMatchObject({ code: "APPLICATION_CHANGED", status: 409 })
    expect(updates).toHaveLength(0)
  })

  it("refuses staff deciding their own application", async () => {
    queue("approved")
    await expect(
      decide(
        { decision: "approve", checklist: CHECKLIST },
        { actorUserId: "expert-1" }
      )
    ).rejects.toBeInstanceOf(PartnerReviewError)
    expect(updates).toHaveLength(0)
    expect(emit).not.toHaveBeenCalled()
  })
})
