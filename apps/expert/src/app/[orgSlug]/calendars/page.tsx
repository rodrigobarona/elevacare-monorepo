import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@eleva/icons"
import { PageHeader } from "@eleva/ui/components/page-header"
import { syncExpertCalendarAccounts } from "@eleva/auth"
import {
  getDestinationCalendar,
  listBusySourcesForExpert,
  listExpertIntegrations,
} from "@eleva/db"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { CalendarManager } from "./calendar-manager"

export const dynamic = "force-dynamic"

const SLUG_LABEL: Record<string, string> = {
  "google-calendar": "Google Calendar",
  "microsoft-calendar": "Microsoft Calendar",
}

export default async function CalendarsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "events:manage"
  )
  const base = expertWorkspaceBase(session)

  await syncExpertCalendarAccounts({
    orgId: profile.orgId,
    expertProfileId: profile.id,
    userId: session.user.id,
    actorUserId: session.user.id,
  })

  const [rawIntegrations, busySources, destination] = await Promise.all([
    listExpertIntegrations(profile.orgId, profile.id, "calendar"),
    listBusySourcesForExpert(profile.orgId, profile.id),
    getDestinationCalendar(profile.orgId, profile.id),
  ])

  const integrations = rawIntegrations
    .filter((i) => i.deletedAt == null && i.status !== "disconnected")
    .map((i) => ({
      id: i.id,
      slug: i.slug,
      providerLabel: SLUG_LABEL[i.slug] ?? i.slug,
      accountIdentifier: i.accountIdentifier,
      status: i.status,
    }))

  const t = await getTranslations("calendars")

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href={`${base}/integrations`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("backToIntegrations")}
      </Link>

      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      <CalendarManager
        integrations={integrations}
        callbackURL={`${base}/calendars`}
        initialBusySources={busySources.map((s) => ({
          expertIntegrationId: s.expertIntegrationId,
          externalCalendarId: s.externalCalendarId,
          displayName: s.displayName,
        }))}
        initialDestination={destination}
      />
    </div>
  )
}
