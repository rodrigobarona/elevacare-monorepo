import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { auth, db, main } from "@eleva/db"
import { setAuthTransactionalMailer } from "../auth-mailer"
import {
  cancelTeamInvitation,
  inviteTeamMember,
  listTeamMembers,
  removeTeamMember,
  TeamMemberError,
} from "../team-members"

/**
 * A clinic's people on the PR's Neon branch (Phase 11.2): invite, renew,
 * withdraw and remove, each with its audit row, and the removal guards.
 * Runs with ELEVA_DB_INTEGRATION=1 in neon-branch-migrate-and-rls, as the
 * app's own database role (like production).
 */
const enabled =
  process.env.ELEVA_DB_INTEGRATION === "1" &&
  process.env.ELEVA_RLS_INTEGRATION !== "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (err) {
    if (err instanceof TeamMemberError) return err
    throw err
  }
  throw new Error("expected a TeamMemberError")
}

describe.skipIf(!enabled || !databaseUrl)(
  "clinic team members",
  { timeout: 90_000 },
  () => {
    const orgId = randomUUID()
    const owner = randomUUID()
    const admin = randomUUID()
    const clinician = randomUUID()
    const guest = randomUUID()
    const profileId = randomUUID()
    const eventTypeId = randomUUID()
    const bookingId = randomUUID()
    const slug = `team-${orgId.slice(0, 8)}`
    const inviteeEmail = `team-invitee-${orgId}@example.test`
    const sent: { email: string; invitationId: string }[] = []

    async function memberId(userId: string) {
      const [row] = await db()
        .select({ id: auth.member.id })
        .from(auth.member)
        .where(
          and(
            eq(auth.member.organizationId, orgId),
            eq(auth.member.userId, userId)
          )
        )
      return row?.id ?? ""
    }

    async function auditActions() {
      const rows = await db()
        .select({ action: main.auditOutbox.action })
        .from(main.auditOutbox)
        .where(eq(main.auditOutbox.orgId, orgId))
      return rows.map((r) => r.action)
    }

    beforeAll(async () => {
      setAuthTransactionalMailer({
        sendVerifyEmail: async () => {},
        sendResetPassword: async () => {},
        sendMagicLink: async () => {},
        sendTwoFactorOtp: async () => {},
        sendOrgInvitation: async ({ email, invitationId }) => {
          sent.push({ email, invitationId })
        },
      })
      await db()
        .insert(auth.user)
        .values(
          [owner, admin, clinician, guest].map((id) => ({
            id,
            name: `Team ${id.slice(0, 6)}`,
            email: `team-${id}@example.test`,
          }))
        )
      await db()
        .insert(auth.organization)
        .values({ id: orgId, name: "Team test", slug, type: "team" })
      await db()
        .insert(auth.member)
        .values([
          { organizationId: orgId, userId: owner, role: "owner" },
          { organizationId: orgId, userId: admin, role: "admin" },
          { organizationId: orgId, userId: clinician, role: "member" },
        ])
      await db().insert(main.expertProfiles).values({
        id: profileId,
        orgId,
        userId: clinician,
        username: slug,
        displayName: "Team Clinician",
        status: "active",
      })
      await db()
        .insert(main.eventTypes)
        .values({
          id: eventTypeId,
          orgId,
          expertProfileId: profileId,
          slug: "first-visit",
          title: { en: "First visit" },
          published: true,
        })
      await db()
        .insert(main.bookings)
        .values({
          id: bookingId,
          orgId,
          eventTypeId,
          expertProfileId: profileId,
          expertUserId: clinician,
          memberUserId: guest,
          priceCents: 0,
          priceAmount: 0,
          startsAt: new Date(Date.now() + 86_400_000),
          endsAt: new Date(Date.now() + 86_400_000 + 3_600_000),
          timezone: "Europe/Lisbon",
          status: "confirmed",
          sessionMode: "online",
        })
    })

    afterAll(async () => {
      await db()
        .delete(main.auditOutbox)
        .where(eq(main.auditOutbox.orgId, orgId))
      await db().delete(main.bookings).where(eq(main.bookings.orgId, orgId))
      await db()
        .delete(auth.organization)
        .where(eq(auth.organization.id, orgId))
      await db()
        .delete(auth.user)
        .where(inArray(auth.user.id, [owner, admin, clinician, guest]))
    })

    it("lists members with their published services and seats", async () => {
      const roster = await listTeamMembers(orgId)
      expect(roster.members.map((m) => m.role)).toEqual([
        "owner",
        "admin",
        "member",
      ])
      expect(
        roster.members.find((m) => m.userId === clinician)?.publishedServices
      ).toBe(1)
      expect(roster.billableSeats).toBe(1)
      expect(roster.invitations).toEqual([])
    })

    it("invites by email, lower-cased, valid for seven days", async () => {
      const now = new Date()
      const result = await inviteTeamMember({
        orgId,
        actorUserId: admin,
        email: `  ${inviteeEmail.toUpperCase()} `,
        role: "member",
        now,
      })
      expect(result).toMatchObject({
        email: inviteeEmail,
        role: "member",
        resent: false,
        emailSent: true,
      })
      expect(result.expiresAt.getTime() - now.getTime()).toBe(
        7 * 24 * 60 * 60 * 1000
      )
      expect(sent).toEqual([
        { email: inviteeEmail, invitationId: result.invitationId },
      ])
      expect(await auditActions()).toContain("invitation.invited")
    })

    it("renews the pending invitation instead of making a second", async () => {
      const again = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email: inviteeEmail,
        role: "admin",
      })
      const roster = await listTeamMembers(orgId)
      expect(again.resent).toBe(true)
      expect(roster.invitations).toHaveLength(1)
      expect(roster.invitations[0]).toMatchObject({
        id: again.invitationId,
        role: "admin",
        expired: false,
      })
      expect(sent).toHaveLength(2)
    })

    it("refuses to invite someone who is already a member", async () => {
      const err = await refusal(
        inviteTeamMember({
          orgId,
          actorUserId: owner,
          email: `team-${clinician}@example.test`,
          role: "member",
        })
      )
      expect(err.code).toBe("ALREADY_MEMBER")
    })

    it("withdraws a pending invitation once", async () => {
      const [invitation] = (await listTeamMembers(orgId)).invitations
      await cancelTeamInvitation({
        orgId,
        actorUserId: owner,
        invitationId: invitation!.id,
      })
      expect((await listTeamMembers(orgId)).invitations).toEqual([])
      const err = await refusal(
        cancelTeamInvitation({
          orgId,
          actorUserId: owner,
          invitationId: invitation!.id,
        })
      )
      expect(err.code).toBe("INVITATION_NOT_FOUND")
      expect(await auditActions()).toContain("invitation.revoked")
    })

    it("never removes the owner or the caller", async () => {
      expect(
        (
          await refusal(
            removeTeamMember({
              orgId,
              actorUserId: admin,
              memberId: await memberId(owner),
            })
          )
        ).code
      ).toBe("CANNOT_REMOVE_OWNER")
      expect(
        (
          await refusal(
            removeTeamMember({
              orgId,
              actorUserId: admin,
              memberId: await memberId(admin),
            })
          )
        ).code
      ).toBe("CANNOT_REMOVE_SELF")
      expect(
        (
          await refusal(
            removeTeamMember({
              orgId,
              actorUserId: admin,
              memberId: randomUUID(),
            })
          )
        ).code
      ).toBe("MEMBER_NOT_FOUND")
    })

    it("keeps a member who still has a session to run", async () => {
      const err = await refusal(
        removeTeamMember({
          orgId,
          actorUserId: owner,
          memberId: await memberId(clinician),
        })
      )
      expect(err.code).toBe("MEMBER_HAS_UPCOMING_SESSIONS")
      expect(err.upcomingSessions).toBe(1)
      // Refused removals change nothing.
      expect(await memberId(clinician)).not.toBe("")
      const [service] = await db()
        .select({ published: main.eventTypes.published })
        .from(main.eventTypes)
        .where(eq(main.eventTypes.id, eventTypeId))
      expect(service?.published).toBe(true)
    })

    it("removes the member and unpublishes their services", async () => {
      await db()
        .update(main.bookings)
        .set({ status: "completed" })
        .where(eq(main.bookings.id, bookingId))
      let ranInTransaction = false
      const removed = await removeTeamMember({
        orgId,
        actorUserId: owner,
        memberId: await memberId(clinician),
        afterRemove: async () => {
          ranInTransaction = true
        },
      })
      expect(removed).toEqual({ userId: clinician, unpublishedServices: 1 })
      expect(ranInTransaction).toBe(true)
      expect(await memberId(clinician)).toBe("")
      const roster = await listTeamMembers(orgId)
      expect(roster.billableSeats).toBe(0)
      expect(roster.members.map((m) => m.userId)).toEqual([owner, admin])
      expect(await auditActions()).toContain("membership.removed")
    })
  }
)
