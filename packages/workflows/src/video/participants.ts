import { and, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { withAudit, withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import {
  DailyHttpError,
  buildSessionRoomBody,
  dailyClientFromEnv,
  isElevaRoomName,
} from "@eleva/video"

export type SessionParticipantErrorCode =
  | "NOT_ASSIGNED_EXPERT"
  | "SESSION_NOT_ACTIVE"
  | "NOT_FOUND"
  | "ALREADY_PARTICIPANT"

export class SessionParticipantError extends Error {
  override readonly name = "SessionParticipantError"
  constructor(readonly code: SessionParticipantErrorCode) {
    super(code)
  }
}

export type SessionParticipantRole = "delegate" | "supervisor"

export type SessionParticipantDaily = {
  updateSessionRoom: (
    name: string,
    properties: ReturnType<typeof buildSessionRoomBody>["properties"]
  ) => Promise<unknown>
  ejectParticipants: (roomName: string, userIds: string[]) => Promise<void>
}

export type SessionParticipantDeps = {
  daily?: SessionParticipantDaily
}

function daily(deps?: SessionParticipantDeps): SessionParticipantDaily {
  return deps?.daily ?? dailyClientFromEnv()
}

async function loadAssignedSession(bookingId: string, actorUserId: string) {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        orgId: main.sessions.orgId,
        status: main.sessions.status,
        startsAt: main.sessions.startsAt,
        endsAt: main.sessions.endsAt,
        dailyRoomName: main.sessions.dailyRoomName,
        expertUserId: main.expertProfiles.userId,
        language: main.bookings.language,
      })
      .from(main.sessions)
      .innerJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.sessions.expertProfileId)
      )
      .innerJoin(main.bookings, eq(main.bookings.id, main.sessions.bookingId))
      .where(eq(main.sessions.bookingId, bookingId))
      .limit(1)
    if (!row) return null
    if (row.expertUserId !== actorUserId) {
      throw new SessionParticipantError("NOT_ASSIGNED_EXPERT")
    }
    if (row.status !== "scheduled" && row.status !== "live") {
      throw new SessionParticipantError("SESSION_NOT_ACTIVE")
    }
    return row
  })
}

async function activeDelegateCount(bookingId: string) {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(main.sessionParticipants)
      .where(
        and(
          eq(main.sessionParticipants.bookingId, bookingId),
          isNull(main.sessionParticipants.revokedAt)
        )
      )
    return row?.count ?? 0
  })
}

async function syncRoomCapacity(
  session: {
    bookingId: string
    startsAt: Date
    endsAt: Date
    dailyRoomName: string | null
    language: string | null
  },
  extraParticipants: number,
  deps?: SessionParticipantDeps
) {
  if (!session.dailyRoomName || !isElevaRoomName(session.dailyRoomName)) return
  const lang =
    session.language === "en" ||
    session.language === "es" ||
    session.language === "pt"
      ? session.language
      : "pt"
  const body = buildSessionRoomBody({
    bookingId: session.bookingId,
    startAt: session.startsAt,
    endAt: session.endsAt,
    extraParticipants,
    lang,
  })
  await daily(deps).updateSessionRoom(session.dailyRoomName, body.properties)
}

export async function addSessionParticipant(
  input: {
    bookingId: string
    actorUserId: string
    userId: string
    role: SessionParticipantRole
  },
  deps: SessionParticipantDeps = {}
) {
  const session = await loadAssignedSession(input.bookingId, input.actorUserId)
  if (!session) throw new SessionParticipantError("NOT_FOUND")

  const participant = await withAudit(
    { orgId: session.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const [existing] = await tx
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
      if (existing && !existing.revokedAt) {
        throw new SessionParticipantError("ALREADY_PARTICIPANT")
      }
      const [row] = existing
        ? await tx
            .update(main.sessionParticipants)
            .set({
              role: input.role,
              addedBy: input.actorUserId,
              addedAt: new Date(),
              revokedAt: null,
              ejectedAt: null,
            })
            .where(eq(main.sessionParticipants.id, existing.id))
            .returning({
              id: main.sessionParticipants.id,
              userId: main.sessionParticipants.userId,
              role: main.sessionParticipants.role,
            })
        : await tx
            .insert(main.sessionParticipants)
            .values({
              orgId: session.orgId,
              bookingId: input.bookingId,
              userId: input.userId,
              role: input.role,
              addedBy: input.actorUserId,
            })
            .returning({
              id: main.sessionParticipants.id,
              userId: main.sessionParticipants.userId,
              role: main.sessionParticipants.role,
            })
      await ctx.emit({
        entity: "session",
        action: "participant_added",
        entityId: input.bookingId,
        payload: { userId: input.userId, role: input.role },
      })
      return row
    }
  )

  const extra = await activeDelegateCount(input.bookingId)
  await syncRoomCapacity(
    { ...session, bookingId: input.bookingId },
    extra,
    deps
  )
  return participant
}

export async function removeSessionParticipant(
  input: {
    bookingId: string
    actorUserId: string
    userId: string
  },
  deps: SessionParticipantDeps = {}
): Promise<{ ok: true } | { ejectionPending: true }> {
  const session = await loadAssignedSession(input.bookingId, input.actorUserId)
  if (!session) throw new SessionParticipantError("NOT_FOUND")

  const revoked = await withAudit(
    { orgId: session.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const updated = await tx
        .update(main.sessionParticipants)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(main.sessionParticipants.bookingId, input.bookingId),
            eq(main.sessionParticipants.userId, input.userId),
            isNull(main.sessionParticipants.revokedAt)
          )
        )
        .returning({ id: main.sessionParticipants.id })
      if (updated.length === 0) throw new SessionParticipantError("NOT_FOUND")
      await ctx.emit({
        entity: "session",
        action: "participant_removed",
        entityId: input.bookingId,
        payload: { userId: input.userId },
      })
      return updated[0]
    }
  )
  if (!revoked) throw new SessionParticipantError("NOT_FOUND")

  const extra = await activeDelegateCount(input.bookingId)
  try {
    await syncRoomCapacity(
      { ...session, bookingId: input.bookingId },
      extra,
      deps
    )
  } catch {
    // Capacity repair is best-effort; revoke already denies new tokens.
  }

  if (session.dailyRoomName && isElevaRoomName(session.dailyRoomName)) {
    try {
      await daily(deps).ejectParticipants(session.dailyRoomName, [input.userId])
    } catch (err) {
      if (!(err instanceof DailyHttpError) || err.status < 500) throw err
      return { ejectionPending: true }
    }
  }

  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.sessionParticipants)
      .set({ ejectedAt: new Date() })
      .where(
        and(
          eq(main.sessionParticipants.bookingId, input.bookingId),
          eq(main.sessionParticipants.userId, input.userId)
        )
      )
  })
  return { ok: true }
}

export async function retryPendingEjects(
  deps: SessionParticipantDeps = {},
  limit = 25
) {
  const pending = await withPlatformAdminContext(async (tx) => {
    return tx
      .select({
        bookingId: main.sessionParticipants.bookingId,
        userId: main.sessionParticipants.userId,
        orgId: main.sessionParticipants.orgId,
        dailyRoomName: main.sessions.dailyRoomName,
      })
      .from(main.sessionParticipants)
      .innerJoin(
        main.sessions,
        eq(main.sessions.bookingId, main.sessionParticipants.bookingId)
      )
      .where(
        and(
          isNotNull(main.sessionParticipants.revokedAt),
          isNull(main.sessionParticipants.ejectedAt)
        )
      )
      .limit(limit)
  })

  let ejected = 0
  let pendingCount = 0
  for (const row of pending) {
    if (row.dailyRoomName && isElevaRoomName(row.dailyRoomName)) {
      try {
        await daily(deps).ejectParticipants(row.dailyRoomName, [row.userId])
      } catch {
        pendingCount += 1
        continue
      }
    }
    await withPlatformAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        await tx
          .update(main.sessionParticipants)
          .set({ ejectedAt: new Date() })
          .where(
            and(
              eq(main.sessionParticipants.bookingId, row.bookingId),
              eq(main.sessionParticipants.userId, row.userId)
            )
          )
        await ctx.emit({
          entity: "session",
          action: "participant_removed",
          entityId: row.bookingId,
          payload: { userId: row.userId, ejected: true },
        })
      }
    )
    ejected += 1
  }
  return { scanned: pending.length, ejected, pending: pendingCount }
}
