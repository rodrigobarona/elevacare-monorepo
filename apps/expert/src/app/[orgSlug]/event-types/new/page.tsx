import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
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
  const { session } = await loadExpertWorkspace(orgSlug, "events:manage")
  const base = expertWorkspaceBase(session)

  const t = await getTranslations("eventTypes")

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AccountPageHeader
        title={t("createTitle")}
        description={t("createDescription")}
      />
      <EventTypeForm mode="create" workspaceBase={base} />
    </div>
  )
}
