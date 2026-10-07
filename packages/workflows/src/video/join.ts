import { and, eq, isNull } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import {
  JOIN_LEAD_MS,
  JOIN_TRAIL_MS,
  dailyClientFromEnv,
  mintMeetingToken,
  tokenExpUnix,
} from "@eleva/video"

export type SessionJoinErrorCode =
  | "NOT_A_PARTICIPANT"
  | "SESSION_NOT_ACTIVE"
  | "SESSION_NOT_OPEN"
  | "ROOM_NOT_READY"

export class SessionJoinError extends Error {
  override readonly name = "SessionJoinError"
  constructor(readonly code: SessionJoinErrorCode) {
    super(code)
  }
}

export function classifyJoinStatus(
  status: string
): { ok: true } | { error: "SESSION_NOT_ACTIVE" } {
  if (status === "scheduled" || status === "live") return { ok: true }
  return { error: "SESSION_NOT_ACTIVE" }
}

export function classifyJoinWindow(
  now: Date,
  startsAt: Date,
  endsAt: Date
): { ok: true } | { error: "SESSION_NOT_OPEN" } {
  const openAt = startsAt.getTime() - JOIN_LEAD_MS
  const closeAt = endsAt.getTime() + JOIN_TRAIL_MS
  const t = now.getTime()
  if (t < openAt || t > closeAt) return { error: "SESSION_NOT_OPEN" }
  return { ok: true }
}

export function classifyJoinCaller(input: {
  userId: string
  expertUserId: string | null
  memberUserId: string | null
  hasActiveDelegate: boolean
}):
  | { role: "expert" | "member" | "delegate" }
  | { error: "NOT_A_PARTICIPANT" } {
  if (input.expertUserId && input.userId === input.expertUserId) {
    return { role: "expert" }
  }
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
}

export type JoinSessionResult = {
  roomUrl: string
  token: string
  expiresAt: string
}

export type JoinSessionDeps = {
  mint?: typeof mintMeetingToken
  getDomainId?: () => Promise<string>
  apiKey?: string
  domainId?: string
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
      })
      .from(main.sessions)
      .innerJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.sessions.expertProfileId)
      )
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

  const caller = classifyJoinCaller({
    userId: input.userId,
    expertUserId: row.session.expertUserId,
    memberUserId: row.session.memberUserId,
    hasActiveDelegate: Boolean(row.delegate && !row.delegate.revokedAt),
  })
  if ("error" in caller) throw new SessionJoinError(caller.error)

  const status = classifyJoinStatus(row.session.status)
  if ("error" in status) throw new SessionJoinError(status.error)

  const window = classifyJoinWindow(
    now,
    row.session.startsAt,
    row.session.endsAt
  )
  if ("error" in window) throw new SessionJoinError(window.error)

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

  return withPlatformAudit(
    { orgId: row.session.orgId, actorUserId: input.userId },
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
        isOwner: caller.role === "expert",
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
      }
    }
  )
}
