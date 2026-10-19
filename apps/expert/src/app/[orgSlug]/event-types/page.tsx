import Link from "next/link"
import { getTranslations, getLocale } from "next-intl/server"
import { ListChecksIcon, PlusIcon } from "@eleva/icons"
import { PageHeader } from "@eleva/ui/components/page-header"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { listEventTypeModes, listExpertEventTypes } from "@eleva/db"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
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

  const [eventTypes, t, locale] = await Promise.all([
    listExpertEventTypes(profile.orgId, profile.id),
    getTranslations("eventTypes"),
    getLocale(),
  ])
  const modeCounts = await Promise.all(
    eventTypes.map(async (et) => {
      const modes = await listEventTypeModes(profile.orgId, et.id)
      return [et.id, modes.length] as const
    })
  )
  const modeCountById = new Map(modeCounts)

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <LinkButton href={`${base}/event-types/new`}>
            <PlusIcon aria-hidden />
            {t("create")}
          </LinkButton>
        }
        className="mb-0"
      />

      {eventTypes.length === 0 ? (
        <EmptyState
          icon={<ListChecksIcon />}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <LinkButton href={`${base}/event-types/new`}>
              {t("createFirst")}
            </LinkButton>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card shadow-1">
          {eventTypes.map((et) => {
            const etTitle = et.title as LocalizedText
            const modeCount = modeCountById.get(et.id) ?? 0
            return (
              <li
                key={et.id}
                data-testid={`event-type-card-${et.slug}`}
                className="relative flex items-start gap-4 p-5 transition-colors focus-within:bg-sand-50/70 hover:bg-sand-50/70 sm:px-6 dark:focus-within:bg-muted/40 dark:hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg leading-snug font-medium">
                      <Link
                        href={`${base}/event-types/${et.id}`}
                        className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                      >
                        {etTitle[locale as keyof typeof etTitle] ?? etTitle.en}
                      </Link>
                    </h2>
                    <StatusPill tone={et.published ? "positive" : "neutral"}>
                      {et.published ? t("status.published") : t("status.draft")}
                    </StatusPill>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    /{profile.username}/{et.slug}
                  </p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{et.durationMinutes} min</span>
                    <span className="font-medium text-foreground tabular-nums">
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
                  </p>
                </div>
                <div className="relative z-10 shrink-0">
                  <EventTypeActions
                    eventTypeId={et.id}
                    published={et.published}
                    workspaceBase={base}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
