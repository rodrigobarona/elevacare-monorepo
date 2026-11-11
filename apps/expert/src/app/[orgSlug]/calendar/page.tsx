import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getActiveCalendarFeedToken } from "@eleva/db"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { IcsFeedCard } from "./ics-feed-card"
import { WeekView } from "./week-view"

export const dynamic = "force-dynamic"

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { profile } = await loadExpertWorkspace(orgSlug, "events:manage")

  const [feedToken, t] = await Promise.all([
    getActiveCalendarFeedToken(profile.orgId, profile.id),
    getTranslations("calendar"),
  ])

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        {/* The week is loaded in the browser, in the expert's time zone. */}
        <WeekView orgSlug={orgSlug} />

        <aside className="space-y-4">
          <IcsFeedCard
            hasToken={feedToken != null}
            createdAt={feedToken?.createdAt.toISOString() ?? null}
          />
          <p className="px-1 text-sm text-muted-foreground">
            {t("emptyState")}
          </p>
        </aside>
      </div>
    </div>
  )
}
