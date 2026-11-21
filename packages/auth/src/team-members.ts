import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { auth, main, withOrgContext, type Tx } from "@eleva/db"
import {
  FINISHED_BOOKING_STATUSES,
  LIVE_HOLD_STATUSES,
  lockExpertProfilesForRemoval,
} from "@eleva/db/queries/practice-closure"
import { toMembershipSeniority } from "./capabilities"
import { invitationAcceptUrl } from "./invitation-accept-url"
import { sendOrgInvitationEmail } from "./send-auth-email"
import {
  TEAM_INVITATION_DECLINE_COOLDOWN_MS,
  TEAM_INVITATION_RESEND_COOLDOWN_MS,
  TEAM_INVITATION_TTL_MS,
  TEAM_INVITATIONS_PER_DAY,
  TEAM_MEMBER_LIMIT,
  TEAM_SESSION_TRAIL_MS,
} from "./team-limits"

/**
 * The people of a clinic (team org) — Phase 11.2.
 *
 * Invitations and removals are written here, in one transaction with their
 * audit row, instead of through Better Auth's session-only endpoints: every
 * credential the API accepts (cookie, bearer, API key) can manage the team,
 * and an invitation never exists without its audit entry. Better Auth's own
 * invite, cancel, remove, role and leave endpoints are refused for team
 * orgs (`server/auth.ts`), so these rules cannot be walked around.
 * Accepting and declining stay with Better Auth.
 */

export type TeamMemberErrorCode =
  | "ALREADY_MEMBER"
  | "MEMBER_LIMIT_REACHED"
  | "MEMBER_NOT_FOUND"
  | "INVITATION_NOT_FOUND"
  | "INVITATION_RECENTLY_SENT"
  | "INVITATION_DECLINED"
  | "INVITATION_DAILY_LIMIT"
  | "OWNER_REQUIRED"
  | "MANAGER_REQUIRED"
  | "CANNOT_REMOVE_OWNER"
  | "CANNOT_REMOVE_SELF"
  | "MEMBER_HAS_UPCOMING_SESSIONS"

export class TeamMemberError extends Error {
  constructor(
    readonly code: TeamMemberErrorCode,
    readonly detail: {
      /** Sessions booked or running that block a removal. */
      upcomingSessions?: number
      /** Slots someone is paying for right now, which block it briefly. */
      pendingBookings?: number
      /** Seconds until an invitation can be sent again. */
      retryAfterSeconds?: number
    } = {}
  ) {
    super(code)
    this.name = "TeamMemberError"
  }
}

export {
  TEAM_INVITATION_DECLINE_COOLDOWN_MS,
  TEAM_INVITATION_RESEND_COOLDOWN_MS,
  TEAM_INVITATION_TTL_MS,
  TEAM_INVITATIONS_PER_DAY,
  TEAM_MEMBER_LIMIT,
}

/** Roles an invitation may grant. Ownership is never invited. */
export type TeamInviteRole = "admin" | "member"

export interface TeamMember {
  memberId: string
  userId: string
  name: string
  email: string
  image: string | null
  role: "owner" | "admin" | "member"
  joinedAt: Date
  /** Published services in this clinic: one or more makes a billable seat. */
  publishedServices: number
}

export interface TeamInvitation {
  id: string
  email: string
  role: TeamInviteRole
  invitedAt: Date
  expiresAt: Date
  expired: boolean
  invitedByName: string | null
}

export interface TeamRoster {
  members: TeamMember[]
  invitations: TeamInvitation[]
  /** Members with at least one published service (the single seat rule). */
  billableSeats: number
}

function inviteRole(role: string | null): TeamInviteRole {
  return toMembershipSeniority(role ?? "member") === "admin"
    ? "admin"
    : "member"
}

/** Members, pending invitations and the seat count of a clinic. */
export async function listTeamMembers(
  orgId: string,
  now: Date = new Date()
): Promise<TeamRoster> {
  return withOrgContext(orgId, async (tx) => {
    const memberRows = await tx
      .select({
        memberId: auth.member.id,
        userId: auth.member.userId,
        role: auth.member.role,
        joinedAt: auth.member.createdAt,
        name: auth.user.name,
        email: auth.user.email,
        image: auth.user.image,
      })
      .from(auth.member)
      .innerJoin(auth.user, eq(auth.user.id, auth.member.userId))
      .where(eq(auth.member.organizationId, orgId))
      .orderBy(asc(auth.member.createdAt))

    const published = await tx
      .select({
        userId: main.expertProfiles.userId,
        services: sql<number>`count(${main.eventTypes.id})::int`,
      })
      .from(main.expertProfiles)
      .innerJoin(
        main.eventTypes,
        eq(main.eventTypes.expertProfileId, main.expertProfiles.id)
      )
      .where(
        and(
          eq(main.expertProfiles.orgId, orgId),
          eq(main.eventTypes.orgId, orgId),
          eq(main.eventTypes.published, true),
          eq(main.eventTypes.active, true),
          isNull(main.eventTypes.deletedAt)
        )
      )
      .groupBy(main.expertProfiles.userId)
    const servicesByUser = new Map(published.map((r) => [r.userId, r.services]))

    const invitationRows = await tx
      .select({
        id: auth.invitation.id,
        email: auth.invitation.email,
        role: auth.invitation.role,
        invitedAt: auth.invitation.createdAt,
        expiresAt: auth.invitation.expiresAt,
        invitedByName: auth.user.name,
      })
      .from(auth.invitation)
      .leftJoin(auth.user, eq(auth.user.id, auth.invitation.inviterId))
      .where(
        and(
          eq(auth.invitation.organizationId, orgId),
          eq(auth.invitation.status, "pending")
        )
      )
      .orderBy(asc(auth.invitation.createdAt))

    const members = memberRows.map((row) => ({
      memberId: row.memberId,
      userId: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
      role: toMembershipSeniority(row.role),
      joinedAt: row.joinedAt,
      publishedServices: servicesByUser.get(row.userId) ?? 0,
    }))
    // The owner first, then by joining date; names settle ties.
    const ownerFirst = (role: string) => (role === "owner" ? 0 : 1)
    members.sort(
      (a, b) =>
        ownerFirst(a.role) - ownerFirst(b.role) ||
        a.joinedAt.getTime() - b.joinedAt.getTime() ||
        a.name.localeCompare(b.name) ||
        a.userId.localeCompare(b.userId)
    )
    return {
      members,
      invitations: invitationRows.map((row) => ({
        id: row.id,
        email: row.email,
        role: inviteRole(row.role),
        invitedAt: row.invitedAt,
        expiresAt: row.expiresAt,
        expired: row.expiresAt.getTime() <= now.getTime(),
        invitedByName: row.invitedByName,
      })),
      billableSeats: members.filter((m) => m.publishedServices > 0).length,
    }
  })
}

/**
 * The caller's role in the clinic, read inside the write's own transaction
 * and held (shared lock) until it ends: someone removed or demoted after
 * the route checked them cannot finish the change. Throws when the caller
 * no longer manages the clinic. Changing who administers a clinic
 * (inviting, removing or un-inviting an admin) is the owner's call.
 */
async function requireManager(
  tx: Tx,
  orgId: string,
  userId: string
): Promise<"owner" | "admin"> {
  const [row] = await tx
    .select({ role: auth.member.role })
    .from(auth.member)
    .where(
      and(eq(auth.member.organizationId, orgId), eq(auth.member.userId, userId))
    )
    .limit(1)
    .for("share")
  const role = row ? toMembershipSeniority(row.role) : null
  if (role !== "owner" && role !== "admin") {
    throw new TeamMemberError("MANAGER_REQUIRED")
  }
  return role
}

export interface InviteTeamMemberResult {
  invitationId: string
  email: string
  role: TeamInviteRole
  expiresAt: Date
  /** The address already had a pending invitation: it was renewed. */
  resent: boolean
  /** False when no email left (suppressed address or provider failure). */
  emailSent: boolean
}

/**
 * One invitation write per clinic at a time. It keeps a single pending
 * invitation per address and makes the 200-person limit hold when two
 * admins invite different people at once.
 */
async function lockTeamInvitations(tx: Tx, orgId: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`team-invitations:${orgId}`}, 0))`
  )
}

/** Members plus invitations that can still be accepted, against the limit. */
async function assertTeamHasRoom(
  tx: Tx,
  orgId: string,
  now: Date
): Promise<void> {
  const [memberCount] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(auth.member)
    .where(eq(auth.member.organizationId, orgId))
  const [invitationCount] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(auth.invitation)
    .where(
      and(
        eq(auth.invitation.organizationId, orgId),
        eq(auth.invitation.status, "pending"),
        gt(auth.invitation.expiresAt, now)
      )
    )
  const people =
    Number(memberCount?.value ?? 0) + Number(invitationCount?.value ?? 0)
  if (people >= TEAM_MEMBER_LIMIT) {
    throw new TeamMemberError("MEMBER_LIMIT_REACHED")
  }
}

/**
 * One address is emailed at most once a minute by a clinic, whatever
 * happened to its earlier invitations (withdrawn, declined, expired). Each
 * send sets the expiry seven days out, so the last send is the latest
 * expiry minus seven days. A stored time in the future counts as just sent.
 */
async function assertMayInvite(
  tx: Tx,
  orgId: string,
  email: string,
  now: Date
): Promise<void> {
  const [latest] = await tx
    .select({ expiresAt: sql<Date | null>`max(${auth.invitation.expiresAt})` })
    .from(auth.invitation)
    .where(
      and(
        eq(auth.invitation.organizationId, orgId),
        sql`lower(${auth.invitation.email}) = ${email}`
      )
    )
  if (latest?.expiresAt) {
    const lastSent =
      new Date(latest.expiresAt).getTime() - TEAM_INVITATION_TTL_MS
    const sinceLastSend = now.getTime() - lastSent
    if (sinceLastSend < TEAM_INVITATION_RESEND_COOLDOWN_MS) {
      throw new TeamMemberError("INVITATION_RECENTLY_SENT", {
        retryAfterSeconds: Math.ceil(
          (TEAM_INVITATION_RESEND_COOLDOWN_MS - sinceLastSend) / 1000
        ),
      })
    }
  }

  // The person said no: this clinic leaves them alone for a while.
  const [newest] = await tx
    .select({
      status: auth.invitation.status,
      expiresAt: auth.invitation.expiresAt,
    })
    .from(auth.invitation)
    .where(
      and(
        eq(auth.invitation.organizationId, orgId),
        sql`lower(${auth.invitation.email}) = ${email}`
      )
    )
    .orderBy(desc(auth.invitation.expiresAt))
    .limit(1)
  if (newest?.status === "rejected") {
    const sinceDeclined =
      now.getTime() - (newest.expiresAt.getTime() - TEAM_INVITATION_TTL_MS)
    if (sinceDeclined < TEAM_INVITATION_DECLINE_COOLDOWN_MS) {
      throw new TeamMemberError("INVITATION_DECLINED", {
        retryAfterSeconds: Math.ceil(
          (TEAM_INVITATION_DECLINE_COOLDOWN_MS - sinceDeclined) / 1000
        ),
      })
    }
  }

  // Every invitation this clinic sent in the last day, whatever became of
  // it (accepted, withdrawn, declined, expired).
  const dayAgo = new Date(
    now.getTime() + TEAM_INVITATION_TTL_MS - 24 * 60 * 60 * 1000
  )
  const [today] = await tx
    .select({ sent: sql<number>`count(*)::int` })
    .from(auth.invitation)
    .where(
      and(
        eq(auth.invitation.organizationId, orgId),
        gt(auth.invitation.expiresAt, dayAgo),
        // Sending this one again is not another address.
        sql`lower(${auth.invitation.email}) <> ${email}`
      )
    )
  if ((today?.sent ?? 0) >= TEAM_INVITATIONS_PER_DAY) {
    throw new TeamMemberError("INVITATION_DAILY_LIMIT")
  }
}

/** Who invites and into which clinic, for the invitation email. */
async function invitationNames(
  tx: Tx,
  orgId: string,
  actorUserId: string
): Promise<{
  organizationName: string | undefined
  inviterName: string | undefined
  inviterLocale: string | null
}> {
  const [org] = await tx
    .select({
      name: auth.organization.name,
      clinicName: main.clinicProfiles.displayName,
    })
    .from(auth.organization)
    .leftJoin(
      main.clinicProfiles,
      eq(main.clinicProfiles.orgId, auth.organization.id)
    )
    .where(eq(auth.organization.id, orgId))
    .limit(1)
  const [inviter] = await tx
    .select({ name: auth.user.name, locale: auth.user.locale })
    .from(auth.user)
    .where(eq(auth.user.id, actorUserId))
    .limit(1)
  return {
    organizationName: org?.clinicName ?? org?.name ?? undefined,
    inviterName: inviter?.name ?? undefined,
    inviterLocale: inviter?.locale ?? null,
  }
}

/**
 * Invites someone to the clinic by email, or renews the pending invitation
 * for that address (new 7-day window, same link). Audited as
 * `invitation.invited` in the same transaction; the email goes out after
 * the commit, so a mail failure leaves a valid invitation that can be
 * sent again.
 */
export async function inviteTeamMember(input: {
  orgId: string
  actorUserId: string
  email: string
  role: TeamInviteRole
  now?: Date
}): Promise<InviteTeamMemberResult> {
  const email = input.email.trim().toLowerCase()

  const saved = await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await lockTeamInvitations(tx, input.orgId)
      // Read the clock after the lock: a request that waited its turn must
      // not judge the cooldown with a time from before the wait.
      const now = input.now ?? new Date()
      const expiresAt = new Date(now.getTime() + TEAM_INVITATION_TTL_MS)
      const actor = await requireManager(tx, input.orgId, input.actorUserId)
      if (input.role === "admin" && actor !== "owner") {
        throw new TeamMemberError("OWNER_REQUIRED")
      }

      const [existingMember] = await tx
        .select({ id: auth.member.id })
        .from(auth.member)
        .innerJoin(auth.user, eq(auth.user.id, auth.member.userId))
        .where(
          and(
            eq(auth.member.organizationId, input.orgId),
            sql`lower(${auth.user.email}) = ${email}`
          )
        )
        .limit(1)
      if (existingMember) throw new TeamMemberError("ALREADY_MEMBER")

      // Locked, so a withdrawal in flight finishes first and is seen.
      const [pending] = await tx
        .select({
          id: auth.invitation.id,
          role: auth.invitation.role,
          expiresAt: auth.invitation.expiresAt,
        })
        .from(auth.invitation)
        .where(
          and(
            eq(auth.invitation.organizationId, input.orgId),
            eq(auth.invitation.status, "pending"),
            sql`lower(${auth.invitation.email}) = ${email}`
          )
        )
        .limit(1)
        .for("update")
      if (
        pending &&
        inviteRole(pending.role) === "admin" &&
        actor !== "owner"
      ) {
        throw new TeamMemberError("OWNER_REQUIRED")
      }
      await assertMayInvite(tx, input.orgId, email, now)

      if (pending) {
        // A lapsed invitation gave its place back: renewing takes one again.
        if (pending.expiresAt.getTime() <= now.getTime()) {
          await assertTeamHasRoom(tx, input.orgId, now)
        }
        const [renewed] = await tx
          .update(auth.invitation)
          .set({
            role: input.role,
            expiresAt,
            inviterId: input.actorUserId,
          })
          .where(
            and(
              eq(auth.invitation.id, pending.id),
              eq(auth.invitation.status, "pending")
            )
          )
          .returning({ id: auth.invitation.id })
        if (!renewed) throw new TeamMemberError("INVITATION_NOT_FOUND")
        await ctx.emit({
          entity: "invitation",
          action: "invited",
          entityId: renewed.id,
          payload: { role: input.role, resent: true },
        })
        return {
          invitationId: renewed.id,
          resent: true,
          expiresAt,
          ...(await invitationNames(tx, input.orgId, input.actorUserId)),
        }
      }

      await assertTeamHasRoom(tx, input.orgId, now)

      const [created] = await tx
        .insert(auth.invitation)
        .values({
          organizationId: input.orgId,
          email,
          role: input.role,
          status: "pending",
          expiresAt,
          inviterId: input.actorUserId,
        })
        .returning({ id: auth.invitation.id })
      if (!created) throw new Error("invitation insert returned no row")
      await ctx.emit({
        entity: "invitation",
        action: "invited",
        entityId: created.id,
        payload: { role: input.role, resent: false },
      })
      return {
        invitationId: created.id,
        resent: false,
        expiresAt,
        ...(await invitationNames(tx, input.orgId, input.actorUserId)),
      }
    }
  )

  let emailSent: boolean
  try {
    emailSent = await sendOrgInvitationEmail({
      email,
      url: invitationAcceptUrl(saved.invitationId),
      orgId: input.orgId,
      invitationId: saved.invitationId,
      organizationName: saved.organizationName,
      inviterName: saved.inviterName,
      fallbackLocale: saved.inviterLocale,
      // A renewal has a new expiry, so it is delivered as a new email.
      sendKey: String(saved.expiresAt.getTime()),
    })
  } catch (err) {
    emailSent = false
    console.error(
      "[team-members] invitation email failed",
      err instanceof Error ? err.message : "unknown"
    )
  }

  return {
    invitationId: saved.invitationId,
    email,
    role: input.role,
    expiresAt: saved.expiresAt,
    resent: saved.resent,
    emailSent,
  }
}

/** Withdraws a pending invitation: its link stops working. Audited. */
export async function cancelTeamInvitation(input: {
  orgId: string
  actorUserId: string
  invitationId: string
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const actor = await requireManager(tx, input.orgId, input.actorUserId)
      const [pending] = await tx
        .select({ id: auth.invitation.id, role: auth.invitation.role })
        .from(auth.invitation)
        .where(
          and(
            eq(auth.invitation.id, input.invitationId),
            eq(auth.invitation.organizationId, input.orgId),
            eq(auth.invitation.status, "pending")
          )
        )
        .for("update")
      if (!pending) throw new TeamMemberError("INVITATION_NOT_FOUND")
      if (inviteRole(pending.role) === "admin" && actor !== "owner") {
        throw new TeamMemberError("OWNER_REQUIRED")
      }
      const [cancelled] = await tx
        .update(auth.invitation)
        .set({ status: "canceled" })
        .where(
          and(
            eq(auth.invitation.id, pending.id),
            eq(auth.invitation.status, "pending")
          )
        )
        .returning({ id: auth.invitation.id })
      if (!cancelled) throw new TeamMemberError("INVITATION_NOT_FOUND")
      await ctx.emit({
        entity: "invitation",
        action: "revoked",
        entityId: cancelled.id,
        payload: {},
      })
    }
  )
}

export interface RemoveTeamMemberResult {
  userId: string
  /** Services taken off the clinic's public pages with the removal. */
  unpublishedServices: number
}

/**
 * Removes someone from the clinic. The owner is never removed, nobody
 * removes themself, and a member with sessions still to happen stays until
 * those are done or cancelled (a slot being paid for counts), so no member
 * is left with a session nobody can run. The person's services in this clinic are unpublished in the same
 * transaction. Audited as `membership.removed`.
 */
export async function removeTeamMember(input: {
  orgId: string
  actorUserId: string
  memberId: string
  /**
   * Runs in the removal's transaction, after the member row is gone (the
   * API marks the clinic's seat count for a Stripe sync here).
   */
  afterRemove?: (tx: Tx) => Promise<void>
  now?: Date
}): Promise<RemoveTeamMemberResult> {
  const now = input.now ?? new Date()
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const actor = await requireManager(tx, input.orgId, input.actorUserId)
      const [target] = await tx
        .select({
          id: auth.member.id,
          userId: auth.member.userId,
          role: auth.member.role,
        })
        .from(auth.member)
        .where(
          and(
            eq(auth.member.id, input.memberId),
            eq(auth.member.organizationId, input.orgId)
          )
        )
        .for("update")
      if (!target) throw new TeamMemberError("MEMBER_NOT_FOUND")
      const role = toMembershipSeniority(target.role)
      if (role === "owner") throw new TeamMemberError("CANNOT_REMOVE_OWNER")
      if (target.userId === input.actorUserId) {
        throw new TeamMemberError("CANNOT_REMOVE_SELF")
      }
      if (role === "admin" && actor !== "owner") {
        throw new TeamMemberError("OWNER_REQUIRED")
      }

      // Reservations hold these rows shared: wait for any in flight, then
      // count them; later ones wait for this removal and are refused.
      const profileIds = await lockExpertProfilesForRemoval(
        tx,
        input.orgId,
        target.userId
      )

      const stillRunningSince = new Date(now.getTime() - TEAM_SESSION_TRAIL_MS)
      let unpublishedServices = 0
      if (profileIds.length > 0) {
        // Bookings and live holds in one statement (one snapshot): a hold
        // being confirmed is seen as one or the other, never as neither.
        const [scheduled] = await tx
          .select({
            bookings: sql<number>`(
              select count(*)::int from ${main.bookings}
              where ${and(
                eq(main.bookings.orgId, input.orgId),
                inArray(main.bookings.expertProfileId, profileIds),
                notInArray(main.bookings.status, [
                  ...FINISHED_BOOKING_STATUSES,
                ]),
                // Still to happen, running, or within the time a call may
                // run on after its booked end.
                gt(main.bookings.endsAt, stillRunningSince)
              )}
            )`,
            holds: sql<number>`(
              select count(*)::int from ${main.slotReservations}
              where ${and(
                eq(main.slotReservations.orgId, input.orgId),
                inArray(main.slotReservations.expertProfileId, profileIds),
                inArray(main.slotReservations.status, [...LIVE_HOLD_STATUSES])
              )}
            )`,
          })
          .from(auth.member)
          .where(eq(auth.member.id, target.id))
        const upcomingSessions = Number(scheduled?.bookings ?? 0)
        const pendingBookings = Number(scheduled?.holds ?? 0)
        if (upcomingSessions + pendingBookings > 0) {
          throw new TeamMemberError("MEMBER_HAS_UPCOMING_SESSIONS", {
            upcomingSessions,
            pendingBookings,
          })
        }
        const unpublished = await tx
          .update(main.eventTypes)
          .set({ published: false, updatedAt: now })
          .where(
            and(
              eq(main.eventTypes.orgId, input.orgId),
              inArray(main.eventTypes.expertProfileId, profileIds),
              eq(main.eventTypes.published, true)
            )
          )
          .returning({ id: main.eventTypes.id })
        unpublishedServices = unpublished.length
      }

      await tx.delete(auth.member).where(eq(auth.member.id, target.id))
      await input.afterRemove?.(tx)
      await ctx.emit({
        entity: "membership",
        action: "removed",
        entityId: target.id,
        payload: { userId: target.userId, role, unpublishedServices },
      })
      return { userId: target.userId, unpublishedServices }
    }
  )
}
