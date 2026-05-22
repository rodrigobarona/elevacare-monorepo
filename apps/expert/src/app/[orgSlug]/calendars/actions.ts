"use server"

import { requireSession } from "@eleva/auth/server"
import {
  getExpertProfileForOrg,
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
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

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
    const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
    if (!profile) return { ok: false, error: "no-profile" }

    const integration = await verifyCalendarOwnership(
      profile.orgId,
      profile.id,
      integrationId
    )
    if (!integration) return { ok: false, error: "unauthorized-calendar" }

    await disconnectIntegration(profile.orgId, integrationId, profile.id)

    revalidateExpertWorkspace(session, "calendars")
    revalidateExpertWorkspace(session, "integrations")
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
    const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
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
    const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
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
    const providerCalendars = await adapter.listCalendars(accessToken)
    const allowedIds = new Set(providerCalendars.map((c) => c.id))

    if (sources.some((s) => !allowedIds.has(s.externalCalendarId))) {
      return { ok: false, error: "unauthorized-calendar" }
    }

    const enriched = sources.map((s) => ({
      externalCalendarId: s.externalCalendarId,
      displayName:
        providerCalendars.find((c) => c.id === s.externalCalendarId)?.name ??
        s.displayName,
    }))

    await replaceBusySources(profile.orgId, integrationId, enriched, profile.id)
    revalidateExpertWorkspace(session, "calendars")
    return { ok: true }
  } catch (err) {
    console.error("save-busy-sources failed", err)
    return { ok: false, error: "save-failed" }
  }
}

export async function saveDestinationCalendar(
  integrationId: string,
  externalCalendarId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
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
    const calendars = await adapter.listCalendars(accessToken)

    const matched = calendars.find((c) => c.id === externalCalendarId)
    if (!matched) return { ok: false, error: "unauthorized-calendar" }

    await replaceDestinationCalendar(
      profile.orgId,
      profile.id,
      integrationId,
      externalCalendarId,
      matched.name
    )
    revalidateExpertWorkspace(session, "calendars")
    return { ok: true }
  } catch (err) {
    console.error("save-destination-calendar failed", err)
    return { ok: false, error: "save-failed" }
  }
}
