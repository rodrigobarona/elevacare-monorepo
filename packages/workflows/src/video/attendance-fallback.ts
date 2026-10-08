import { and, asc, eq, inArray, isNull, lte, notInArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { JOIN_TRAIL_MS } from "@eleva/video"
import { deriveAttendance, statusAfterAttendance } from "./attendance"

const SWEEP_BATCH = 25
const SWEEP_MAX_BATCHES = 8

class AttendanceAlreadyFinalized extends Error {
  override readonly name = "AttendanceAlreadyFinalized"
}

const OPEN_SESSION_STATUSES = ["scheduled", "live", "room_unresolved"] as const

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

export async function finalizeAttendanceFromHistory(
  bookingId: string,
  now = new Date()
): Promise<"finalized" | "skipped"> {
  const row = await withPlatformAdminContext(async (tx) => {
    const [found] = await tx
      .select({
        orgId: main.sessions.orgId,
        status: main.sessions.status,
        attendance: main.sessions.attendance,
        endsAt: main.sessions.endsAt,
        endedAt: main.sessions.endedAt,
        participants: main.sessions.participants,
      })
      .from(main.sessions)
      .where(eq(main.sessions.bookingId, bookingId))
      .limit(1)
    return found ?? null
  })
  if (!row || !shouldFinalizeAttendanceFallback(row, now)) return "skipped"

  try {
    await withAudit(
      { orgId: row.orgId, actorUserId: null },
      async (tx, ctx) => {
        const [locked] = await tx
          .select({
            status: main.sessions.status,
            attendance: main.sessions.attendance,
            endsAt: main.sessions.endsAt,
            endedAt: main.sessions.endedAt,
            participants: main.sessions.participants,
          })
          .from(main.sessions)
          .where(eq(main.sessions.bookingId, bookingId))
          .for("update")
          .limit(1)
        if (!locked || !shouldFinalizeAttendanceFallback(locked, now)) {
          throw new AttendanceAlreadyFinalized()
        }
        const attendance = deriveAttendance(locked.participants)
        const status = statusAfterAttendance(attendance)
        const updated = await tx
          .update(main.sessions)
          .set({
            status,
            attendance,
            endedAt: locked.endedAt ?? now,
          })
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
          payload: { source: "end_at_fallback", attendance },
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
        .where(
          and(
            inArray(main.sessions.status, [...OPEN_SESSION_STATUSES]),
            isNull(main.sessions.attendance),
            lte(main.sessions.endsAt, due),
            attempted.length > 0
              ? notInArray(main.sessions.bookingId, attempted)
              : undefined
          )
        )
        .orderBy(asc(main.sessions.endsAt))
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
