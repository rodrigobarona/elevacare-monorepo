import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { env } from "@eleva/config/env"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { loadFinanceOverview } from "@/lib/finance-overview"
import { FinanceConnectPrompt } from "./finance-connect-prompt"
import { FinanceDashboard } from "./finance-dashboard"

export const dynamic = "force-dynamic"

export default async function FinancePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { session, profile } = await loadExpertWorkspace(
    orgSlug,
    "payouts:view_own"
  )
  const t = await getTranslations("finance")

  const stripeConfigured = Boolean(env().STRIPE_PUBLISHABLE_KEY)
  const invoicingSettings = session.capabilities.includes(
    "expert:invoicing_manage"
  ) ? (
    <LinkButton
      href={expertWorkspacePath(session, "finance/invoicing")}
      variant="outline"
      size="sm"
    >
      {t("invoicing.link")}
    </LinkButton>
  ) : null

  if (!profile.stripeAccountId) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          actions={invoicingSettings}
        />
        {stripeConfigured ? (
          <FinanceConnectPrompt
            apiBaseUrl={
              process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
            }
          />
        ) : (
          <EmptyState
            variant="error"
            title={t("connect.unavailableTitle")}
            description={t("connect.unavailable")}
          />
        )}
      </div>
    )
  }

  // Same scope as the API: a clinic clinician sees only their own bookings.
  const overview = await loadFinanceOverview(session)
  if (!overview) notFound()

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={invoicingSettings}
      />
      <FinanceDashboard
        orgSlug={orgSlug}
        invoicesHref={
          session.capabilities.includes("expert:invoicing_manage")
            ? expertWorkspacePath(session, "finance/invoices")
            : null
        }
        summary={overview.summary}
        bookings={overview.bookings}
        showStripePanels={stripeConfigured}
      />
    </div>
  )
}
