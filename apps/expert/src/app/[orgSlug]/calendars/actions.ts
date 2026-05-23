"use server"

import { z } from "zod"
import { requireSession } from "@eleva/auth/server"
import { BusySourcesRequestSchema } from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string }

const IntegrationIdSchema = z.string().min(1)
const ExternalCalendarIdSchema = z.string().min(1)

export async function disconnectCalendarAction(
  integrationId: string
): Promise<ActionResult> {
  let parsedIntegrationId: string
  try {
    parsedIntegrationId = IntegrationIdSchema.parse(integrationId)
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.integrations.disconnect(parsedIntegrationId)

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
  let parsedIntegrationId: string
  try {
    parsedIntegrationId = IntegrationIdSchema.parse(integrationId)
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    await requireSession("events:manage")
    const api = await getAuthedApiClient()
    const result =
      await api.experts.integrations.listCalendars(parsedIntegrationId)

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
  let parsedIntegrationId: string
  let parsedSources: z.infer<typeof BusySourcesRequestSchema>["sources"]
  try {
    parsedIntegrationId = IntegrationIdSchema.parse(integrationId)
    parsedSources = BusySourcesRequestSchema.shape.sources.parse(sources)
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.integrations.setBusySources(parsedIntegrationId, {
      sources: parsedSources,
    })

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
  let parsedIntegrationId: string
  let parsedExternalCalendarId: string
  try {
    parsedIntegrationId = IntegrationIdSchema.parse(integrationId)
    parsedExternalCalendarId =
      ExternalCalendarIdSchema.parse(externalCalendarId)
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.integrations.setDestination(parsedIntegrationId, {
      externalCalendarId: parsedExternalCalendarId,
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
