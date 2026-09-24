import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { getActiveCalendarFeedToken, listExpertBookings } from "@eleva/db"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { IcsFeedCard } from "./ics-feed-card"
import { WeekView } from "./week-view"

export const dynamic = "force-dynamic"

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { profile } = await loadExpertWorkspace(orgSlug, "events:manage")

  const weekStart = startOfWeek(new Date())
  const weekEnd = addDays(weekStart, 7)
  const fromIso = weekStart.toISOString()
  const toIso = weekEnd.toISOString()

  const [bookings, feedToken, t] = await Promise.all([
    listExpertBookings(profile.orgId, profile.id, weekStart, weekEnd),
    getActiveCalendarFeedToken(profile.orgId, profile.id),
    getTranslations("calendar"),
  ])

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <AccountPageHeader title={t("title")} description={t("description")} />
        <WeekView
          initialFrom={fromIso}
          initialTo={toIso}
          initialBookings={bookings.map((b) => ({
            id: b.id,
            status: b.status,
            startsAt: b.startsAt.toISOString(),
            endsAt: b.endsAt.toISOString(),
            timezone: b.timezone,
            sessionMode: b.sessionMode,
            memberFirstName: b.memberFirstName,
            eventTypeTitle: b.eventTypeTitle,
            eventTypeSlug: b.eventTypeSlug,
            modeLabel: b.modeLabel,
            locationName: b.locationName,
            locationCity: b.locationCity,
            locationCountry: b.locationCountry,
            locationAddress: b.locationAddress,
          }))}
        />
      </div>

      <aside className="space-y-4 lg:pt-16">
        <IcsFeedCard
          hasToken={feedToken != null}
          createdAt={feedToken?.createdAt.toISOString() ?? null}
        />
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      </aside>
    </div>
  )
}
