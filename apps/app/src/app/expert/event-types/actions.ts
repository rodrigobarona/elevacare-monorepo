"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import {
  getExpertProfileByUserId,
  createEventType,
  updateEventType,
  deleteEventType,
  type LocalizedText,
} from "@eleva/db"

type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

export interface EventTypeFormData {
  slug: string
  title: LocalizedText
  description?: LocalizedText
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

export async function createEventTypeAction(
  data: EventTypeFormData
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const slug = normalizeSlug(data.slug || data.title.en)
    if (slug.length < 3) return { ok: false, error: "slug-too-short" }

    const row = await createEventType(profile.orgId, {
      expertProfileId: profile.id,
      orgId: profile.orgId,
      slug,
      title: data.title,
      description: data.description ?? null,
      durationMinutes: data.durationMinutes,
      priceAmount: data.priceAmount,
      currency: data.currency,
      languages: data.languages.length > 0 ? data.languages : ["en"],
      sessionMode: data.sessionMode,
      bookingWindowDays: data.bookingWindowDays ?? null,
      minimumNoticeMinutes: data.minimumNoticeMinutes,
      bufferBeforeMinutes: data.bufferBeforeMinutes,
      bufferAfterMinutes: data.bufferAfterMinutes,
      cancellationWindowHours: data.cancellationWindowHours ?? null,
      rescheduleWindowHours: data.rescheduleWindowHours ?? null,
      requiresApproval: data.requiresApproval,
      worldwideMode: data.worldwideMode,
    })

    revalidatePath("/expert/event-types")
    return { ok: true, id: row.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "create-failed"
    if (msg.includes("event_types_expert_slug_idx")) {
      return { ok: false, error: "slug-taken" }
    }
    return { ok: false, error: "create-failed" }
  }
}

export async function updateEventTypeAction(
  eventTypeId: string,
  data: Partial<EventTypeFormData>
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const updates: Record<string, unknown> = {}
    if (data.slug !== undefined) {
      const slug = normalizeSlug(data.slug)
      if (slug.length < 3) return { ok: false, error: "slug-too-short" }
      updates.slug = slug
    }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.durationMinutes !== undefined)
      updates.durationMinutes = data.durationMinutes
    if (data.priceAmount !== undefined) updates.priceAmount = data.priceAmount
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.languages !== undefined) updates.languages = data.languages
    if (data.sessionMode !== undefined) updates.sessionMode = data.sessionMode
    if (data.bookingWindowDays !== undefined)
      updates.bookingWindowDays = data.bookingWindowDays
    if (data.minimumNoticeMinutes !== undefined)
      updates.minimumNoticeMinutes = data.minimumNoticeMinutes
    if (data.bufferBeforeMinutes !== undefined)
      updates.bufferBeforeMinutes = data.bufferBeforeMinutes
    if (data.bufferAfterMinutes !== undefined)
      updates.bufferAfterMinutes = data.bufferAfterMinutes
    if (data.cancellationWindowHours !== undefined)
      updates.cancellationWindowHours = data.cancellationWindowHours
    if (data.rescheduleWindowHours !== undefined)
      updates.rescheduleWindowHours = data.rescheduleWindowHours
    if (data.requiresApproval !== undefined)
      updates.requiresApproval = data.requiresApproval
    if (data.worldwideMode !== undefined)
      updates.worldwideMode = data.worldwideMode

    await updateEventType(
      profile.orgId,
      eventTypeId,
      updates as Parameters<typeof updateEventType>[2]
    )

    revalidatePath("/expert/event-types")
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "update-failed"
    if (msg.includes("event_types_expert_slug_idx")) {
      return { ok: false, error: "slug-taken" }
    }
    return { ok: false, error: "update-failed" }
  }
}

export async function togglePublishAction(
  eventTypeId: string,
  published: boolean
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    await updateEventType(profile.orgId, eventTypeId, { published })
    revalidatePath("/expert/event-types")
    return { ok: true }
  } catch {
    return { ok: false, error: "toggle-failed" }
  }
}

export async function deleteEventTypeAction(
  eventTypeId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    await deleteEventType(profile.orgId, eventTypeId)
    revalidatePath("/expert/event-types")
    return { ok: true }
  } catch {
    return { ok: false, error: "delete-failed" }
  }
}
