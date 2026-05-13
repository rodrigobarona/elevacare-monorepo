"use server"

import { z } from "zod"
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

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"))

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const saveScheduleSchema = z.object({
  timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), {
    message: "Invalid IANA timezone",
  }),
  rules: z.array(
    z
      .object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(timePattern, "Expected HH:MM"),
        endTime: z.string().regex(timePattern, "Expected HH:MM"),
      })
      .refine((r) => r.startTime < r.endTime, {
        message: "startTime must be before endTime",
      })
  ),
})

const dateOverrideSchema = z
  .object({
    overrideDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    startTime: z.string().regex(timePattern).optional(),
    endTime: z.string().regex(timePattern).optional(),
    isBlocked: z.boolean(),
    timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), {
      message: "Invalid IANA timezone",
    }),
  })
  .refine(
    (d) =>
      d.isBlocked ||
      (d.startTime !== undefined &&
        d.endTime !== undefined &&
        d.startTime < d.endTime),
    { message: "Non-blocked overrides require ordered start/end times" }
  )

export async function saveScheduleAction(params: {
  timezone: string
  rules: AvailabilityRuleInput[]
}): Promise<ActionResult> {
  try {
    const parsed = saveScheduleSchema.safeParse(params)
    if (!parsed.success) return { ok: false, error: "validation" }

    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const schedule = await getOrCreateDefaultSchedule(
      profile.orgId,
      profile.id,
      parsed.data.timezone
    )

    await updateScheduleTimezone(
      profile.orgId,
      schedule.id,
      profile.id,
      parsed.data.timezone
    )
    await replaceAvailabilityRules(
      profile.orgId,
      schedule.id,
      profile.id,
      parsed.data.rules.map((r) => ({
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
    const parsed = dateOverrideSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: "validation" }

    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const schedule = await getOrCreateDefaultSchedule(
      profile.orgId,
      profile.id,
      parsed.data.timezone
    )

    if (schedule.timezone !== parsed.data.timezone) {
      await updateScheduleTimezone(
        profile.orgId,
        schedule.id,
        profile.id,
        parsed.data.timezone
      )
    }

    await upsertDateOverride(profile.orgId, schedule.id, profile.id, {
      scheduleId: schedule.id,
      overrideDate: parsed.data.overrideDate,
      startTime: parsed.data.isBlocked ? null : (parsed.data.startTime ?? null),
      endTime: parsed.data.isBlocked ? null : (parsed.data.endTime ?? null),
      isBlocked: parsed.data.isBlocked,
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

    await deleteDateOverride(profile.orgId, overrideId, profile.id)
    revalidatePath("/expert/schedule")
    return { ok: true }
  } catch (err) {
    console.error("[removeDateOverrideAction]", err)
    return { ok: false, error: "delete-failed" }
  }
}
