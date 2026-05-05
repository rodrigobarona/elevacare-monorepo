import { and, eq } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  connectedCalendars,
  calendarBusySources,
  calendarDestinations,
  type ConnectedCalendar,
} from "../schema/main/index"

export async function listConnectedCalendars(
  orgId: string,
  expertProfileId: string
): Promise<ConnectedCalendar[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(connectedCalendars)
      .where(eq(connectedCalendars.expertProfileId, expertProfileId))
  })
}

export async function replaceBusySources(
  orgId: string,
  connectedCalendarId: string,
  sources: { externalCalendarId: string; displayName: string }[],
  expertProfileId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    const [owner] = await tx
      .select({ id: connectedCalendars.id })
      .from(connectedCalendars)
      .where(
        and(
          eq(connectedCalendars.id, connectedCalendarId),
          eq(connectedCalendars.expertProfileId, expertProfileId)
        )
      )
      .limit(1)

    if (!owner) throw new Error("unauthorized-calendar")

    await tx
      .delete(calendarBusySources)
      .where(eq(calendarBusySources.connectedCalendarId, connectedCalendarId))

    if (sources.length > 0) {
      await tx.insert(calendarBusySources).values(
        sources.map((s) => ({
          orgId,
          connectedCalendarId,
          externalCalendarId: s.externalCalendarId,
          displayName: s.displayName,
        }))
      )
    }
  })
}

export async function replaceDestinationCalendar(
  orgId: string,
  expertProfileId: string,
  connectedCalendarId: string,
  externalCalendarId: string,
  displayName: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    const [owner] = await tx
      .select({ id: connectedCalendars.id })
      .from(connectedCalendars)
      .where(
        and(
          eq(connectedCalendars.id, connectedCalendarId),
          eq(connectedCalendars.expertProfileId, expertProfileId)
        )
      )
      .limit(1)

    if (!owner) throw new Error("unauthorized-calendar")

    await tx
      .delete(calendarDestinations)
      .where(eq(calendarDestinations.expertProfileId, expertProfileId))

    await tx.insert(calendarDestinations).values({
      orgId,
      expertProfileId,
      connectedCalendarId,
      externalCalendarId,
      displayName,
    })
  })
}
