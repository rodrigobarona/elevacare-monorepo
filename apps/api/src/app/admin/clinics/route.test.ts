import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class ClinicReviewError extends Error {
    constructor(
      readonly code: string,
      readonly status: number
    ) {
      super(code)
    }
  }
  return {
    ClinicReviewError,
    readAuth: vi.fn(),
    writeAuth: vi.fn(),
    listQueue: vi.fn(),
    getReview: vi.fn(),
    decide: vi.fn(),
  }
})

vi.mock("@eleva/auth/clinic-review", () => ({
  ClinicReviewError: mocks.ClinicReviewError,
  listClinicVerificationQueue: (...args: unknown[]) => mocks.listQueue(...args),
  getClinicVerificationReview: (...args: unknown[]) => mocks.getReview(...args),
  decideClinicVerification: (...args: unknown[]) => mocks.decide(...args),
}))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: (...args: unknown[]) => mocks.readAuth(...args),
  requireRevocableApiCapability: (...args: unknown[]) =>
    mocks.writeAuth(...args),
  apiAuthFailure: (err: Error) =>
    err.message === "forbidden"
      ? Response.json({ error: "forbidden" }, { status: 403 })
      : null,
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "clinics",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST as decide } from "./[verificationId]/decision/route"
import { GET as getOne } from "./[verificationId]/route"
import { GET as getQueue } from "./route"

const ID = "00000000-0000-4000-8000-000000000001"
const ORG_ID = "00000000-0000-4000-8000-000000000002"
const URL = "http://127.0.0.1:3002/admin/clinics"
const SUBMITTED_AT = "2026-11-20T10:00:00.000Z"

const filing = {
  id: ID,
  status: "pending",
  legalName: "Clínica Lumen, Lda",
  taxId: "PT515001708",
  submittedAt: new Date(SUBMITTED_AT),
  reviewedAt: null,
  reason: null,
}

function detail(id = ID) {
  return getOne(new Request(`${URL}/${id}`), {
    params: Promise.resolve({ verificationId: id }),
  })
}

function post(body: unknown, id = ID) {
  return decide(
    new Request(`${URL}/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ verificationId: id }) }
  )
}

const approve = {
  decision: "approve",
  submittedAt: SUBMITTED_AT,
  checklist: { legal_entity_checked: true, tax_id_checked: true },
}

/** A page as the domain returns it. */
function queuePage<Row>(items: Row[]) {
  return { items, total: items.length, page: 1, pages: 1, pageSize: 25 }
}

describe("/admin/clinics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readAuth.mockResolvedValue({
      user: { id: "staff-1" },
      orgId: "staff-org",
    })
    // A console session that started a moment ago.
    mocks.writeAuth.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "cookie",
      authenticatedAt: new Date(),
    })
  })

  it("refuses everyone without applications:review", async () => {
    mocks.readAuth.mockRejectedValue(new Error("forbidden"))
    mocks.writeAuth.mockRejectedValue(new Error("forbidden"))
    expect((await getQueue(new Request(URL))).status).toBe(403)
    expect((await detail()).status).toBe(403)
    expect((await post(approve)).status).toBe(403)
    expect(mocks.readAuth).toHaveBeenCalledWith(
      expect.anything(),
      "applications:review"
    )
    // A decision needs a credential that can be revoked.
    expect(mocks.writeAuth).toHaveBeenCalledWith(
      expect.anything(),
      "applications:review"
    )
    expect(mocks.listQueue).not.toHaveBeenCalled()
    expect(mocks.getReview).not.toHaveBeenCalled()
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it("asks a browser session that started long ago to sign in again before deciding", async () => {
    const hoursAgo = (hours: number) =>
      new Date(Date.now() - hours * 60 * 60 * 1000)
    mocks.decide.mockResolvedValue({ status: "approved", verified: true })

    // Left open since yesterday: no decision, whatever the capability.
    mocks.writeAuth.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "cookie",
      authenticatedAt: hoursAgo(13),
    })
    const stale = await post(approve)
    expect(stale.status).toBe(403)
    await expect(stale.json()).resolves.toMatchObject({
      error: "STEP_UP_REQUIRED",
    })
    expect(mocks.decide).not.toHaveBeenCalled()

    // Signed in this morning: decides.
    mocks.writeAuth.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "cookie",
      authenticatedAt: hoursAgo(3),
    })
    expect((await post(approve)).status).toBe(200)

    // A session whose start cannot be read is old, not an API key.
    mocks.writeAuth.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "bearer",
      authenticatedAt: null,
    })
    expect((await post(approve)).status).toBe(403)

    // An API key has no sign-in moment and does not expire: it cannot decide.
    mocks.writeAuth.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "api-key",
      authenticatedAt: null,
    })
    const viaKey = await post(approve)
    expect(viaKey.status).toBe(403)
    await expect(viaKey.json()).resolves.toMatchObject({
      code: "STEP_UP_REQUIRED",
      message:
        "A decision needs a signed-in session from today. An API key cannot decide.",
    })
    expect(mocks.decide).toHaveBeenCalledTimes(1)
  })

  it("reads the queue and a filing with a session of any age", async () => {
    mocks.readAuth.mockResolvedValue({
      user: { id: "staff-1" },
      orgId: "staff-org",
      authenticatedAt: new Date(0),
    })
    mocks.listQueue.mockResolvedValue(queuePage([]))
    expect((await getQueue(new Request(URL))).status).toBe(200)
  })

  it("lists one page of the queue, and says where it sits", async () => {
    mocks.listQueue.mockResolvedValue({
      ...queuePage([
        {
          verificationId: ID,
          orgId: ORG_ID,
          clinicName: "Clínica Lumen",
          legalName: "Clínica Lumen, Lda",
          countryCode: "PT",
          status: "pending",
          verified: false,
          waitingSince: new Date(SUBMITTED_AT),
        },
      ]),
      total: 51,
      page: 3,
      pages: 3,
    })
    const res = await getQueue(new Request(`${URL}?page=3`))
    expect(res.status).toBe(200)
    // The read is recorded for this staff member, in the staff workspace.
    expect(mocks.listQueue).toHaveBeenCalledWith({
      page: 3,
      viewer: { actorUserId: "staff-1", orgId: "staff-org" },
    })
    await expect(res.json()).resolves.toEqual({
      total: 51,
      page: 3,
      pages: 3,
      pageSize: 25,
      items: [
        {
          verificationId: ID,
          orgId: ORG_ID,
          clinicName: "Clínica Lumen",
          legalName: "Clínica Lumen, Lda",
          countryCode: "PT",
          status: "pending",
          verified: false,
          waitingSince: SUBMITTED_AT,
        },
      ],
    })
  })

  it("starts at the first page, and refuses a page that is not a number", async () => {
    mocks.listQueue.mockResolvedValue(queuePage([]))
    await getQueue(new Request(URL))
    expect(mocks.listQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 })
    )
    for (const page of ["0", "-1", "abc", "1.5", "99999"]) {
      const res = await getQueue(new Request(`${URL}?page=${page}`))
      expect(res.status, page).toBe(422)
    }
    expect(mocks.listQueue).toHaveBeenCalledTimes(1)
  })

  it("returns one filing, or 404 and 422", async () => {
    mocks.getReview.mockResolvedValueOnce({
      verification: filing,
      clinic: {
        orgId: ORG_ID,
        displayName: "Clínica Lumen",
        slug: "clinica-lumen",
        websiteUrl: null,
        countryCode: "PT",
        billingAddress: { city: "Lisboa", country: "PT" },
      },
      owner: { name: "Ana Mota" },
      people: 3,
      verified: false,
      history: [],
    })
    const res = await detail()
    expect(res.status).toBe(200)
    // The read is recorded for the staff member who opened the filing.
    expect(mocks.getReview).toHaveBeenCalledWith(ID, {
      actorUserId: "staff-1",
    })
    await expect(res.json()).resolves.toMatchObject({
      verification: { submittedAt: SUBMITTED_AT, reviewedAt: null },
      owner: { name: "Ana Mota" },
      people: 3,
    })
    mocks.getReview.mockResolvedValueOnce(null)
    expect((await detail()).status).toBe(404)
    expect((await detail("not-a-uuid")).status).toBe(422)
  })

  it("records a decision as the staff member", async () => {
    mocks.decide.mockResolvedValue({ status: "approved", verified: true })
    const res = await post(approve)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "approved",
      verified: true,
    })
    expect(mocks.decide).toHaveBeenCalledWith({
      verificationId: ID,
      submittedAt: new Date(SUBMITTED_AT),
      actorUserId: "staff-1",
      decision: { decision: "approve", checklist: approve.checklist },
    })
  })

  it.each([
    [{ ...approve, checklist: { legal_entity_checked: true } }],
    [
      {
        ...approve,
        checklist: { legal_entity_checked: true, tax_id_checked: false },
      },
    ],
    [{ decision: "reject", submittedAt: SUBMITTED_AT }],
    [{ decision: "needs_changes", submittedAt: SUBMITTED_AT, reason: "  " }],
    [{ decision: "approve", checklist: approve.checklist }],
    [{ decision: "verify", submittedAt: SUBMITTED_AT }],
  ])("refuses the body %j", async (body) => {
    expect((await post(body)).status).toBe(422)
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it("maps each refusal to its status", async () => {
    const cases = [
      ["VERIFICATION_NOT_FOUND", 404],
      ["VERIFICATION_ALREADY_DECIDED", 409],
      ["VERIFICATION_CHANGED", 409],
      ["SELF_REVIEW", 403],
    ] as const
    for (const [code, status] of cases) {
      mocks.decide.mockRejectedValueOnce(
        new mocks.ClinicReviewError(code, status)
      )
      const res = await post({
        decision: "reject",
        submittedAt: SUBMITTED_AT,
        reason: "Not the registered name.",
      })
      expect(res.status).toBe(status)
      await expect(res.json()).resolves.toMatchObject({ code })
    }
  })
})
