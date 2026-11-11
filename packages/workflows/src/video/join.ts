import { and, eq, isNull } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import {
  auth,
  hasActiveAiProcessingConsent,
  isActiveBookingExpert,
  main,
  withPlatformAdminContext,
} from "@eleva/db"
import {
  JOIN_LEAD_MS,
  JOIN_TRAIL_MS,
  dailyClientFromEnv,
  mintMeetingToken,
  tokenExpUnix,
} from "@eleva/video"
import { checkJoinGrant, type JoinGrantRole } from "@eleva/video/join-grant"

export type SessionJoinErrorCode =
  | "NOT_A_PARTICIPANT"
  | "SESSION_NOT_ACTIVE"
  | "SESSION_NOT_OPEN"
  /** Held and over: joining has closed, or the session was marked done. */
  | "SESSION_ENDED"
  | "ROOM_NOT_READY"
  | "INVALID_GRANT"

export class SessionJoinError extends Error {
  override readonly name = "SessionJoinError"
  constructor(
    readonly code: SessionJoinErrorCode,
    readonly details?: {
      startsAt?: string
      opensAt?: string
      /** When joining stops: 30 minutes after the booked end. */
      closesAt?: string
      /** Server time of this answer, so a waiting room can ignore a wrong device clock. */
      now?: string
    }
  ) {
    super(code)
  }
}

const FINISHED_STATUSES = new Set(["completed", "ended", "no_show"])

export function classifyJoinStatus(
  status: string,
  /** Whether the booked start has passed; defaults to no. */
  started = false
):
  | { ok: true }
  | { error: "SESSION_NOT_ACTIVE" | "SESSION_ENDED" | "ROOM_NOT_READY" } {
  if (status === "scheduled" || status === "live") return { ok: true }
  if (status === "room_unresolved") return { error: "ROOM_NOT_READY" }
  // "Ended" is only said once the booked start has passed, so a status
  // set too early never tells someone their session is already over.
  if (started && FINISHED_STATUSES.has(status)) {
    return { error: "SESSION_ENDED" }
  }
  return { error: "SESSION_NOT_ACTIVE" }
}

export function classifyJoinWindow(
  now: Date,
  startsAt: Date,
  endsAt: Date
): { ok: true } | { error: "SESSION_NOT_OPEN" | "SESSION_ENDED" } {
  const openAt = startsAt.getTime() - JOIN_LEAD_MS
  const closeAt = endsAt.getTime() + JOIN_TRAIL_MS
  const t = now.getTime()
  if (t < openAt) return { error: "SESSION_NOT_OPEN" }
  if (t > closeAt) return { error: "SESSION_ENDED" }
  return { ok: true }
}

/** What a waiting room needs to say when joining opens, or that it closed. */
export function joinWindowDetails(
  now: Date,
  startsAt: Date,
  endsAt: Date
): { startsAt: string; opensAt: string; closesAt: string; now: string } {
  return {
    startsAt: startsAt.toISOString(),
    opensAt: new Date(startsAt.getTime() - JOIN_LEAD_MS).toISOString(),
    closesAt: new Date(endsAt.getTime() + JOIN_TRAIL_MS).toISOString(),
    now: now.toISOString(),
  }
}

export function classifyJoinCaller(input: {
  userId: string
  /** `isActiveBookingExpert`: the booking's expert, still in its org. */
  isActiveExpert: boolean
  memberUserId: string | null
  hasActiveDelegate: boolean
}):
  | { role: "expert" | "member" | "delegate" }
  | { error: "NOT_A_PARTICIPANT" } {
  if (input.isActiveExpert) return { role: "expert" }
  if (input.memberUserId && input.userId === input.memberUserId) {
    return { role: "member" }
  }
  if (input.hasActiveDelegate) return { role: "delegate" }
  return { error: "NOT_A_PARTICIPANT" }
}

export type JoinSessionInput = {
  bookingId: string
  userId: string
  userName: string
  now?: Date
  /** When set, skip session-cookie participant checks (grant is role-bound). */
  grantRole?: JoinGrantRole
  /** Audit actor; defaults to userId. Null for guest grants with no account. */
  actorUserId?: string | null
}

export type JoinSessionResult = {
  roomUrl: string
  token: string
  expiresAt: string
  endsAt: string
  /** Live transcription needs the member's active ai_processing consent. */
  transcriptionAllowed: boolean
  /** Language the session was booked in; seeds the live transcript. */
  sessionLanguage: string | null
}

export type JoinSessionDeps = {
  mint?: typeof mintMeetingToken
  hasAiConsent?: typeof hasActiveAiProcessingConsent
  getDomainId?: () => Promise<string>
  apiKey?: string
  domainId?: string
}

export async function joinSessionFromGrant(
  input: {
    bookingId: string
    grant: string
    now?: Date
  },
  deps: JoinSessionDeps = {}
): Promise<JoinSessionResult> {
  const check = await checkJoinGrant(input.grant, { now: input.now })
  if (
    check.status === "invalid" ||
    check.claims.bookingId !== input.bookingId
  ) {
    throw new SessionJoinError("INVALID_GRANT")
  }
  const { claims } = check
  // Also refuses a link from before a reschedule (INVALID_GRANT), so only
  // the latest link of a real booking is ever told "ended".
  const identity = await resolveGrantJoinIdentity(
    input.bookingId,
    claims.role,
    claims.scheduleRevision
  )
  if (check.status === "expired") {
    // A cancelled session did not end: say "not active" for it.
    const status = classifyJoinStatus(identity.sessionStatus, true)
    throw new SessionJoinError(
      "error" in status && status.error === "SESSION_NOT_ACTIVE"
        ? "SESSION_NOT_ACTIVE"
        : "SESSION_ENDED"
    )
  }
  return joinSession(
    {
      bookingId: input.bookingId,
      userId: identity.userId,
      userName: identity.userName,
      now: input.now,
      grantRole: claims.role,
      actorUserId: identity.actorUserId,
    },
    deps
  )
}

async function resolveGrantJoinIdentity(
  bookingId: string,
  role: JoinGrantRole,
  scheduleRevision: number
): Promise<{
  userId: string
  userName: string
  actorUserId?: string | null
  sessionStatus: string
}> {
  let sessionStatus = ""
  const identity = await withPlatformAdminContext(async (tx) => {
    const [session] = await tx
      .select({
        status: main.sessions.status,
        memberUserId: main.sessions.memberUserId,
        expertUserId: main.expertProfiles.userId,
        guestName: main.bookings.guestName,
        scheduleRevision: main.bookings.scheduleRevision,
      })
      .from(main.sessions)
      .innerJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.sessions.expertProfileId)
      )
      .innerJoin(main.bookings, eq(main.bookings.id, main.sessions.bookingId))
      .where(eq(main.sessions.bookingId, bookingId))
      .limit(1)
    if (!session) return null
    if (session.scheduleRevision !== scheduleRevision) {
      throw new SessionJoinError("INVALID_GRANT")
    }
    sessionStatus = session.status

    switch (role) {
      case "expert": {
        const [expert] = await tx
          .select({ id: auth.user.id, name: auth.user.name })
          .from(auth.user)
          .where(eq(auth.user.id, session.expertUserId))
          .limit(1)
        return expert
          ? {
              userId: expert.id,
              userName: expert.name?.trim() || "Expert",
              actorUserId: expert.id,
            }
          : null
      }
      case "member": {
        if (session.memberUserId) {
          const [member] = await tx
            .select({ id: auth.user.id, name: auth.user.name })
            .from(auth.user)
            .where(eq(auth.user.id, session.memberUserId))
            .limit(1)
          if (!member) return null
          return {
            userId: member.id,
            userName: member.name?.trim() || "Member",
            actorUserId: member.id,
          }
        }
        return {
          userId: `guest:${bookingId}`,
          userName: session.guestName?.trim() || "Member",
          actorUserId: null,
        }
      }
      default: {
        const _exhaustive: never = role
        return _exhaustive
      }
    }
  })
  if (!identity) throw new SessionJoinError("NOT_A_PARTICIPANT")
  return { ...identity, sessionStatus }
}

export async function joinSession(
  input: JoinSessionInput,
  deps: JoinSessionDeps = {}
): Promise<JoinSessionResult> {
  const now = input.now ?? new Date()
  const row = await withPlatformAdminContext(async (tx) => {
    const [session] = await tx
      .select({
        orgId: main.sessions.orgId,
        status: main.sessions.status,
        startsAt: main.sessions.startsAt,
        endsAt: main.sessions.endsAt,
        dailyRoomName: main.sessions.dailyRoomName,
        dailyRoomUrl: main.sessions.dailyRoomUrl,
        memberUserId: main.sessions.memberUserId,
        expertUserId: main.expertProfiles.userId,
        language: main.bookings.language,
      })
      .from(main.sessions)
      .innerJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.sessions.expertProfileId)
      )
      .innerJoin(main.bookings, eq(main.bookings.id, main.sessions.bookingId))
      .where(eq(main.sessions.bookingId, input.bookingId))
      .limit(1)
    if (!session) return null
    const [delegate] = await tx
      .select({
        id: main.sessionParticipants.id,
        revokedAt: main.sessionParticipants.revokedAt,
      })
      .from(main.sessionParticipants)
      .where(
        and(
          eq(main.sessionParticipants.bookingId, input.bookingId),
          eq(main.sessionParticipants.userId, input.userId)
        )
      )
      .limit(1)
    return { session, delegate: delegate ?? null }
  })

  if (!row) throw new SessionJoinError("NOT_A_PARTICIPANT")

  // Expert joins, by session or by an emailed expert grant, need the
  // booking's expert to still belong to its org. Member and guest joins
  // are unchanged.
  // Delegate, supervisor and member grants carry their own role, so only a
  // session join or an expert grant needs the check (one DB read).
  const needsExpertCheck =
    input.grantRole === undefined || input.grantRole === "expert"
  const isActiveExpert = needsExpertCheck
    ? await isActiveBookingExpert(row.session, input.userId)
    : false
  if (input.grantRole === "expert" && !isActiveExpert) {
    throw new SessionJoinError("NOT_A_PARTICIPANT")
  }
  const caller = input.grantRole
    ? { role: input.grantRole }
    : classifyJoinCaller({
        userId: input.userId,
        isActiveExpert,
        memberUserId: row.session.memberUserId,
        hasActiveDelegate: Boolean(row.delegate && !row.delegate.revokedAt),
      })
  if ("error" in caller) throw new SessionJoinError(caller.error)

  const status = classifyJoinStatus(
    row.session.status,
    now.getTime() >= row.session.startsAt.getTime()
  )
  if ("error" in status) throw new SessionJoinError(status.error)

  const window = classifyJoinWindow(
    now,
    row.session.startsAt,
    row.session.endsAt
  )
  if ("error" in window) {
    throw new SessionJoinError(
      window.error,
      window.error === "SESSION_NOT_OPEN"
        ? joinWindowDetails(now, row.session.startsAt, row.session.endsAt)
        : undefined
    )
  }

  if (!row.session.dailyRoomName || !row.session.dailyRoomUrl) {
    throw new SessionJoinError("ROOM_NOT_READY")
  }

  const apiKey = deps.apiKey ?? process.env.DAILY_API_KEY
  if (!apiKey) throw new Error("DAILY_API_KEY is required")
  const getDomainId =
    deps.getDomainId ?? (() => dailyClientFromEnv().getDomainId())
  const domainId =
    deps.domainId ?? process.env.DAILY_DOMAIN_ID ?? (await getDomainId())
  const mint = deps.mint ?? mintMeetingToken
  const exp = tokenExpUnix(now, row.session.endsAt)
  const transcriptionAllowed = await (
    deps.hasAiConsent ?? hasActiveAiProcessingConsent
  )({ memberUserId: row.session.memberUserId, bookingId: input.bookingId })

  const actorUserId =
    input.actorUserId === undefined ? input.userId : input.actorUserId
  return withPlatformAudit(
    { orgId: row.session.orgId, actorUserId },
    async (tx, ctx) => {
      const [lockedSession] = await tx
        .select({ status: main.sessions.status })
        .from(main.sessions)
        .where(eq(main.sessions.bookingId, input.bookingId))
        .for("update")
        .limit(1)
      const lockedStatus = lockedSession
        ? classifyJoinStatus(lockedSession.status)
        : { error: "SESSION_NOT_ACTIVE" as const }
      if ("error" in lockedStatus)
        throw new SessionJoinError(lockedStatus.error)

      if (caller.role === "delegate") {
        const [lockedDelegate] = await tx
          .select({
            revokedAt: main.sessionParticipants.revokedAt,
          })
          .from(main.sessionParticipants)
          .where(
            and(
              eq(main.sessionParticipants.bookingId, input.bookingId),
              eq(main.sessionParticipants.userId, input.userId),
              isNull(main.sessionParticipants.revokedAt)
            )
          )
          .for("update")
          .limit(1)
        if (!lockedDelegate) throw new SessionJoinError("NOT_A_PARTICIPANT")
      }

      const token = await mint({
        roomName: row.session.dailyRoomName!,
        userId: input.userId,
        userName: input.userName,
        canAdmin:
          caller.role === "expert"
            ? transcriptionAllowed
              ? ["participants", "transcription"]
              : ["participants"]
            : [],
        exp,
        domainId,
        apiKey,
      })
      await ctx.emit({
        entity: "session",
        action: "joined",
        entityId: input.bookingId,
        payload: {
          userId: input.userId,
          roomName: row.session.dailyRoomName,
        },
      })
      return {
        roomUrl: row.session.dailyRoomUrl!,
        token,
        expiresAt: new Date(exp * 1000).toISOString(),
        endsAt: row.session.endsAt.toISOString(),
        transcriptionAllowed,
        sessionLanguage: row.session.language ?? null,
      }
    }
  )
}
