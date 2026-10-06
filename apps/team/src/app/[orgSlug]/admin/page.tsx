import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { getSessionForOrg } from "@eleva/auth/server"

export default async function TeamAdminDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)
  const t = await getTranslations()

  return (
    <PageHeader
      title={t("dashboard.welcome", {
        name: session?.user.displayName ?? "",
      })}
      description={t("dashboard.subtitle")}
    />
  )
}
