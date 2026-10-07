import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { withAudit, withPlatformAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import {
  DailyHttpError,
  buildSessionRoomBody,
  dailyClientFromEnv,
  isElevaRoomName,
  roomNameForBooking,
  type CreateSessionRoomInput,
  type DailyRoom,
  type SessionRoomProperties,
} from "@eleva/video"
import { ensureSessionRow } from "@eleva/scheduling"

const ROOM_LEASE_MS = 60_000
const SWEEP_AHEAD_MS = 2 * 60 * 60 * 1000
const SWEEP_BATCH = 25

export type EnsureSessionRoomResult =
  | { skipped: "not_online" | "not_confirmed" | "no_member" | "leased" }
  | { ok: true; roomName: string; created: boolean }
  | { unresolved: true }

export type SessionRoomDaily = {
  createSessionRoom: (input: CreateSessionRoomInput) => Promise<DailyRoom>
  updateSessionRoom: (
    name: string,
    properties: SessionRoomProperties
  ) => Promise<DailyRoom>
  deleteRoom: (name: string) => Promise<void>
}

export type SessionRoomDeps = {
  daily?: SessionRoomDaily
}

function isConfirmable(status: string) {
  return status === "confirmed" || status === "rescheduled"
}

export function classifySessionRoomBooking(booking: {
  status: string
  sessionMode: string
  memberUserId: string | null
  language: string | null
}):
  | { skipped: "not_online" | "not_confirmed" | "no_member" }
  | { ok: true; lang: "en" | "es" | "pt" } {
  if (!isConfirmable(booking.status)) return { skipped: "not_confirmed" }
  if (booking.sessionMode !== "online") return { skipped: "not_online" }
  if (!booking.memberUserId) return { skipped: "no_member" }
  const lang =
    booking.language === "en" ||
    booking.language === "es" ||
    booking.language === "pt"
      ? booking.language
      : "pt"
  return { ok: true, lang }
}

export function classifyRoomLease(
  session: {
    dailyRoomName: string | null
    roomCreateLeaseUntil: Date | null
  },
  now = new Date()
): { ready: string } | { skip: "leased" } | { lease: true } {
  if (session.dailyRoomName) return { ready: session.dailyRoomName }
  if (
    session.roomCreateLeaseUntil &&
    session.roomCreateLeaseUntil.getTime() > now.getTime()
  ) {
    return { skip: "leased" }
  }
  return { lease: true }
}

function daily(deps?: SessionRoomDeps): SessionRoomDaily {
  return deps?.daily ?? dailyClientFromEnv()
}

class SessionNoLongerWritable extends Error {
  override readonly name = "SessionNoLongerWritable"
}

async function clearRoomLease(bookingId: string) {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.sessions)
      .set({ roomCreateLeaseUntil: null })
      .where(
        and(
          eq(main.sessions.bookingId, bookingId),
          isNull(main.sessions.dailyRoomName)
        )
      )
  })
}

export async function ensureSessionRoom(
  bookingId: string,
  deps: SessionRoomDeps = {}
): Promise<EnsureSessionRoomResult> {
  const booking = await withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        id: main.bookings.id,
        orgId: main.bookings.orgId,
        eventTypeId: main.bookings.eventTypeId,
        expertProfileId: main.bookings.expertProfileId,
        memberUserId: main.bookings.memberUserId,
        startsAt: main.bookings.startsAt,
        endsAt: main.bookings.endsAt,
        sessionMode: main.bookings.sessionMode,
        status: main.bookings.status,
        language: main.bookings.language,
      })
      .from(main.bookings)
      .where(eq(main.bookings.id, bookingId))
      .limit(1)
    return row ?? null
  })

  if (!booking) return { skipped: "not_confirmed" }
  const eligibility = classifySessionRoomBooking(booking)
  if ("skipped" in eligibility) return eligibility

  type LeaseOutcome =
    | { skip: "no_member" | "leased" }
    | { ready: string; status: string }
    | { lease: true }

  const leased = await withPlatformAdminContext(
    async (tx): Promise<LeaseOutcome> => {
      await ensureSessionRow(tx, booking)
      await tx
        .update(main.sessions)
        .set({
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
        })
        .where(eq(main.sessions.bookingId, bookingId))
      const [session] = await tx
        .select({
          id: main.sessions.id,
          status: main.sessions.status,
          dailyRoomName: main.sessions.dailyRoomName,
          roomCreateLeaseUntil: main.sessions.roomCreateLeaseUntil,
        })
        .from(main.sessions)
        .where(eq(main.sessions.bookingId, bookingId))
        .limit(1)
      if (!session) return { skip: "no_member" as const }
      const lease = classifyRoomLease(session)
      if ("ready" in lease) {
        return { ...lease, status: session.status }
      }
      if ("skip" in lease) return lease
      const now = new Date()
      const claimed = await tx
        .update(main.sessions)
        .set({
          roomCreateAttemptAt: now,
          roomCreateLeaseUntil: new Date(now.getTime() + ROOM_LEASE_MS),
          roomAttemptSeq: sql`${main.sessions.roomAttemptSeq} + 1`,
        })
        .where(
          and(
            eq(main.sessions.id, session.id),
            isNull(main.sessions.dailyRoomName),
            sql`(room_create_lease_until IS NULL OR room_create_lease_until <= now())`
          )
        )
        .returning({ id: main.sessions.id })
      return claimed.length > 0
        ? { lease: true as const }
        : { skip: "leased" as const }
    }
  )

  if ("skip" in leased) return { skipped: leased.skip }

  const client = daily(deps)
  const roomInput = {
    bookingId,
    startAt: booking.startsAt,
    endAt: booking.endsAt,
    lang: eligibility.lang,
  }

  if ("ready" in leased) {
    const writable =
      leased.status === "scheduled" || leased.status === "room_unresolved"
    if (!writable) {
      return { ok: true, roomName: leased.ready, created: false }
    }
    const body = buildSessionRoomBody(roomInput)
    try {
      await client.updateSessionRoom(leased.ready, body.properties)
      return { ok: true, roomName: leased.ready, created: false }
    } catch (err) {
      if (!(err instanceof DailyHttpError) || err.status !== 404) {
        throw err
      }
    }
  }

  let room: DailyRoom
  try {
    room = await client.createSessionRoom(roomInput)
  } catch (err) {
    await clearRoomLease(bookingId)
    if (err instanceof DailyHttpError && err.status >= 500) {
      try {
        await withPlatformAudit(
          { orgId: booking.orgId, actorUserId: null },
          async (tx, ctx) => {
            const marked = await tx
              .update(main.sessions)
              .set({ status: "room_unresolved", roomCreateLeaseUntil: null })
              .where(
                and(
                  eq(main.sessions.bookingId, bookingId),
                  inArray(main.sessions.status, [
                    "scheduled",
                    "room_unresolved",
                  ])
                )
              )
              .returning({ id: main.sessions.id })
            if (marked.length === 0) throw new SessionNoLongerWritable()
            await ctx.emit({
              entity: "session",
              action: "room_unresolved",
              entityId: bookingId,
              payload: { bookingId },
            })
          }
        )
      } catch (markErr) {
        if (markErr instanceof SessionNoLongerWritable) {
          return { skipped: "not_confirmed" }
        }
        throw markErr
      }
      return { unresolved: true }
    }
    throw err
  }

  try {
    await withAudit(
      { orgId: booking.orgId, actorUserId: null },
      async (tx, ctx) => {
        const updated = await tx
          .update(main.sessions)
          .set({
            status: "scheduled",
            dailyRoomName: room.name,
            dailyRoomUrl: room.url,
            roomCreatedAt: new Date(),
            roomCreateLeaseUntil: null,
          })
          .where(
            and(
              eq(main.sessions.bookingId, bookingId),
              inArray(main.sessions.status, ["scheduled", "room_unresolved"])
            )
          )
          .returning({ id: main.sessions.id })
        if (updated.length === 0) throw new SessionNoLongerWritable()
        await ctx.emit({
          entity: "session",
          action: "room_created",
          entityId: bookingId,
          payload: { roomName: room.name },
        })
      }
    )
    return { ok: true, roomName: room.name, created: true }
  } catch (err) {
    if (err instanceof SessionNoLongerWritable) {
      if (isElevaRoomName(room.name)) {
        await client.deleteRoom(room.name)
      }
      return { skipped: "not_confirmed" }
    }
    await clearRoomLease(bookingId)
    throw err
  }
}

export async function deleteSessionRoom(
  bookingId: string,
  deps: SessionRoomDeps = {}
): Promise<void> {
  const session = await withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        orgId: main.sessions.orgId,
        dailyRoomName: main.sessions.dailyRoomName,
        status: main.sessions.status,
        bookingStatus: main.bookings.status,
      })
      .from(main.sessions)
      .innerJoin(main.bookings, eq(main.bookings.id, main.sessions.bookingId))
      .where(eq(main.sessions.bookingId, bookingId))
      .limit(1)
    return row ?? null
  })
  if (!session) return
  if (session.bookingStatus !== "cancelled" && session.status !== "cancelled") {
    return
  }

  if (session.status !== "cancelled") {
    await withPlatformAdminContext(async (tx) => {
      await tx
        .update(main.sessions)
        .set({ status: "cancelled" })
        .where(eq(main.sessions.bookingId, bookingId))
    })
  }

  if (session.dailyRoomName && isElevaRoomName(session.dailyRoomName)) {
    await daily(deps).deleteRoom(session.dailyRoomName)
  }

  await withAudit(
    { orgId: session.orgId, actorUserId: null },
    async (tx, ctx) => {
      await tx
        .update(main.sessions)
        .set({
          dailyRoomName: null,
          dailyRoomUrl: null,
        })
        .where(eq(main.sessions.bookingId, bookingId))
      await ctx.emit({
        entity: "session",
        action: "room_deleted",
        entityId: bookingId,
        payload: { roomName: session.dailyRoomName },
      })
    }
  )
}

export async function sweepMissingSessionRooms(
  now = new Date(),
  deps: SessionRoomDeps = {}
) {
  const horizon = new Date(now.getTime() + SWEEP_AHEAD_MS)
  const bookings = await withPlatformAdminContext(async (tx) => {
    return tx
      .select({ id: main.bookings.id })
      .from(main.bookings)
      .leftJoin(main.sessions, eq(main.sessions.bookingId, main.bookings.id))
      .where(
        and(
          inArray(main.bookings.status, ["confirmed", "rescheduled"]),
          eq(main.bookings.sessionMode, "online"),
          isNotNull(main.bookings.memberUserId),
          gte(main.bookings.endsAt, now),
          lte(main.bookings.startsAt, horizon),
          isNull(main.sessions.dailyRoomName),
          or(
            isNull(main.sessions.roomCreateLeaseUntil),
            lte(main.sessions.roomCreateLeaseUntil, now)
          )
        )
      )
      .orderBy(main.bookings.startsAt)
      .limit(SWEEP_BATCH)
  })

  const results = []
  for (const booking of bookings) {
    results.push(await ensureSessionRoom(booking.id, deps))
  }
  return { scanned: bookings.length, results }
}

export function expectedRoomName(bookingId: string) {
  return roomNameForBooking(bookingId)
}
