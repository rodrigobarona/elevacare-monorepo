import { getTranslations } from "next-intl/server"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { listExpertIntegrations } from "@eleva/db"
import { listByCategory, listCategories } from "@eleva/integrations"
import { expertWorkspaceBase } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { IntegrationCard } from "./integration-card"

export const dynamic = "force-dynamic"

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

  const [connected, t] = await Promise.all([
    listExpertIntegrations(profile.orgId, profile.id),
    getTranslations("integrations"),
  ])
  const connectedBySlug = new Map(connected.map((c) => [c.slug, c]))

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      {listCategories().map((category) => {
        const manifests = listByCategory(category)
        if (manifests.length === 0) return null

        return (
          <Section
            key={category}
            title={t(`category.${category}.title`)}
            description={t(`category.${category}.hint`)}
          >
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {manifests.map((manifest) => (
                <IntegrationCard
                  key={manifest.slug}
                  manifest={manifest}
                  status={connectedBySlug.get(manifest.slug)?.status ?? null}
                  workspaceBase={base}
                />
              ))}
            </ul>
          </Section>
        )
      })}
    </div>
  )
}
