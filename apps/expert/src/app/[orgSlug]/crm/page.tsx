import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { CrmBoard } from "./crm-board"

export const dynamic = "force-dynamic"

export default async function ExpertCrmPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session } = await loadExpertWorkspace(orgSlug, "events:manage")
  const t = await getTranslations("crm")
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <CrmBoard
        apiBaseUrl={apiBaseUrl}
        membersPath={expertWorkspacePath(session, "members")}
      />
    </div>
  )
}
