"use server"

import { requireSession } from "@eleva/auth/server"
import {
  CreateEventTypeModeRequestSchema,
  PatchEventTypeModeRequestSchema,
  type CreateEventTypeModeRequest,
  type PatchEventTypeModeRequest,
} from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { humanApiMessage, mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; message?: string }

export async function createEventTypeModeAction(
  eventTypeId: string,
  data: CreateEventTypeModeRequest
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
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
