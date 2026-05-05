"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import {
  getExpertProfileByUserId,
  listCalendarIntegrations,
  replaceBusySources,
  replaceDestinationCalendar,
} from "@eleva/db"
import {
  getAdapter,
  getCalendarToken,
  type CalendarProvider,
} from "@eleva/calendar"

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string }

const SLUG_TO_PROVIDER: Record<string, CalendarProvider> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

async function verifyCalendarOwnership(
  orgId: string,
  expertProfileId: string,
  integrationId: string
): Promise<boolean> {
  const integrations = await listCalendarIntegrations(orgId, expertProfileId)
  return integrations.some((i) => i.id === integrationId)
}

export async function disconnectCalendarAction(
  integrationId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const owned = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      integrationId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    const { db } = await import("@eleva/db")
    const { expertIntegrations } = await import("@eleva/db/schema")
    const { eq } = await import("drizzle-orm")
    const mainDb = db()
    await mainDb
      .update(expertIntegrations)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(expertIntegrations.id, integrationId))

    revalidatePath("/expert/calendars")
    revalidatePath("/expert/integrations")
    return { ok: true }
  } catch {
    return { ok: false, error: "disconnect-failed" }
  }
}

export async function loadSubCalendars(integrationId: string): Promise<
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
      integrationId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    const integrations = await listCalendarIntegrations(
      profile.orgId,
      profile.id
    )
    const integration = integrations.find((i) => i.id === integrationId)
    if (!integration) return { ok: false, error: "calendar-not-found" }

    const provider = SLUG_TO_PROVIDER[integration.slug]
    if (!provider) return { ok: false, error: "unknown-provider" }

    const accessToken = await getCalendarToken(
      session.user.workosUserId,
      provider
    )
    const adapter = getAdapter(provider)
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
  integrationId: string,
  sources: { externalCalendarId: string; displayName: string }[]
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const owned = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      integrationId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    await replaceBusySources(profile.orgId, integrationId, sources, profile.id)
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "save-failed" }
  }
}

export async function saveDestinationCalendar(
  integrationId: string,
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
      integrationId
    )
    if (!owned) return { ok: false, error: "unauthorized-calendar" }

    await replaceDestinationCalendar(
      profile.orgId,
      profile.id,
      integrationId,
      externalCalendarId,
      displayName
    )
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "save-failed" }
  }
}
