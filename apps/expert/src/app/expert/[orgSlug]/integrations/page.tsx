import { getTranslations } from "next-intl/server"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { listExpertIntegrations } from "@eleva/db"
import { getFlag } from "@eleva/flags"
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

  const [connected, t, invoicingApps, toconline] = await Promise.all([
    listExpertIntegrations(profile.orgId, profile.id),
    getTranslations("integrations"),
    getFlag("ff.expert_invoicing_apps_enabled"),
    getFlag("ff.invoicing.toconline"),
  ])
  // Only what an expert can use today is listed. Issuing her own invoices
  // always is; an invoicing app is listed once it can be linked.
  const usableInvoicing = new Set(
    invoicingApps && toconline ? ["manual", "toconline"] : ["manual"]
  )
  const connectedBySlug = new Map(connected.map((c) => [c.slug, c]))

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader title={t("title")} description={t("description")} />

      {listCategories().map((category) => {
        const manifests = listByCategory(category).filter(
          (manifest) =>
            manifest.category !== "invoicing" ||
            usableInvoicing.has(manifest.slug)
        )
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
