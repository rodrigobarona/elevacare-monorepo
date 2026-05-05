import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import {
  getExpertProfileByUserId,
  getOrCreateDefaultSchedule,
  listAvailabilityRules,
  listDateOverrides,
} from "@eleva/db"
import { AppShell } from "@/components/app-shell"
import { ScheduleEditor } from "./schedule-editor"

export const dynamic = "force-dynamic"

export default async function SchedulePage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("events:manage")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/expert/onboarding")

  const h = await headers()
  const geoTz = h.get("x-vercel-ip-timezone")
  const fallbackTz = profile.timezone ?? geoTz ?? "UTC"

  const schedule = await getOrCreateDefaultSchedule(
    profile.orgId,
    profile.id,
    fallbackTz
  )

  const [rules, overrides] = await Promise.all([
    listAvailabilityRules(profile.orgId, schedule.id, profile.id),
    listDateOverrides(profile.orgId, schedule.id, profile.id),
  ])

  const t = await getTranslations("schedule")

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-medium">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </header>

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
    </AppShell>
  )
}
