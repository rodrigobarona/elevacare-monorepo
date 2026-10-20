import { getTranslations } from "next-intl/server"
import { redirectToGatewayLogin } from "@eleva/auth/guards"
import { getUserOrganizations } from "@eleva/auth/server"
import { resolveOrgHomeUrl } from "@eleva/dashboard/resolve-org-home-url"
import { LinkButton } from "@eleva/ui/components/button"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { WorkspaceList, type WorkspaceRow } from "./workspace-list"

export const dynamic = "force-dynamic"

export default async function OrganizationsPage() {
  const [t, organizations] = await Promise.all([
    getTranslations("organizations"),
    getUserOrganizations(),
  ])
  if (!organizations) redirectToGatewayLogin()

  const rows: WorkspaceRow[] = [...organizations]
    .map((org) => ({
      orgId: org.orgId,
      orgSlug: org.orgSlug,
      orgType: org.orgType,
      name: org.name,
      membershipRole: org.membershipRole,
      isCurrent: org.isCurrent,
      homeUrl: resolveOrgHomeUrl({
        orgSlug: org.orgSlug,
        productLabel: org.productLabel,
        orgType: org.orgType,
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const spaces = rows.filter((row) => row.orgType === "personal")
  const workspaces = rows.filter((row) => row.orgType !== "personal")

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <LinkButton href="/account/workspaces/new" size="sm">
            {t("createWorkspace")}
          </LinkButton>
        }
      />
      {spaces.length > 0 ? (
        <Section title={t("spaceTitle")} description={t("spaceHint")}>
          <WorkspaceList rows={spaces} />
        </Section>
      ) : null}
      <Section title={t("workTitle")} description={t("workHint")}>
        {workspaces.length > 0 ? (
          <WorkspaceList rows={workspaces} />
        ) : (
          <div className="rounded-3xl border border-dashed p-8 text-center">
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("emptyBody")}
            </p>
            <LinkButton
              href="/account/workspaces/new"
              variant="outline"
              size="sm"
              className="mt-4"
            >
              {t("createWorkspace")}
            </LinkButton>
          </div>
        )}
      </Section>
    </div>
  )
}
