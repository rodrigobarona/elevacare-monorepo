import { and, asc, eq, inArray, isNull, lte, ne, notInArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"
import { JOIN_TRAIL_MS } from "@eleva/video"
import {
  deriveAttendance,
  lastLeftAt,
  statusAfterAttendance,
  type BookedTime,
  type SessionAttendance,
} from "./attendance"

const SWEEP_BATCH = 25
const SWEEP_MAX_BATCHES = 8

class AttendanceAlreadyFinalized extends Error {
  override readonly name = "AttendanceAlreadyFinalized"
}

const OPEN_SESSION_STATUSES = ["scheduled", "live", "room_unresolved"] as const

type SessionMode = "online" | "phone" | "in_person"

export function attendanceFallbackDueAt(endsAt: Date): Date {
  return new Date(endsAt.getTime() + JOIN_TRAIL_MS)
}

export function shouldFinalizeAttendanceFallback(
  row: {
    status: string
    attendance: string | null
    endsAt: Date
  },
  now = new Date()
): boolean {
  if (row.attendance != null) return false
  if (
    row.status !== "scheduled" &&
    row.status !== "live" &&
    row.status !== "room_unresolved"
  ) {
    return false
  }
  return now.getTime() >= attendanceFallbackDueAt(row.endsAt).getTime()
}

/**
 * How a session is closed once its join window has passed.
 *
 * - The booking was cancelled: the session did not happen. It is closed as
 *   cancelled, whatever its mode.
 * - Online: attendance is read from who was in the video room.
 * - Phone or in person: nobody is ever in a room, so there is nothing to
 *   read. Recording "nobody came" would be a false no-show against both
 *   people. It is closed as ended, with no attendance, at its booked end.
 */
export function fallbackOutcome(input: {
  sessionMode: SessionMode
  bookingStatus: string
  participants: Parameters<typeof deriveAttendance>[0]
  booked: BookedTime
  /** When the room last emptied, if a webhook already recorded it. */
  endedAt: Date | null
  now: Date
}): {
  status: "ended" | "no_show" | "cancelled"
  attendance: SessionAttendance | null
  endedAt: Date
} {
  if (input.bookingStatus === "cancelled") {
    return {
      status: "cancelled",
      attendance: null,
      endedAt: input.endedAt ?? input.now,
    }
  }
  if (input.sessionMode !== "online") {
    return {
      status: "ended",
      attendance: null,
      // The booked end is the only time there is for these.
      endedAt: input.endedAt ?? input.booked.end,
    }
  }
  const attendance = deriveAttendance(
    input.participants,
    input.booked,
    input.now
  )
  return {
    status: statusAfterAttendance(attendance),
    attendance,
    // When the room last emptied; when this sweep ran if someone is still
    // recorded inside, or nobody ever came.
    endedAt: input.endedAt ?? lastLeftAt(input.participants) ?? input.now,
  }
}

/**
 * The session with its booking's own times and status. The booking is the
 * source of truth for when a session is: a session row is only brought up
 * to date after a reschedule for online sessions (with the room), so its
 * own times can be stale for phone and in-person ones.
 */
function selectSessionWithBooking(tx: Tx) {
  return tx
    .select({
      orgId: main.sessions.orgId,
      status: main.sessions.status,
      attendance: main.sessions.attendance,
      sessionMode: main.sessions.sessionMode,
      endedAt: main.sessions.endedAt,
      participants: main.sessions.participants,
      startsAt: main.bookings.startsAt,
      endsAt: main.bookings.endsAt,
      bookingStatus: main.bookings.status,
    })
    .from(main.sessions)
    .innerJoin(main.bookings, eq(main.bookings.id, main.sessions.bookingId))
}

export async function finalizeAttendanceFromHistory(
  bookingId: string,
  now = new Date()
): Promise<"finalized" | "skipped"> {
  const row = await withPlatformAdminContext(async (tx) => {
    const [found] = await selectSessionWithBooking(tx)
      .where(eq(main.sessions.bookingId, bookingId))
      .limit(1)
    return found ?? null
  })
  if (!row || !shouldFinalizeAttendanceFallback(row, now)) return "skipped"

  try {
    await withAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        const [locked] = await selectSessionWithBooking(tx)
          .where(eq(main.sessions.bookingId, bookingId))
          // Only the session row is being decided; the booking is read.
          .for("update", { of: main.sessions })
          .limit(1)
        if (!locked || !shouldFinalizeAttendanceFallback(locked, now)) {
          throw new AttendanceAlreadyFinalized()
        }
        const { status, attendance, endedAt } = fallbackOutcome({
          sessionMode: locked.sessionMode,
          bookingStatus: locked.bookingStatus,
          participants: locked.participants,
          booked: { start: locked.startsAt, end: locked.endsAt },
          endedAt: locked.endedAt,
          now,
        })
        const updated = await tx
          .update(main.sessions)
          .set({ status, attendance, endedAt })
          .where(
            and(
              eq(main.sessions.bookingId, bookingId),
              inArray(main.sessions.status, [...OPEN_SESSION_STATUSES]),
              isNull(main.sessions.attendance)
            )
          )
          .returning({ id: main.sessions.id })
        if (updated.length === 0) {
          throw new AttendanceAlreadyFinalized()
        }
        await ctx.emit({
          entity: "session",
          action: "ended",
          entityId: bookingId,
          payload: {
            source: "end_at_fallback",
            status,
            final: true,
            // `null` with a mode that is not online: attendance is not
            // known for it, which is different from "nobody came".
            attendance,
            sessionMode: locked.sessionMode,
          },
        })
      }
    )
    return "finalized"
  } catch (err) {
    if (err instanceof AttendanceAlreadyFinalized) return "skipped"
    throw err
  }
}

export async function sweepEndedSessionsWithoutAttendance(now = new Date()) {
  const due = new Date(now.getTime() - JOIN_TRAIL_MS)
  let scanned = 0
  let finalized = 0
  const failed: unknown[] = []
  const attempted: string[] = []
  for (let batch = 0; batch < SWEEP_MAX_BATCHES; batch += 1) {
    const rows = await withPlatformAdminContext(async (tx) => {
      return tx
        .select({ bookingId: main.sessions.bookingId })
        .from(main.sessions)
        .innerJoin(main.bookings, eq(main.bookings.id, main.sessions.bookingId))
        .where(
          and(
            inArray(main.sessions.status, [...OPEN_SESSION_STATUSES]),
            isNull(main.sessions.attendance),
            // The booking's end, not the session row's: a rescheduled
            // phone or in-person session is not closed at its old time.
            lte(main.bookings.endsAt, due),
            attempted.length > 0
              ? notInArray(main.sessions.bookingId, attempted)
              : undefined
          )
        )
        .orderBy(asc(main.bookings.endsAt))
        .limit(SWEEP_BATCH)
    })
    if (rows.length === 0) break
    scanned += rows.length
    for (const row of rows) {
      attempted.push(row.bookingId)
      try {
        const result = await finalizeAttendanceFromHistory(row.bookingId, now)
        if (result === "finalized") finalized += 1
      } catch (err) {
        failed.push(err)
      }
    }
    if (rows.length < SWEEP_BATCH) break
  }
  if (failed.length > 0) {
    throw new AggregateError(
      failed,
      `video attendance sweep failed for ${failed.length} session(s)`
    )
  }
  return { scanned, finalized }
}

/**
 * One-off repair, run by the operator
 * (`pnpm video:correct-nonvideo-attendance`).
 *
 * Before 2026-11-11 the sweep closed every phone and in-person session as
 * `no_show` with attendance `nobody`, because nobody was in a video room.
 * This sets those rows to `ended` with no attendance, each in its own
 * audited transaction: the audit log is append-only, so the earlier wrong
 * event stays and a `session attendance_corrected` event says it was wrong.
 *
 * Only the sweep ever wrote `no_show`, and only online sessions have a room,
 * so every row that matches is one of the false records. Without `apply`
 * it only counts.
 */
export async function correctNonVideoNoShows(options: {
  apply: boolean
  limit?: number
}): Promise<{ found: number; corrected: number }> {
  const rows = await withPlatformAdminContext(async (tx) =>
    tx
      .select({
        bookingId: main.sessions.bookingId,
        orgId: main.sessions.orgId,
        sessionMode: main.sessions.sessionMode,
      })
      .from(main.sessions)
      .where(falseNoShow())
      .orderBy(asc(main.sessions.endsAt))
      .limit(options.limit ?? 500)
  )
  if (!options.apply) return { found: rows.length, corrected: 0 }

  let corrected = 0
  for (const row of rows) {
    await withAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        const updated = await tx
          .update(main.sessions)
          .set({ status: "ended", attendance: null })
          .where(and(eq(main.sessions.bookingId, row.bookingId), falseNoShow()))
          .returning({ id: main.sessions.id })
        // One emit per audited write; it says when nothing changed.
        await ctx.emit({
          entity: "session",
          action: "attendance_corrected",
          entityId: row.bookingId,
          payload: {
            reason: "not_a_video_session",
            sessionMode: row.sessionMode,
            from: { status: "no_show", attendance: "nobody" },
            to: { status: "ended", attendance: null },
            changed: updated.length > 0,
          },
        })
        if (updated.length > 0) corrected += 1
      }
    )
  }
  return { found: rows.length, corrected }
}

function falseNoShow() {
  return and(
    ne(main.sessions.sessionMode, "online"),
    eq(main.sessions.status, "no_show"),
    eq(main.sessions.attendance, "nobody")
  )
}
