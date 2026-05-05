"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import {
  getExpertProfileByUserId,
  listConnectedCalendars,
  replaceBusySources,
  replaceDestinationCalendar,
} from "@eleva/db"
import {
  getAdapter,
  getCalendarToken,
  type CalendarProvider,
} from "@eleva/calendar"

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string }

async function verifyCalendarOwnership(
  orgId: string,
  expertProfileId: string,
  connectedCalendarId: string
): Promise<boolean> {
  const calendars = await listConnectedCalendars(orgId, expertProfileId)
  return calendars.some((c) => c.id === connectedCalendarId)
}

export async function disconnectCalendarAction(
  connectedCalendarId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const owned = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      connectedCalendarId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    const { db } = await import("@eleva/db")
    const { connectedCalendars } = await import("@eleva/db/schema")
    const { eq } = await import("drizzle-orm")
    const mainDb = db()
    await mainDb
      .update(connectedCalendars)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(connectedCalendars.id, connectedCalendarId))

    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "disconnect-failed" }
  }
}

export async function loadSubCalendars(connectedCalendarId: string): Promise<
  | {
      ok: true
      calendars: {
        id: string
        name: string
        primary: boolean
        email?: string
      }[]
    }
  | { ok: false; error: string }
> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const owned = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      connectedCalendarId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    const calendars = await listConnectedCalendars(profile.orgId, profile.id)
    const connCal = calendars.find((c) => c.id === connectedCalendarId)
    if (!connCal) return { ok: false, error: "calendar-not-found" }

    const accessToken = await getCalendarToken(
      session.user.workosUserId,
      connCal.provider
    )
    const adapter = getAdapter(connCal.provider)
    const subCalendars = await adapter.listCalendars(accessToken)

    return {
      ok: true,
      calendars: subCalendars.map((c) => ({
        id: c.id,
        name: c.name,
        primary: c.primary,
        email: c.email,
      })),
    }
  } catch {
    return { ok: false, error: "load-failed" }
  }
}

export async function saveBusySources(
  connectedCalendarId: string,
  sources: { externalCalendarId: string; displayName: string }[]
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const owned = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      connectedCalendarId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    await replaceBusySources(
      profile.orgId,
      connectedCalendarId,
      sources,
      profile.id
    )
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "save-failed" }
  }
}

export async function saveDestinationCalendar(
  connectedCalendarId: string,
  externalCalendarId: string,
  displayName: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const owned = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      connectedCalendarId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    await replaceDestinationCalendar(
      profile.orgId,
      profile.id,
      connectedCalendarId,
      externalCalendarId,
      displayName
    )
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "save-failed" }
  }
}
