import { getTranslations } from "next-intl/server"
import { env } from "@eleva/config/env"
import { financeSummary, listFinanceBookings } from "@eleva/billing/server"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
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

  const [summary, bookings] = await Promise.all([
    financeSummary(session.orgId),
    listFinanceBookings(session.orgId),
  ])

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
        summary={summary}
        bookings={bookings}
        showStripePanels={stripeConfigured}
      />
    </div>
  )
}
