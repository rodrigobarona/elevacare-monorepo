import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"

export const dynamic = "force-dynamic"

export default async function ExpertDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session } = await loadExpertWorkspace(orgSlug, "events:manage")

  const t = await getTranslations()
  return (
    <PageHeader
      title={t("dashboard.expert.welcome", {
        name: session.user.displayName ?? session.user.email,
      })}
      description={t("dashboard.expert.subtitle")}
    />
  )
}
