"use server"

import { z } from "zod"
import { requireSession } from "@eleva/auth/server"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

type ActionResult = { ok: true } | { ok: false; error: string }

const VALID_TZ_SET = new Set(Intl.supportedValuesOf("timeZone"))
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"))
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const OverrideIdSchema = z.string().uuid()

export async function initializeScheduleAction(
  timezone: string
): Promise<ActionResult> {
  if (!VALID_TZ_SET.has(timezone)) {
    return { ok: false, error: "invalid-timezone" }
  }

  try {
    const session = await requireSession("schedule:manage")
    const api = await getAuthedApiClient()
    await api.experts.schedule.save({ timezone, rules: [] })
    revalidateExpertWorkspace(session, "schedule")
    return { ok: true }
  } catch (err) {
    console.error("[initializeScheduleAction]", err)
    return { ok: false, error: mapExpertApiError(err, "init-failed") }
  }
}

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

    const session = await requireSession("schedule:manage")
    const api = await getAuthedApiClient()
    await api.experts.schedule.save(parsed.data)

    revalidateExpertWorkspace(session, "schedule")
    return { ok: true }
  } catch (err) {
    console.error("[saveScheduleAction]", err)
    return { ok: false, error: mapExpertApiError(err, "save-failed") }
  }
}

export async function addDateOverrideAction(
  data: DateOverrideInput
): Promise<ActionResult> {
  try {
    const parsed = dateOverrideSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: "validation" }

    const session = await requireSession("schedule:manage")
    const api = await getAuthedApiClient()
    await api.experts.schedule.addOverride({
      overrideDate: parsed.data.overrideDate,
      isBlocked: parsed.data.isBlocked,
      timezone: parsed.data.timezone,
      ...(parsed.data.isBlocked
        ? {}
        : {
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
          }),
    })

    revalidateExpertWorkspace(session, "schedule")
    return { ok: true }
  } catch (err) {
    console.error("[addDateOverrideAction]", err)
    return { ok: false, error: mapExpertApiError(err, "save-failed") }
  }
}

export async function removeDateOverrideAction(
  overrideId: string
): Promise<ActionResult> {
  const parsed = OverrideIdSchema.safeParse(overrideId)
  if (!parsed.success) return { ok: false, error: "validation" }

  try {
    const session = await requireSession("schedule:manage")
    const api = await getAuthedApiClient()
    await api.experts.schedule.removeOverride(parsed.data)

    revalidateExpertWorkspace(session, "schedule")
    return { ok: true }
  } catch (err) {
    console.error("[removeDateOverrideAction]", err)
    return { ok: false, error: mapExpertApiError(err, "delete-failed") }
  }
}
