import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { env } from "@eleva/config/env"
import { getFlag } from "@eleva/flags"
import { getConnectOnboardingState } from "@eleva/billing/server"
import { LinkButton } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { loadFinanceOverview } from "@/lib/finance-overview"
import { FinanceConnectPrompt } from "./finance-connect-prompt"
import { FinanceDashboard } from "./finance-dashboard"
import { FinanceFinishSetup } from "./finance-finish-setup"

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
  const [t, invoicesTracked] = await Promise.all([
    getTranslations("finance"),
    // Member invoices lists rows only while Eleva tracks them.
    getFlag("ff.expert_invoicing_apps_enabled"),
  ])

  const stripePublishableKey = env().STRIPE_PUBLISHABLE_KEY ?? ""
  const stripeConfigured = Boolean(stripePublishableKey)
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
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
          title={t("title")}
          description={t("description")}
          actions={invoicingSettings}
        />
        {stripeConfigured ? (
          <FinanceConnectPrompt apiBaseUrl={apiBaseUrl} />
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
  const [overview, connectState] = await Promise.all([
    loadFinanceOverview(session),
    getConnectOnboardingState(session.orgId),
  ])
  if (!overview) notFound()

  // The account exists but Stripe still needs the expert's details (they
  // skipped the setup step): offer onboarding here, and hold back the
  // balance/payout panels, which have nothing to show until then. Only
  // trust the org's billing row when it mirrors this expert's account.
  const needsStripeDetails =
    stripeConfigured &&
    connectState?.stripeConnectAccountId === profile.stripeAccountId &&
    !connectState.detailsSubmitted

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={invoicingSettings}
      />
      {needsStripeDetails ? (
        <FinanceFinishSetup
          apiBaseUrl={apiBaseUrl}
          stripePublishableKey={stripePublishableKey}
        />
      ) : null}
      <FinanceDashboard
        orgSlug={orgSlug}
        invoicesHref={
          invoicesTracked &&
          session.capabilities.includes("expert:invoicing_manage")
            ? expertWorkspacePath(session, "finance/invoices")
            : null
        }
        summary={overview.summary}
        bookings={overview.bookings}
        showStripePanels={stripeConfigured && !needsStripeDetails}
      />
    </div>
  )
}
