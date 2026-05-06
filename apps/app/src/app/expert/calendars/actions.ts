"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import {
  getExpertProfileByUserId,
  listCalendarIntegrations,
  disconnectIntegration,
  replaceBusySources,
  replaceDestinationCalendar,
  type ExpertIntegration,
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
): Promise<ExpertIntegration | null> {
  const integrations = await listCalendarIntegrations(orgId, expertProfileId)
  return integrations.find((i) => i.id === integrationId) ?? null
}

export async function disconnectCalendarAction(
  integrationId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const integration = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      integrationId
    )
    if (!integration) return { ok: false, error: "unauthorized-calendar" }

    await disconnectIntegration(profile.orgId, integrationId)

    revalidatePath("/expert/calendars")
    revalidatePath("/expert/integrations")
    return { ok: true }
  } catch (err) {
    console.error("disconnect-calendar failed", err)
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

    const integration = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      integrationId
    )
    if (!integration) return { ok: false, error: "unauthorized-calendar" }

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
  } catch (err) {
    console.error("load-sub-calendars failed", err)
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

    const integration = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      integrationId
    )
    if (!integration) return { ok: false, error: "unauthorized-calendar" }

    await replaceBusySources(profile.orgId, integrationId, sources, profile.id)
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch (err) {
    console.error("save-busy-sources failed", err)
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

    const integration = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      integrationId
    )
    if (!integration) return { ok: false, error: "unauthorized-calendar" }

    await replaceDestinationCalendar(
      profile.orgId,
      profile.id,
      integrationId,
      externalCalendarId,
      displayName
    )
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch (err) {
    console.error("save-destination-calendar failed", err)
    return { ok: false, error: "save-failed" }
  }
}
