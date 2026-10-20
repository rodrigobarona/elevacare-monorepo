import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeftIcon } from "@eleva/icons"
import { listExpertIntegrations } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import { PageHeader, Section } from "@eleva/ui/components/page-header"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { InvoicingSettings } from "./invoicing-settings"

export const dynamic = "force-dynamic"

export default async function InvoicingSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{
    invoicing_error?: string
    invoicing_connected?: string
  }>
}) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams])
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "expert:invoicing_manage"
  )

  const [t, integrations, expertInvoicingEnabled, toconlineInvoicingEnabled] =
    await Promise.all([
      getTranslations("finance.invoicing"),
      listExpertIntegrations(profile.orgId, profile.id, "invoicing"),
      getFlag("ff.expert_invoicing_apps_enabled"),
      getFlag("ff.invoicing.toconline"),
    ])

  const integration = profile.invoicingProvider
    ? (integrations.find((row) => row.slug === profile.invoicingProvider) ??
      null)
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-4">
        <Link
          href={expertWorkspacePath(session, "finance")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          {t("backToFinance")}
        </Link>
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />
      </div>
      <Section title={t("currentTitle")} description={t("currentHint")}>
        <InvoicingSettings
          provider={profile.invoicingProvider}
          setupStatus={profile.invoicingSetupStatus}
          connectionStatus={integration?.status ?? null}
          connectedAt={integration?.connectedAt?.toISOString() ?? null}
          invoicingError={query.invoicing_error}
          justConnected={query.invoicing_connected === "true"}
          toconlineEnabled={Boolean(
            expertInvoicingEnabled && toconlineInvoicingEnabled
          )}
        />
      </Section>
    </div>
  )
}
