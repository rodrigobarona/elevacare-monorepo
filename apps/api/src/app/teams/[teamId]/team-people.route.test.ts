import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class TeamMemberError extends Error {
    constructor(
      readonly code: string,
      readonly detail: Record<string, number> = {}
    ) {
      super(code)
    }
  }
  class ClinicError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }
  return {
    TeamMemberError,
    ClinicError,
    readAuth: vi.fn(),
    writeAuth: vi.fn(),
    listTeamMembers: vi.fn(),
    inviteTeamMember: vi.fn(),
    cancelTeamInvitation: vi.fn(),
    removeTeamMember: vi.fn(),
    markSeatSyncPending: vi.fn(),
    enqueueSeatSync: vi.fn(),
  }
})

vi.mock("@eleva/auth", () => ({
  TeamMemberError: mocks.TeamMemberError,
  ClinicError: mocks.ClinicError,
  listTeamMembers: (...args: unknown[]) => mocks.listTeamMembers(...args),
  inviteTeamMember: (...args: unknown[]) => mocks.inviteTeamMember(...args),
  cancelTeamInvitation: (...args: unknown[]) =>
    mocks.cancelTeamInvitation(...args),
  removeTeamMember: (...args: unknown[]) => mocks.removeTeamMember(...args),
}))

vi.mock("@eleva/billing/server", () => ({
  getClinicSeatAllowance: async () => ({ plan: "clinic_starter", cap: 5 }),
  markSeatSyncPending: (...args: unknown[]) =>
    mocks.markSeatSyncPending(...args),
  enqueueSeatSync: (...args: unknown[]) => mocks.enqueueSeatSync(...args),
}))

vi.mock("@eleva/observability", () => ({
  logError: vi.fn(),
  describeError: (err: unknown) => String(err),
}))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: (...args: unknown[]) => mocks.readAuth(...args),
  requireRevocableApiCapability: (...args: unknown[]) =>
    mocks.writeAuth(...args),
  apiAuthFailure: (err: Error) =>
    err.message === "forbidden" || err.message === "jwt-not-revocable"
      ? Response.json(
          { error: "forbidden", code: err.message },
          { status: 403 }
        )
      : null,
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "teams",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { DELETE as cancelInvitation } from "./invitations/[invitationId]/route"
import { POST as invite } from "./invitations/route"
import { DELETE as removeMember } from "./members/[memberId]/route"
import { GET as listMembers } from "./members/route"

const TEAM_ID = "00000000-0000-4000-8000-0000000000aa"
const OTHER_TEAM_ID = "00000000-0000-4000-8000-0000000000bb"
const MEMBER_ID = "00000000-0000-4000-8000-0000000000c1"
const INVITATION_ID = "00000000-0000-4000-8000-0000000000d1"
const USER_ID = "00000000-0000-4000-8000-0000000000e1"
const BASE = `http://127.0.0.1:3002/teams/${TEAM_ID}`

const admin = { user: { id: USER_ID }, orgId: TEAM_ID, orgType: "team" }

function post(body: unknown, teamId = TEAM_ID) {
  return invite(
    new Request(`${BASE}/invitations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ teamId }) }
  )
}

function remove(memberId = MEMBER_ID, body?: string) {
  return removeMember(
    new Request(`${BASE}/members/${memberId}`, { method: "DELETE", body }),
    { params: Promise.resolve({ teamId: TEAM_ID, memberId }) }
  )
}

function cancel(invitationId = INVITATION_ID) {
  return cancelInvitation(
    new Request(`${BASE}/invitations/${invitationId}`, { method: "DELETE" }),
    { params: Promise.resolve({ teamId: TEAM_ID, invitationId }) }
  )
}

function list(teamId = TEAM_ID) {
  return listMembers(new Request(`${BASE}/members`), {
    params: Promise.resolve({ teamId }),
  })
}

describe("/teams/{teamId} members and invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readAuth.mockResolvedValue(admin)
    mocks.writeAuth.mockResolvedValue(admin)
  })

  describe("who may call", () => {
    it("asks for members:manage on every route", async () => {
      mocks.listTeamMembers.mockResolvedValue({
        members: [],
        invitations: [],
        billableSeats: 0,
      })
      mocks.inviteTeamMember.mockResolvedValue({
        invitationId: INVITATION_ID,
        email: "ana@example.test",
        role: "member",
        expiresAt: new Date("2026-11-27T10:00:00.000Z"),
        resent: false,
        emailSent: true,
      })
      mocks.removeTeamMember.mockResolvedValue({
        userId: USER_ID,
        unpublishedServices: 0,
      })
      await list()
      await post({ email: "ana@example.test", role: "member" })
      await remove()
      await cancel()
      expect(mocks.readAuth).toHaveBeenCalledTimes(1)
      expect(mocks.readAuth).toHaveBeenCalledWith(
        expect.anything(),
        "members:manage"
      )
      // Every write needs a credential that can be revoked.
      expect(mocks.writeAuth).toHaveBeenCalledTimes(3)
      for (const call of mocks.writeAuth.mock.calls) {
        expect(call[1]).toBe("members:manage")
      }
    })

    it("refuses a clinician, who has no members:manage", async () => {
      mocks.readAuth.mockRejectedValue(new Error("forbidden"))
      mocks.writeAuth.mockRejectedValue(new Error("forbidden"))
      for (const res of [
        await list(),
        await post({ email: "ana@example.test", role: "member" }),
        await remove(),
        await cancel(),
      ]) {
        expect(res.status).toBe(403)
      }
      expect(mocks.listTeamMembers).not.toHaveBeenCalled()
      expect(mocks.inviteTeamMember).not.toHaveBeenCalled()
      expect(mocks.removeTeamMember).not.toHaveBeenCalled()
      expect(mocks.cancelTeamInvitation).not.toHaveBeenCalled()
    })

    it("refuses a write signed with a JWT that cannot be revoked", async () => {
      mocks.writeAuth.mockRejectedValue(new Error("jwt-not-revocable"))
      const res = await post({ email: "ana@example.test", role: "member" })
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toMatchObject({
        code: "jwt-not-revocable",
      })
      expect(mocks.inviteTeamMember).not.toHaveBeenCalled()
    })

    it("refuses a team that is not the caller's active one", async () => {
      const res = await list(OTHER_TEAM_ID)
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toMatchObject({
        code: "TEAM_NOT_ACTIVE",
      })
      const write = await post(
        { email: "ana@example.test", role: "member" },
        OTHER_TEAM_ID
      )
      expect(write.status).toBe(403)
      expect(mocks.listTeamMembers).not.toHaveBeenCalled()
      expect(mocks.inviteTeamMember).not.toHaveBeenCalled()
    })

    it("refuses an expert practice with the same id shape", async () => {
      mocks.readAuth.mockResolvedValue({ ...admin, orgType: "expert" })
      expect((await list()).status).toBe(403)
    })
  })

  describe("GET members", () => {
    it("returns people, invitations and the seat count", async () => {
      mocks.listTeamMembers.mockResolvedValue({
        members: [
          {
            memberId: MEMBER_ID,
            userId: USER_ID,
            name: "Ana Mota",
            email: "ana@example.test",
            image: null,
            role: "owner",
            joinedAt: new Date("2026-11-01T09:00:00.000Z"),
            publishedServices: 2,
          },
        ],
        invitations: [
          {
            id: INVITATION_ID,
            email: "rui@example.test",
            role: "member",
            invitedAt: new Date("2026-11-20T09:00:00.000Z"),
            expiresAt: new Date("2026-11-27T09:00:00.000Z"),
            expired: false,
            invitedByName: "Ana Mota",
          },
        ],
        billableSeats: 1,
      })
      const res = await list()
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({
        members: [{ role: "owner", joinedAt: "2026-11-01T09:00:00.000Z" }],
        invitations: [{ expiresAt: "2026-11-27T09:00:00.000Z" }],
        seats: { billable: 1, cap: 5, plan: "clinic_starter" },
      })
      expect(mocks.listTeamMembers).toHaveBeenCalledWith(TEAM_ID)
    })
  })

  describe("POST invitations", () => {
    const sent = {
      invitationId: INVITATION_ID,
      email: "ana@example.test",
      role: "member",
      expiresAt: new Date("2026-11-27T10:00:00.000Z"),
      resent: false,
      emailSent: true,
    }

    it("creates (201) or renews (200), acting as the caller", async () => {
      mocks.inviteTeamMember.mockResolvedValueOnce(sent)
      const created = await post({
        email: " Ana@Example.test ",
        role: "member",
      })
      expect(created.status).toBe(201)
      expect(mocks.inviteTeamMember).toHaveBeenCalledWith({
        orgId: TEAM_ID,
        actorUserId: USER_ID,
        email: "ana@example.test",
        role: "member",
      })
      mocks.inviteTeamMember.mockResolvedValueOnce({ ...sent, resent: true })
      const renewed = await post({ email: "ana@example.test", role: "member" })
      expect(renewed.status).toBe(200)
      await expect(renewed.json()).resolves.toMatchObject({
        invitation: {
          id: INVITATION_ID,
          expiresAt: "2026-11-27T10:00:00.000Z",
        },
        resent: true,
        emailSent: true,
      })
    })

    it.each([
      [{ email: "not-an-email", role: "member" }],
      [{ email: "ana@example.test", role: "owner" }],
      [{ email: "ana@example.test" }],
      [{ email: "ana@example.test", role: "member", teamId: OTHER_TEAM_ID }],
      [null],
    ])("refuses the body %j", async (body) => {
      const res = await post(body)
      expect(res.status).toBe(422)
      expect(mocks.inviteTeamMember).not.toHaveBeenCalled()
    })

    it("maps each refusal to its status", async () => {
      const cases = [
        ["ALREADY_MEMBER", 409],
        ["MEMBER_LIMIT_REACHED", 409],
        ["OWNER_REQUIRED", 403],
      ] as const
      for (const [code, status] of cases) {
        mocks.inviteTeamMember.mockRejectedValueOnce(
          new mocks.TeamMemberError(code)
        )
        const res = await post({ email: "ana@example.test", role: "admin" })
        expect(res.status).toBe(status)
        await expect(res.json()).resolves.toMatchObject({ code })
      }
    })

    it("says when the address can be emailed again", async () => {
      mocks.inviteTeamMember.mockRejectedValue(
        new mocks.TeamMemberError("INVITATION_RECENTLY_SENT", {
          retryAfterSeconds: 42,
        })
      )
      const res = await post({ email: "ana@example.test", role: "member" })
      expect(res.status).toBe(429)
      expect(res.headers.get("Retry-After")).toBe("42")
      await expect(res.json()).resolves.toMatchObject({
        code: "INVITATION_RECENTLY_SENT",
        retryAfterSeconds: 42,
      })
    })
  })

  describe("DELETE invitation", () => {
    it("withdraws (204) and reports one that is not pending (404)", async () => {
      mocks.cancelTeamInvitation.mockResolvedValueOnce(undefined)
      expect((await cancel()).status).toBe(204)
      expect(mocks.cancelTeamInvitation).toHaveBeenCalledWith({
        orgId: TEAM_ID,
        actorUserId: USER_ID,
        invitationId: INVITATION_ID,
      })
      mocks.cancelTeamInvitation.mockRejectedValueOnce(
        new mocks.TeamMemberError("INVITATION_NOT_FOUND")
      )
      expect((await cancel()).status).toBe(404)
      expect((await cancel("not-a-uuid")).status).toBe(422)
    })
  })

  describe("DELETE member", () => {
    it("removes, marks the seat count in the same transaction, then syncs", async () => {
      const tx = { marker: "tx" }
      mocks.removeTeamMember.mockImplementation(
        async (input: { afterRemove: (tx: unknown) => Promise<void> }) => {
          await input.afterRemove(tx)
          return { userId: USER_ID, unpublishedServices: 2 }
        }
      )
      const res = await remove()
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        userId: USER_ID,
        unpublishedServices: 2,
      })
      expect(mocks.markSeatSyncPending).toHaveBeenCalledWith(TEAM_ID, tx)
      expect(mocks.enqueueSeatSync).toHaveBeenCalledWith(TEAM_ID, USER_ID)
    })

    it("still answers 200 when the Stripe sync has to wait", async () => {
      mocks.removeTeamMember.mockResolvedValue({
        userId: USER_ID,
        unpublishedServices: 0,
      })
      mocks.enqueueSeatSync.mockRejectedValue(new Error("stripe down"))
      expect((await remove()).status).toBe(200)
    })

    it("keeps a member with sessions booked, saying how many", async () => {
      mocks.removeTeamMember.mockRejectedValue(
        new mocks.TeamMemberError("MEMBER_HAS_UPCOMING_SESSIONS", {
          upcomingSessions: 3,
          pendingBookings: 1,
        })
      )
      const res = await remove()
      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toMatchObject({
        code: "MEMBER_HAS_UPCOMING_SESSIONS",
        upcomingSessions: 3,
        pendingBookings: 1,
      })
      expect(mocks.enqueueSeatSync).not.toHaveBeenCalled()
    })

    it("maps the other refusals and bad input", async () => {
      const cases = [
        ["CANNOT_REMOVE_OWNER", 409],
        ["CANNOT_REMOVE_SELF", 409],
        ["OWNER_REQUIRED", 403],
        ["MEMBER_NOT_FOUND", 404],
      ] as const
      for (const [code, status] of cases) {
        mocks.removeTeamMember.mockRejectedValueOnce(
          new mocks.TeamMemberError(code)
        )
        expect((await remove()).status).toBe(status)
      }
      expect((await remove("not-a-uuid")).status).toBe(422)
      expect((await remove(MEMBER_ID, '{"force":true}')).status).toBe(422)
    })
  })
})
