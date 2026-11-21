import { randomUUID } from "node:crypto"
import { and, eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { auth, db, main, withOrgContext } from "@eleva/db"
import { lockOpenExpertProfile } from "@eleva/db/queries/practice-closure"
import {
  setAuthTransactionalMailer,
  type AuthTransactionalMailer,
} from "../auth-mailer"
import {
  cancelTeamInvitation,
  inviteTeamMember,
  listTeamMembers,
  removeTeamMember,
  TEAM_INVITATION_DECLINE_COOLDOWN_MS,
  TEAM_INVITATION_RESEND_COOLDOWN_MS,
  TEAM_INVITATION_TTL_MS,
  TEAM_INVITATIONS_PER_DAY,
  TeamMemberError,
} from "../team-members"

/**
 * A clinic's people on the PR's Neon branch (Phase 11.2): invite, renew,
 * withdraw and remove, each with its audit row, and every guard. Runs with
 * ELEVA_DB_INTEGRATION=1 in neon-branch-migrate-and-rls, as the app's own
 * database role (like production).
 */
const enabled =
  process.env.ELEVA_DB_INTEGRATION === "1" &&
  process.env.ELEVA_RLS_INTEGRATION !== "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

type SentInvitation = Parameters<
  AuthTransactionalMailer["sendOrgInvitation"]
>[0]

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
  { timeout: 120_000 },
  () => {
    const orgId = randomUUID()
    const otherOrgId = randomUUID()
    const owner = randomUUID()
    const admin = randomUUID()
    const secondAdmin = randomUUID()
    const clinician = randomUUID()
    const guest = randomUUID()
    const users = [owner, admin, secondAdmin, clinician, guest]
    const profileId = randomUUID()
    const suffix = orgId.slice(0, 8)
    const eventTypeId = randomUUID()
    const bookingId = randomUUID()
    const holdId = randomUUID()
    const slug = `team-${orgId.slice(0, 8)}`
    const inviteeEmail = `team-invitee-${orgId}@example.test`
    const sent: SentInvitation[] = []
    /** One fixed clock for the invitation steps, however slow the run. */
    const clock = new Date()
    const later = (ms: number) => new Date(clock.getTime() + ms)
    /** What the mail provider does with the next invitation. */
    let mail: "sent" | "held" | "throws" = "sent"

    async function memberId(userId: string, organizationId = orgId) {
      const [row] = await db()
        .select({ id: auth.member.id })
        .from(auth.member)
        .where(
          and(
            eq(auth.member.organizationId, organizationId),
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

    async function takesBookings() {
      return withOrgContext(orgId, (tx) => lockOpenExpertProfile(tx, profileId))
    }

    async function servicePublished() {
      const [service] = await db()
        .select({ published: main.eventTypes.published })
        .from(main.eventTypes)
        .where(eq(main.eventTypes.id, eventTypeId))
      return service?.published
    }

    beforeAll(async () => {
      setAuthTransactionalMailer({
        sendVerifyEmail: async () => {},
        sendResetPassword: async () => {},
        sendMagicLink: async () => {},
        sendTwoFactorOtp: async () => {},
        sendOrgInvitation: async (input) => {
          if (mail === "throws") throw new Error("AUTH_MAIL_SEND_FAILED")
          sent.push(input)
          return mail === "sent"
        },
      })
      await db()
        .insert(auth.user)
        .values(
          users.map((id) => ({
            id,
            name: `Team ${id.slice(0, 6)}`,
            email: `team-${id}@example.test`,
            locale: id === admin ? "pt" : null,
          }))
        )
      await db()
        .insert(auth.organization)
        .values([
          { id: orgId, name: "Team test", slug, type: "team" },
          {
            id: otherOrgId,
            name: "Other clinic",
            slug: `other-${otherOrgId.slice(0, 8)}`,
            type: "team",
          },
        ])
      await db()
        .insert(auth.member)
        .values([
          { organizationId: orgId, userId: owner, role: "owner" },
          { organizationId: orgId, userId: admin, role: "admin" },
          { organizationId: orgId, userId: secondAdmin, role: "admin" },
          { organizationId: orgId, userId: clinician, role: "member" },
          // She runs another clinic: no rights in this one.
          { organizationId: otherOrgId, userId: guest, role: "owner" },
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
      const startsAt = new Date(Date.now() + 86_400_000)
      const endsAt = new Date(startsAt.getTime() + 3_600_000)
      await db().insert(main.bookings).values({
        id: bookingId,
        orgId,
        eventTypeId,
        expertProfileId: profileId,
        expertUserId: clinician,
        memberUserId: guest,
        priceCents: 0,
        priceAmount: 0,
        startsAt,
        endsAt,
        timezone: "Europe/Lisbon",
        status: "confirmed",
        sessionMode: "online",
      })
      // A slot someone is paying for, two days out.
      await db()
        .insert(main.slotReservations)
        .values({
          id: holdId,
          orgId,
          eventTypeId,
          expertProfileId: profileId,
          expertUserId: clinician,
          startsAt: new Date(startsAt.getTime() + 86_400_000),
          endsAt: new Date(endsAt.getTime() + 86_400_000),
          expiresAt: new Date(Date.now() + 600_000),
          status: "active",
          holdToken: randomUUID(),
          capabilityHash: "0".repeat(64),
        })
    })

    afterAll(async () => {
      await db()
        .delete(main.auditOutbox)
        .where(inArray(main.auditOutbox.orgId, [orgId, otherOrgId]))
      await db()
        .delete(main.slotReservations)
        .where(eq(main.slotReservations.orgId, orgId))
      await db().delete(main.bookings).where(eq(main.bookings.orgId, orgId))
      await db()
        .delete(auth.organization)
        .where(inArray(auth.organization.id, [orgId, otherOrgId]))
      await db().delete(auth.user).where(inArray(auth.user.id, users))
    })

    it("lists members with their published services and seats", async () => {
      const roster = await listTeamMembers(orgId)
      // The owner leads; everyone else joined at the same moment here.
      expect(roster.members[0]?.userId).toBe(owner)
      expect(roster.members.map((m) => m.role).sort()).toEqual([
        "admin",
        "admin",
        "member",
        "owner",
      ])
      expect(
        roster.members.find((m) => m.userId === clinician)?.publishedServices
      ).toBe(1)
      expect(roster.billableSeats).toBe(1)
      expect(roster.invitations).toEqual([])
    })

    it("invites by email for seven days and names who invites", async () => {
      const now = clock
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
        TEAM_INVITATION_TTL_MS
      )
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        email: inviteeEmail,
        invitationId: result.invitationId,
        organizationName: "Team test",
        inviterName: `Team ${admin.slice(0, 6)}`,
        // No account yet: the email is written in the inviter's language.
        fallbackLocale: "pt",
        sendKey: String(result.expiresAt.getTime()),
      })
      expect(await auditActions()).toContain("invitation.invited")
    })

    it("does not email the same address twice within a minute", async () => {
      const err = await refusal(
        inviteTeamMember({
          orgId,
          actorUserId: admin,
          email: inviteeEmail,
          role: "member",
          now: later(10_000),
        })
      )
      expect(err.code).toBe("INVITATION_RECENTLY_SENT")
      expect(err.detail.retryAfterSeconds).toBeGreaterThan(0)
      expect(err.detail.retryAfterSeconds).toBeLessThanOrEqual(
        TEAM_INVITATION_RESEND_COOLDOWN_MS / 1000
      )
      expect(sent).toHaveLength(1)
    })

    it("renews the pending invitation as a new email, not a second row", async () => {
      const again = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email: inviteeEmail,
        role: "member",
        now: later(TEAM_INVITATION_RESEND_COOLDOWN_MS),
      })
      const roster = await listTeamMembers(orgId)
      expect(again.resent).toBe(true)
      expect(roster.invitations).toHaveLength(1)
      expect(roster.invitations[0]).toMatchObject({
        id: again.invitationId,
        role: "member",
        expired: false,
      })
      expect(sent).toHaveLength(2)
      // A different key each time, so the renewal is really delivered.
      expect(sent[1]!.sendKey).not.toBe(sent[0]!.sendKey)
      expect(sent[1]!.invitationId).toBe(sent[0]!.invitationId)
    })

    it("says so when the email did not leave", async () => {
      const email = `team-held-${orgId}@example.test`
      mail = "held"
      const held = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "member",
        now: clock,
      })
      expect(held.emailSent).toBe(false)
      mail = "throws"
      const failed = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "member",
        now: later(TEAM_INVITATION_RESEND_COOLDOWN_MS),
      })
      mail = "sent"
      // The invitation is kept either way, so it can be sent again.
      expect(failed).toMatchObject({ resent: true, emailSent: false })
      await cancelTeamInvitation({
        orgId,
        actorUserId: owner,
        invitationId: held.invitationId,
      })
    })

    it("sends an expired invitation again", async () => {
      const [invitation] = (await listTeamMembers(orgId)).invitations
      await db()
        .update(auth.invitation)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(auth.invitation.id, invitation!.id))
      expect((await listTeamMembers(orgId)).invitations[0]!.expired).toBe(true)
      const renewed = await inviteTeamMember({
        orgId,
        actorUserId: admin,
        email: inviteeEmail,
        role: "member",
      })
      expect(renewed).toMatchObject({ resent: true, emailSent: true })
      expect((await listTeamMembers(orgId)).invitations[0]!.expired).toBe(false)
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

    it("lets only the owner invite or un-invite an admin", async () => {
      const email = `team-admin-${orgId}@example.test`
      expect(
        (
          await refusal(
            inviteTeamMember({
              orgId,
              actorUserId: admin,
              email,
              role: "admin",
            })
          )
        ).code
      ).toBe("OWNER_REQUIRED")
      const invited = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "admin",
      })
      expect(
        (
          await refusal(
            cancelTeamInvitation({
              orgId,
              actorUserId: admin,
              invitationId: invited.invitationId,
            })
          )
        ).code
      ).toBe("OWNER_REQUIRED")
      await cancelTeamInvitation({
        orgId,
        actorUserId: owner,
        invitationId: invited.invitationId,
      })
    })

    it("withdraws a pending invitation once, and only its own clinic's", async () => {
      const [invitation] = (await listTeamMembers(orgId)).invitations
      // Another clinic cannot withdraw it by id.
      expect(
        (
          await refusal(
            cancelTeamInvitation({
              orgId: otherOrgId,
              actorUserId: guest,
              invitationId: invitation!.id,
            })
          )
        ).code
      ).toBe("INVITATION_NOT_FOUND")
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

    it("keeps the minute between emails after a withdrawal", async () => {
      const email = `team-again-${orgId}@example.test`
      const first = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "member",
        now: clock,
      })
      await cancelTeamInvitation({
        orgId,
        actorUserId: owner,
        invitationId: first.invitationId,
      })
      const before = sent.length
      const err = await refusal(
        inviteTeamMember({
          orgId,
          actorUserId: owner,
          email,
          role: "member",
          now: later(10_000),
        })
      )
      expect(err.code).toBe("INVITATION_RECENTLY_SENT")
      expect(sent).toHaveLength(before)
      // A minute later it is a new invitation with a new link.
      const second = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "member",
        now: later(TEAM_INVITATION_RESEND_COOLDOWN_MS),
      })
      expect(second.resent).toBe(false)
      expect(second.invitationId).not.toBe(first.invitationId)
      await cancelTeamInvitation({
        orgId,
        actorUserId: owner,
        invitationId: second.invitationId,
      })
    })

    it("leaves someone who declined alone for 30 days", async () => {
      const email = `declined-${suffix}@example.test`
      const hour = 60 * 60 * 1000
      const first = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "member",
        now: later(hour),
      })
      // The person says no (Better Auth's decline sets this status).
      await db()
        .update(auth.invitation)
        .set({ status: "rejected" })
        .where(eq(auth.invitation.id, first.invitationId))
      const before = sent.length
      const err = await refusal(
        inviteTeamMember({
          orgId,
          actorUserId: owner,
          email: email.toUpperCase(),
          role: "member",
          now: later(2 * hour),
        })
      )
      expect(err.code).toBe("INVITATION_DECLINED")
      expect(err.detail.retryAfterSeconds).toBeGreaterThan(29 * 24 * 3600)
      expect(sent).toHaveLength(before)
      // After the 30 days the clinic may ask again.
      const again = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "member",
        now: later(hour + TEAM_INVITATION_DECLINE_COOLDOWN_MS),
      })
      expect(again.invitationId).not.toBe(first.invitationId)
      await db()
        .delete(auth.invitation)
        .where(
          and(
            eq(auth.invitation.organizationId, orgId),
            eq(auth.invitation.email, email)
          )
        )
    })

    it("invites at most 50 addresses a day, withdrawn ones included", async () => {
      const day = 24 * 60 * 60 * 1000
      const at = later(40 * day)
      // Fifty invitations sent that day and withdrawn: the way to email
      // many strangers without ever holding many pending places.
      await db()
        .insert(auth.invitation)
        .values(
          Array.from({ length: TEAM_INVITATIONS_PER_DAY }, (_, index) => ({
            organizationId: orgId,
            email: `flood-${index}-${suffix}@example.test`,
            role: "member",
            status: "canceled",
            expiresAt: new Date(at.getTime() + TEAM_INVITATION_TTL_MS),
            inviterId: owner,
          }))
        )
      const email = `one-more-${suffix}@example.test`
      const before = sent.length
      const err = await refusal(
        inviteTeamMember({
          orgId,
          actorUserId: owner,
          email,
          role: "member",
          now: new Date(at.getTime() + 60_000),
        })
      )
      expect(err.code).toBe("INVITATION_DAILY_LIMIT")
      expect(sent).toHaveLength(before)
      // The next day there is room again.
      const next = await inviteTeamMember({
        orgId,
        actorUserId: owner,
        email,
        role: "member",
        now: new Date(at.getTime() + day + 60_000),
      })
      expect(next.resent).toBe(false)
      await db()
        .delete(auth.invitation)
        .where(
          and(
            eq(auth.invitation.organizationId, orgId),
            sql`${auth.invitation.email} like ${`%-${suffix}@example.test`} and (${auth.invitation.email} like 'flood-%' or ${auth.invitation.email} like 'one-more-%')`
          )
        )
    })

    it("never removes the owner, the caller or another clinic's member", async () => {
      const cases = [
        { memberId: await memberId(owner), code: "CANNOT_REMOVE_OWNER" },
        { memberId: await memberId(admin), code: "CANNOT_REMOVE_SELF" },
        { memberId: randomUUID(), code: "MEMBER_NOT_FOUND" },
        {
          memberId: await memberId(guest, otherOrgId),
          code: "MEMBER_NOT_FOUND",
        },
      ]
      for (const { memberId: target, code } of cases) {
        const err = await refusal(
          removeTeamMember({ orgId, actorUserId: admin, memberId: target })
        )
        expect(err.code).toBe(code)
      }
    })

    it("lets only the owner remove an admin", async () => {
      const target = await memberId(secondAdmin)
      const err = await refusal(
        removeTeamMember({ orgId, actorUserId: admin, memberId: target })
      )
      expect(err.code).toBe("OWNER_REQUIRED")
      await removeTeamMember({ orgId, actorUserId: owner, memberId: target })
      expect(await memberId(secondAdmin)).toBe("")
    })

    it("keeps a member with a session booked or a slot being paid for", async () => {
      const target = await memberId(clinician)
      const both = await refusal(
        removeTeamMember({ orgId, actorUserId: owner, memberId: target })
      )
      expect(both.code).toBe("MEMBER_HAS_UPCOMING_SESSIONS")
      expect(both.detail).toEqual({ upcomingSessions: 1, pendingBookings: 1 })

      // A session that started and may still be running blocks too: the
      // call can go on for 30 minutes past its booked end.
      await db()
        .update(main.bookings)
        .set({
          startsAt: new Date(Date.now() - 80 * 60_000),
          endsAt: new Date(Date.now() - 20 * 60_000),
        })
        .where(eq(main.bookings.id, bookingId))
      const running = await refusal(
        removeTeamMember({ orgId, actorUserId: owner, memberId: target })
      )
      expect(running.detail.upcomingSessions).toBe(1)

      await db()
        .update(main.bookings)
        .set({ status: "completed" })
        .where(eq(main.bookings.id, bookingId))
      const holdOnly = await refusal(
        removeTeamMember({ orgId, actorUserId: owner, memberId: target })
      )
      expect(holdOnly.detail).toEqual({
        upcomingSessions: 0,
        pendingBookings: 1,
      })

      // Refused removals change nothing.
      expect(await memberId(clinician)).toBe(target)
      expect(await servicePublished()).toBe(true)
      expect(await takesBookings()).toBe(true)
    })

    it("removes the member, unpublishes their services and stops new bookings", async () => {
      await db()
        .update(main.slotReservations)
        .set({ status: "expired" })
        .where(eq(main.slotReservations.id, holdId))
      let ranInTransaction = false
      const clinicianMemberId = await memberId(clinician)
      const removed = await removeTeamMember({
        orgId,
        actorUserId: owner,
        memberId: clinicianMemberId,
        afterRemove: async () => {
          ranInTransaction = true
        },
      })
      expect(removed).toEqual({ userId: clinician, unpublishedServices: 1 })
      expect(ranInTransaction).toBe(true)
      expect(await memberId(clinician)).toBe("")
      expect(await servicePublished()).toBe(false)
      // A reservation for the removed clinician is refused at the lock.
      expect(await takesBookings()).toBe(false)
      const roster = await listTeamMembers(orgId)
      expect(roster.billableSeats).toBe(0)
      expect(roster.members.map((m) => m.userId)).toEqual([owner, admin])
      // The audit row is this clinician's, not the admin removed earlier.
      const audit = await db()
        .select({ id: main.auditOutbox.id })
        .from(main.auditOutbox)
        .where(
          and(
            eq(main.auditOutbox.orgId, orgId),
            eq(main.auditOutbox.action, "membership.removed"),
            eq(main.auditOutbox.entityId, clinicianMemberId)
          )
        )
      expect(audit).toHaveLength(1)
    })

    it("stops a caller who no longer manages the clinic", async () => {
      // The clinician was removed; an ordinary member never could.
      for (const actorUserId of [clinician, guest]) {
        const err = await refusal(
          inviteTeamMember({
            orgId,
            actorUserId,
            email: `team-late-${orgId}@example.test`,
            role: "member",
          })
        )
        expect(err.code).toBe("MANAGER_REQUIRED")
      }
      expect(
        (
          await refusal(
            removeTeamMember({
              orgId,
              actorUserId: clinician,
              memberId: await memberId(admin),
            })
          )
        ).code
      ).toBe("MANAGER_REQUIRED")
    })
  }
)
