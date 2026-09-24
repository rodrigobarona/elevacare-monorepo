"use server"

import { z } from "zod"
import { requireSession } from "@eleva/auth/server"
import {
  CreateEventTypeModeRequestSchema,
  PatchEventTypeModeRequestSchema,
  CreateNamedScheduleRequestSchema,
  CreatePracticeLocationRequestSchema,
  type CreateEventTypeModeRequest,
  type PatchEventTypeModeRequest,
} from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { humanApiMessage, mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

const IdSchema = z.string().uuid()

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; message?: string }

export async function createEventTypeModeAction(
  eventTypeId: string,
  data: CreateEventTypeModeRequest
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    if (!IdSchema.safeParse(eventTypeId).success) {
      return { ok: false, error: "invalid-input" }
    }
    const parsed = CreateEventTypeModeRequestSchema.safeParse(data)
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        message: parsed.error.issues[0]?.message,
      }
    }

    const api = await getAuthedApiClient()
    const result = await api.expert.eventTypes.createMode(
      eventTypeId,
      parsed.data
    )
    const mode = result.mode as { id?: string } | undefined

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true, id: mode?.id }
  } catch (err) {
    console.error("[createEventTypeModeAction]", err)
    const error = mapExpertApiError(err, "create-failed", {
      conflict: "mode-taken",
      offerInvariant: "offer-invariant",
      validation: "validation",
    })
    return {
      ok: false,
      error,
      message: error === "offer-invariant" ? humanApiMessage(err) : undefined,
    }
  }
}

export async function patchEventTypeModeAction(
  eventTypeId: string,
  modeId: string,
  data: PatchEventTypeModeRequest
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    if (
      !IdSchema.safeParse(eventTypeId).success ||
      !IdSchema.safeParse(modeId).success
    ) {
      return { ok: false, error: "invalid-input" }
    }
    const parsed = PatchEventTypeModeRequestSchema.safeParse(data)
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        message: parsed.error.issues[0]?.message,
      }
    }

    const api = await getAuthedApiClient()
    await api.expert.eventTypes.patchMode(eventTypeId, modeId, parsed.data)

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true }
  } catch (err) {
    console.error("[patchEventTypeModeAction]", err)
    const error = mapExpertApiError(err, "update-failed", {
      offerInvariant: "offer-invariant",
      validation: "validation",
    })
    return {
      ok: false,
      error,
      message: error === "offer-invariant" ? humanApiMessage(err) : undefined,
    }
  }
}

export async function deactivateEventTypeModeAction(
  eventTypeId: string,
  modeId: string
): Promise<ActionResult> {
  return patchEventTypeModeAction(eventTypeId, modeId, { active: false })
}

type CreateResourceResult =
  | { ok: true; id: string; name: string; country?: string }
  | { ok: false; error: string; message?: string }

export async function createNamedScheduleAction(input: {
  name: string
  timezone: string
}): Promise<CreateResourceResult> {
  try {
    const session = await requireSession("schedule:manage")
    const parsed = CreateNamedScheduleRequestSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        message: parsed.error.issues[0]?.message,
      }
    }

    const api = await getAuthedApiClient()
    const result = await api.expert.schedules.create(parsed.data)
    const schedule = result.schedule as
      | { id?: string; name?: string }
      | undefined
    if (!schedule?.id || !schedule.name) {
      return { ok: false, error: "create-failed" }
    }

    revalidateExpertWorkspace(session, "schedule")
    revalidateExpertWorkspace(session, "event-types")
    return { ok: true, id: schedule.id, name: schedule.name }
  } catch (err) {
    console.error("[createNamedScheduleAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "create-failed", {
        validation: "validation",
      }),
      message: humanApiMessage(err),
    }
  }
}

export async function createInlineLocationAction(input: {
  name: string
  address: string
  city: string
  region?: string
  country: string
  timezone?: string
}): Promise<CreateResourceResult> {
  try {
    const session = await requireSession("schedule:manage")
    const parsed = CreatePracticeLocationRequestSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        message: parsed.error.issues[0]?.message,
      }
    }

    const api = await getAuthedApiClient()
    const result = await api.expert.locations.create(parsed.data)
    const location = result.location as
      | { id?: string; name?: string; country?: string }
      | undefined
    if (!location?.id || !location.name) {
      return { ok: false, error: "create-failed" }
    }

    revalidateExpertWorkspace(session, "event-types")
    return {
      ok: true,
      id: location.id,
      name: location.name,
      country: location.country,
    }
  } catch (err) {
    console.error("[createInlineLocationAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "create-failed", {
        validation: "validation",
      }),
      message: humanApiMessage(err),
    }
  }
}
