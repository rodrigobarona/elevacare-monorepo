import { main, type Tx } from "@eleva/db"

export async function ensureSessionRow(
  tx: Tx,
  booking: {
    id: string
    orgId: string
    eventTypeId: string
    expertProfileId: string
    memberUserId: string | null
    startsAt: Date
    endsAt: Date
    sessionMode: "online" | "in_person" | "phone"
  }
): Promise<{ created: boolean }> {
  if (!booking.memberUserId) {
    return { created: false }
  }

  const inserted = await tx
    .insert(main.sessions)
    .values({
      orgId: booking.orgId,
      bookingId: booking.id,
      eventTypeId: booking.eventTypeId,
      expertProfileId: booking.expertProfileId,
      memberUserId: booking.memberUserId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      sessionMode: booking.sessionMode,
      status: "scheduled",
    })
    .onConflictDoNothing({ target: main.sessions.bookingId })
    .returning({ id: main.sessions.id })

  return { created: inserted.length > 0 }
}
