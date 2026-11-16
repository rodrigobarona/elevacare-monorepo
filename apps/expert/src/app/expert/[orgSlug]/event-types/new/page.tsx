import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@eleva/icons"
import { PageHeader } from "@eleva/ui/components/page-header"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { EventTypeForm } from "../event-type-form"

export const dynamic = "force-dynamic"

export default async function NewEventTypePage({
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

  const t = await getTranslations("eventTypes")

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-4">
        <Link
          href={`${base}/event-types`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          {t("backToServices")}
        </Link>
        <PageHeader
          eyebrow={t("title")}
          title={t("createTitle")}
          description={t("createDescription")}
        />
      </div>
      <EventTypeForm
        mode="create"
        workspaceBase={base}
        publicPrefix={`eleva.care/${profile.username}/`}
      />
    </div>
  )
}
