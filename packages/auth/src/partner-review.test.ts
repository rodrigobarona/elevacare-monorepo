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
const readReview = vi.fn()
vi.mock("@eleva/db/queries/partner-applications", () => ({
  _emitPartnerDecisionEvent: (...args: unknown[]) => emitEvent(...args),
  _readLicenceReview: (...args: unknown[]) => readReview(...args),
}))
const auditOptions = vi.fn()
vi.mock("@eleva/audit", () => ({
  withPlatformAudit: async (
    options: unknown,
    fn: (t: typeof tx, ctx: { emit: typeof emit }) => unknown
  ) => {
    auditOptions(options)
    return fn(tx, { emit })
  },
}))
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
}))

import {
  decideLicenceApplication,
  openLicenceReview,
  PartnerReviewError,
} from "./partner-review"

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

  it("rejecting a listed profile unlists it and records why", async () => {
    queue("active")
    await expect(
      decide({ decision: "reject", reason: "Number not on the register" })
    ).resolves.toEqual({ status: "rejected", profileStatus: "approved" })

    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({
      status: "rejected",
      reason: "Number not on the register",
      checklist: {},
    })
    expect(updates[1]).toMatchObject({ status: "approved" })
    expect(updates[1]).not.toHaveProperty("licenceNumber")
    expect(emitEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: "partner.rejected",
        reason: "Number not on the register",
      })
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rejected",
        payload: expect.objectContaining({
          profileStatusBefore: "active",
          profileStatus: "approved",
        }),
      })
    )
  })

  it.each(["approved", "suspended"])(
    "rejecting a %s profile leaves its status alone",
    async (status) => {
      queue(status)
      await expect(
        decide({ decision: "reject", reason: "x" })
      ).resolves.toEqual({ status: "rejected", profileStatus: status })
      expect(updates).toHaveLength(1)
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

describe("openLicenceReview", () => {
  const REVIEW = {
    profile: { id: "profile-1" },
    email: "ana@example.test",
    reviewState: "pending",
    application: { id: "application-1", licenceNumber: "12345" },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("records who opened whose licence, without the numbers", async () => {
    selects = [[{ orgId: "org-1" }]]
    readReview.mockResolvedValue(REVIEW)
    await expect(
      openLicenceReview("profile-1", { actorUserId: "staff-1" })
    ).resolves.toBe(REVIEW)
    // On the record: the staff member who opened it, in the expert's org.
    expect(auditOptions).toHaveBeenCalledWith({
      orgId: "org-1",
      actorUserId: "staff-1",
    })
    // Read inside the audited transaction.
    expect(readReview).toHaveBeenCalledWith(tx, "profile-1")
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith({
      entity: "partner_application",
      action: "opened",
      entityId: "application-1",
      payload: { expertProfileId: "profile-1", reviewState: "pending" },
    })
    // Never the email or the licence number.
    expect(JSON.stringify(emit.mock.calls)).not.toMatch(/example\.test|12345/)
  })

  it("records a profile that never filed, with no application to name", async () => {
    selects = [[{ orgId: "org-1" }]]
    readReview.mockResolvedValue({ ...REVIEW, application: null })
    await openLicenceReview("profile-1", { actorUserId: "staff-1" })
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: null })
    )
  })

  it("answers null for an unknown profile and records nothing", async () => {
    selects = [[]]
    await expect(
      openLicenceReview("profile-1", { actorUserId: "staff-1" })
    ).resolves.toBeNull()
    expect(readReview).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it("answers null and records nothing when the profile goes between the two reads", async () => {
    selects = [[{ orgId: "org-1" }]]
    readReview.mockResolvedValue(null)
    await expect(
      openLicenceReview("profile-1", { actorUserId: "staff-1" })
    ).resolves.toBeNull()
    expect(emit).not.toHaveBeenCalled()
  })

  it("shows nothing when the record cannot be written", async () => {
    selects = [[{ orgId: "org-1" }]]
    readReview.mockResolvedValue(REVIEW)
    emit.mockRejectedValueOnce(new Error("audit store down"))
    await expect(
      openLicenceReview("profile-1", { actorUserId: "staff-1" })
    ).rejects.toThrow("audit store down")
  })
})
