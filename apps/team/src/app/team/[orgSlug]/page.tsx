import { getTranslations } from "next-intl/server"
import { resolveTeamWorkspaceBase } from "@eleva/auth/org-routing"
import { UsersIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"

export default async function TeamAdminDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const t = await getTranslations("dashboard")

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <EmptyState
        icon={<UsersIcon />}
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={
          <LinkButton
            href={`${resolveTeamWorkspaceBase(orgSlug)}/notifications`}
            variant="outline"
            size="sm"
          >
            {t("openInbox")}
          </LinkButton>
        }
      />
    </div>
  )
}
