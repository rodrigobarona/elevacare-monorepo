import { and, eq, inArray, isNull, lte } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withPlatformAdminContext } from "@eleva/db"
import { JOIN_TRAIL_MS } from "@eleva/video"
import { deriveAttendance, statusAfterAttendance } from "./attendance"

const SWEEP_BATCH = 25

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

  let outcome: "finalized" | "skipped" = "skipped"
  await withAudit({ orgId: row.orgId, actorUserId: null }, async (tx, ctx) => {
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
      await ctx.emit({
        entity: "session",
        action: "ended",
        entityId: bookingId,
        payload: { skipped: true, source: "end_at_fallback" },
      })
      return
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
      await ctx.emit({
        entity: "session",
        action: "ended",
        entityId: bookingId,
        payload: { skipped: true, source: "end_at_fallback" },
      })
      return
    }
    outcome = "finalized"
    await ctx.emit({
      entity: "session",
      action: "ended",
      entityId: bookingId,
      payload: { source: "end_at_fallback", attendance },
    })
  })
  return outcome
}

export async function sweepEndedSessionsWithoutAttendance(now = new Date()) {
  const due = new Date(now.getTime() - JOIN_TRAIL_MS)
  const rows = await withPlatformAdminContext(async (tx) => {
    return tx
      .select({ bookingId: main.sessions.bookingId })
      .from(main.sessions)
      .where(
        and(
          inArray(main.sessions.status, [...OPEN_SESSION_STATUSES]),
          isNull(main.sessions.attendance),
          lte(main.sessions.endsAt, due)
        )
      )
      .limit(SWEEP_BATCH)
  })
  let finalized = 0
  for (const row of rows) {
    const result = await finalizeAttendanceFromHistory(row.bookingId, now)
    if (result === "finalized") finalized += 1
  }
  return { scanned: rows.length, finalized }
}
