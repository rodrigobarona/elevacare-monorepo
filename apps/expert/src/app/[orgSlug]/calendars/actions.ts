"use server"

import { requireSession } from "@eleva/auth/server"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string }

export async function disconnectCalendarAction(
  integrationId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.integrations.disconnect(integrationId)

    revalidateExpertWorkspace(session, "calendars")
    revalidateExpertWorkspace(session, "integrations")
    return { ok: true }
  } catch (err) {
    console.error("disconnect-calendar failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "disconnect-failed", {
        notFound: "unauthorized-calendar",
        forbidden: "unauthorized-calendar",
      }),
    }
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
    await requireSession("events:manage")
    const api = await getAuthedApiClient()
    const result = await api.experts.integrations.listCalendars(integrationId)

    return { ok: true, calendars: result.calendars }
  } catch (err) {
    console.error("load-sub-calendars failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "load-failed", {
        notFound: "unauthorized-calendar",
        forbidden: "unauthorized-calendar",
      }),
    }
  }
}

export async function saveBusySources(
  integrationId: string,
  sources: { externalCalendarId: string; displayName: string }[]
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.integrations.setBusySources(integrationId, { sources })

    revalidateExpertWorkspace(session, "calendars")
    return { ok: true }
  } catch (err) {
    console.error("save-busy-sources failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "save-failed", {
        notFound: "unauthorized-calendar",
        forbidden: "unauthorized-calendar",
      }),
    }
  }
}

export async function saveDestinationCalendar(
  integrationId: string,
  externalCalendarId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.integrations.setDestination(integrationId, {
      externalCalendarId,
    })

    revalidateExpertWorkspace(session, "calendars")
    return { ok: true }
  } catch (err) {
    console.error("save-destination-calendar failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "save-failed", {
        notFound: "unauthorized-calendar",
        forbidden: "unauthorized-calendar",
      }),
    }
  }
}
