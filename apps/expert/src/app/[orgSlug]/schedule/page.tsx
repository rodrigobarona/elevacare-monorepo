import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import {
  getDefaultSchedule,
  listAvailabilityRules,
  listDateOverrides,
} from "@eleva/db"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { ScheduleEditor } from "./schedule-editor"
import { InitScheduleButton } from "./init-schedule-button"
import { headers } from "next/headers"

export const dynamic = "force-dynamic"

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { profile } = await loadExpertWorkspace(orgSlug, "schedule:manage")

  const schedule = await getDefaultSchedule(profile.orgId, profile.id)

  const t = await getTranslations("schedule")

  if (!schedule) {
    const h = await headers()
    const geoTz = h.get("x-vercel-ip-timezone")
    const validTimezones = new Set(Intl.supportedValuesOf("timeZone"))
    const validatedGeoTz =
      geoTz && validTimezones.has(geoTz) ? geoTz : undefined
    const fallbackTz = profile.timezone ?? validatedGeoTz ?? "UTC"

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <AccountPageHeader title={t("title")} description={t("description")} />
        <InitScheduleButton timezone={fallbackTz} />
      </div>
    )
  }

  const [rules, overrides] = await Promise.all([
    listAvailabilityRules(profile.orgId, schedule.id, profile.id),
    listDateOverrides(profile.orgId, schedule.id, profile.id),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AccountPageHeader title={t("title")} description={t("description")} />
      <ScheduleEditor
        timezone={schedule.timezone}
        initialRules={rules.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
        }))}
        initialOverrides={overrides.map((o) => ({
          id: o.id,
          overrideDate: o.overrideDate,
          startTime: o.startTime,
          endTime: o.endTime,
          isBlocked: o.isBlocked,
        }))}
      />
    </div>
  )
}
