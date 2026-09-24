import Link from "next/link"
import { getTranslations, getLocale } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { listEventTypeModes, listExpertEventTypes } from "@eleva/db"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { EventTypeActions } from "./event-type-actions"

export const dynamic = "force-dynamic"

type LocalizedText = { en: string; pt?: string; es?: string }

export default async function EventTypesPage({
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

  const eventTypes = await listExpertEventTypes(profile.orgId, profile.id)
  const modeCounts = await Promise.all(
    eventTypes.map(async (et) => {
      const modes = await listEventTypeModes(profile.orgId, et.id)
      return [et.id, modes.length] as const
    })
  )
  const modeCountById = new Map(modeCounts)

  const t = await getTranslations("eventTypes")
  const locale = await getLocale()

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href={`${base}/event-types/new`}>
            <Button>{t("create")}</Button>
          </Link>
        }
      />

      {eventTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("empty")}</p>
            <Link
              href={`${base}/event-types/new`}
              className="mt-4 inline-block"
            >
              <Button variant="outline">{t("createFirst")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {eventTypes.map((et) => {
            const etTitle = et.title as LocalizedText
            const modeCount = modeCountById.get(et.id) ?? 0
            return (
              <Card key={et.id} data-testid={`event-type-card-${et.slug}`}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      <Link
                        href={`${base}/event-types/${et.id}`}
                        className="hover:underline"
                      >
                        {etTitle[locale as keyof typeof etTitle] ?? etTitle.en}
                      </Link>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      /{profile.username}/{et.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {et.published ? (
                      <Badge>{t("status.published")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("status.draft")}</Badge>
                    )}
                    <EventTypeActions
                      eventTypeId={et.id}
                      published={et.published}
                      workspaceBase={base}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>{et.durationMinutes} min</span>
                    <span>
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency: et.currency.toUpperCase(),
                      }).format(et.priceAmount / 100)}
                    </span>
                    <span data-testid={`mode-count-${et.slug}`}>
                      {t("modes.count", { count: modeCount })}
                    </span>
                    <span>
                      {(et.languages as string[]).join(", ").toUpperCase()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
