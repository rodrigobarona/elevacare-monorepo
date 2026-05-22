import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { listExpertIntegrations } from "@eleva/db"
import { listByCategory, listCategories } from "@eleva/integrations"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { IntegrationCard } from "./integration-card"

export const dynamic = "force-dynamic"

const CATEGORY_LABEL: Record<string, string> = {
  calendar: "Calendars",
  invoicing: "Invoicing",
  crm: "CRM",
  video: "Video",
  other: "Other",
}

export default async function IntegrationsPage({
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

  const connected = await listExpertIntegrations(profile.orgId, profile.id)
  const connectedBySlug = new Map(connected.map((c) => [c.slug, c]))

  const categories = listCategories()
  const t = await getTranslations("integrations")

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AccountPageHeader title={t("title")} description={t("description")} />

      {categories.map((category) => {
        const manifests = listByCategory(category)
        if (manifests.length === 0) return null

        return (
          <section key={category} className="space-y-4">
            <h2 className="text-lg font-medium">
              {t(`category.${category}`, {
                defaultMessage: CATEGORY_LABEL[category] ?? category,
              })}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {manifests.map((manifest) => {
                const connection = connectedBySlug.get(manifest.slug)
                return (
                  <IntegrationCard
                    key={manifest.slug}
                    manifest={manifest}
                    status={connection?.status ?? null}
                    integrationId={connection?.id ?? null}
                    workspaceBase={base}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
