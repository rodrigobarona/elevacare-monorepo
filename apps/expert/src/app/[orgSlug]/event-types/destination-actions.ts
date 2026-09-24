"use server"

import { z } from "zod"
import { requireSession } from "@eleva/auth/server"
import {
  EventTypeDestinationOverrideSchema,
  type EventTypeDestinationOverride,
} from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

const IdSchema = z.string().uuid()

type ActionResult = { ok: true } | { ok: false; error: string }

export async function setEventTypeDestinationAction(
  eventTypeId: string,
  data: EventTypeDestinationOverride
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    if (!IdSchema.safeParse(eventTypeId).success) {
      return { ok: false, error: "invalid-input" }
    }
    const parsed = EventTypeDestinationOverrideSchema.safeParse(data)
    if (!parsed.success) {
      return { ok: false, error: "invalid-input" }
    }

    const api = await getAuthedApiClient()
    await api.expert.eventTypes.setDestination(eventTypeId, parsed.data)

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true }
  } catch (err) {
    console.error("[setEventTypeDestinationAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "destination-failed", {
        forbidden: "unauthorized-calendar",
        notFound: "not-found",
        validation: "validation",
      }),
    }
  }
}

export async function setEventTypeModeDestinationAction(
  eventTypeId: string,
  modeId: string,
  data: EventTypeDestinationOverride
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    if (
      !IdSchema.safeParse(eventTypeId).success ||
      !IdSchema.safeParse(modeId).success
    ) {
      return { ok: false, error: "invalid-input" }
    }
    const parsed = EventTypeDestinationOverrideSchema.safeParse(data)
    if (!parsed.success) {
      return { ok: false, error: "invalid-input" }
    }

    const api = await getAuthedApiClient()
    await api.expert.eventTypes.setModeDestination(
      eventTypeId,
      modeId,
      parsed.data
    )

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true }
  } catch (err) {
    console.error("[setEventTypeModeDestinationAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "destination-failed", {
        forbidden: "unauthorized-calendar",
        notFound: "not-found",
        validation: "validation",
      }),
    }
  }
}
