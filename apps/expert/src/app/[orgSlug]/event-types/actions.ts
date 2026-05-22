"use server"

import { requireSession } from "@eleva/auth/server"
import {
  CreateEventTypeRequestSchema,
  UpdateEventTypeRequestSchema,
  type CreateEventTypeRequest,
  type UpdateEventTypeRequest,
} from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; details?: unknown }

export interface EventTypeFormData {
  slug: string
  title: CreateEventTypeRequest["title"]
  description?: CreateEventTypeRequest["description"]
  durationMinutes: number
  priceAmount: number
  currency: string
  languages: string[]
  sessionMode: "online" | "in_person" | "phone"
  bookingWindowDays?: number | null
  minimumNoticeMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  cancellationWindowHours?: number | null
  rescheduleWindowHours?: number | null
  requiresApproval: boolean
  worldwideMode: boolean
}

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
}

function toCreatePayload(data: EventTypeFormData): CreateEventTypeRequest {
  const slug = normalizeSlug(data.slug || data.title.en)
  return {
    slug,
    title: data.title,
    description: data.description ?? null,
    durationMinutes: data.durationMinutes,
    priceAmount: data.priceAmount,
    currency: data.currency,
    languages: data.languages,
    sessionMode: data.sessionMode,
    bookingWindowDays: data.bookingWindowDays ?? null,
    minimumNoticeMinutes: data.minimumNoticeMinutes,
    bufferBeforeMinutes: data.bufferBeforeMinutes,
    bufferAfterMinutes: data.bufferAfterMinutes,
    cancellationWindowHours: data.cancellationWindowHours ?? null,
    rescheduleWindowHours: data.rescheduleWindowHours ?? null,
    requiresApproval: data.requiresApproval,
    worldwideMode: data.worldwideMode,
  }
}

export async function createEventTypeAction(
  data: EventTypeFormData
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const payload = toCreatePayload(data)
    if ((payload.slug ?? "").length < 3) {
      return { ok: false, error: "slug-too-short" }
    }

    const parsed = CreateEventTypeRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        details: parsed.error.issues,
      }
    }

    const api = await getAuthedApiClient()
    const result = await api.experts.eventTypes.create(parsed.data)

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true, id: result.id }
  } catch (err) {
    console.error("[createEventTypeAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "create-failed", {
        conflict: "slug-taken",
      }),
    }
  }
}

export async function updateEventTypeAction(
  eventTypeId: string,
  data: Partial<EventTypeFormData>
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const updates: UpdateEventTypeRequest = {}

    if (data.slug !== undefined) {
      const slug = normalizeSlug(data.slug)
      if (slug.length < 3) return { ok: false, error: "slug-too-short" }
      updates.slug = slug
    }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.durationMinutes !== undefined) {
      updates.durationMinutes = data.durationMinutes
    }
    if (data.priceAmount !== undefined) updates.priceAmount = data.priceAmount
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.languages !== undefined) updates.languages = data.languages
    if (data.sessionMode !== undefined) updates.sessionMode = data.sessionMode
    if (data.bookingWindowDays !== undefined) {
      updates.bookingWindowDays = data.bookingWindowDays
    }
    if (data.minimumNoticeMinutes !== undefined) {
      updates.minimumNoticeMinutes = data.minimumNoticeMinutes
    }
    if (data.bufferBeforeMinutes !== undefined) {
      updates.bufferBeforeMinutes = data.bufferBeforeMinutes
    }
    if (data.bufferAfterMinutes !== undefined) {
      updates.bufferAfterMinutes = data.bufferAfterMinutes
    }
    if (data.cancellationWindowHours !== undefined) {
      updates.cancellationWindowHours = data.cancellationWindowHours
    }
    if (data.rescheduleWindowHours !== undefined) {
      updates.rescheduleWindowHours = data.rescheduleWindowHours
    }
    if (data.requiresApproval !== undefined) {
      updates.requiresApproval = data.requiresApproval
    }
    if (data.worldwideMode !== undefined) {
      updates.worldwideMode = data.worldwideMode
    }

    const parsed = UpdateEventTypeRequestSchema.safeParse(updates)
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        details: parsed.error.issues,
      }
    }

    const api = await getAuthedApiClient()
    await api.experts.eventTypes.update(eventTypeId, parsed.data)

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true }
  } catch (err) {
    console.error("[updateEventTypeAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "update-failed", {
        conflict: "slug-taken",
      }),
    }
  }
}

export async function togglePublishAction(
  eventTypeId: string,
  published: boolean
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.eventTypes.publish(eventTypeId, { published })

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true }
  } catch (err) {
    console.error("[togglePublishAction]", err)
    return { ok: false, error: mapExpertApiError(err, "toggle-failed") }
  }
}

export async function deleteEventTypeAction(
  eventTypeId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.experts.eventTypes.remove(eventTypeId)

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true }
  } catch (err) {
    console.error("[deleteEventTypeAction]", err)
    return { ok: false, error: mapExpertApiError(err, "delete-failed") }
  }
}
