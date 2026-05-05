"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import {
  getExpertProfileByUserId,
  getOrCreateDefaultSchedule,
  updateScheduleTimezone,
  replaceAvailabilityRules,
  upsertDateOverride,
  deleteDateOverride,
} from "@eleva/db"

type ActionResult = { ok: true } | { ok: false; error: string }

export interface AvailabilityRuleInput {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface DateOverrideInput {
  overrideDate: string
  startTime?: string
  endTime?: string
  isBlocked: boolean
  timezone: string
}

export async function saveScheduleAction(params: {
  timezone: string
  rules: AvailabilityRuleInput[]
}): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const schedule = await getOrCreateDefaultSchedule(
      profile.orgId,
      profile.id,
      params.timezone
    )

    await updateScheduleTimezone(profile.orgId, schedule.id, params.timezone)
    await replaceAvailabilityRules(
      profile.orgId,
      schedule.id,
      params.rules.map((r) => ({
        scheduleId: schedule.id,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      }))
    )

    revalidatePath("/expert/schedule")
    return { ok: true }
  } catch (err) {
    console.error("[saveScheduleAction]", err)
    return { ok: false, error: "save-failed" }
  }
}

export async function addDateOverrideAction(
  data: DateOverrideInput
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const schedule = await getOrCreateDefaultSchedule(
      profile.orgId,
      profile.id,
      data.timezone
    )

    await upsertDateOverride(profile.orgId, schedule.id, {
      scheduleId: schedule.id,
      overrideDate: data.overrideDate,
      startTime: data.isBlocked ? null : (data.startTime ?? null),
      endTime: data.isBlocked ? null : (data.endTime ?? null),
      isBlocked: data.isBlocked,
    })

    revalidatePath("/expert/schedule")
    return { ok: true }
  } catch (err) {
    console.error("[addDateOverrideAction]", err)
    return { ok: false, error: "save-failed" }
  }
}

export async function removeDateOverrideAction(
  overrideId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    await deleteDateOverride(profile.orgId, overrideId)
    revalidatePath("/expert/schedule")
    return { ok: true }
  } catch (err) {
    console.error("[removeDateOverrideAction]", err)
    return { ok: false, error: "delete-failed" }
  }
}
