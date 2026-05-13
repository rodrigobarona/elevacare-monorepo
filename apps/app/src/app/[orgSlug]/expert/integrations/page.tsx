import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { getExpertProfileByUserId, listExpertIntegrations } from "@eleva/db"
import {
  listByCategory,
  listCategories,
  type IntegrationManifest,
} from "@eleva/integrations"
import { AppShell } from "@/components/app-shell"
import { IntegrationCard } from "./integration-card"

export const dynamic = "force-dynamic"

const CATEGORY_LABEL: Record<string, string> = {
  calendar: "Calendars",
  invoicing: "Invoicing",
  crm: "CRM",
  video: "Video",
  other: "Other",
}

export default async function IntegrationsPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("events:manage")) redirect("/")

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect("/expert/onboarding")

  const connected = await listExpertIntegrations(profile.orgId, profile.id)
  const connectedBySlug = new Map(connected.map((c) => [c.slug, c]))

  const categories = listCategories()
  const t = await getTranslations("integrations")

  return (
    <AppShell session={session}>
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-medium">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </header>

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
                    />
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </AppShell>
  )
}
