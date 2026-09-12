import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { financeSummary, listFinanceBookings } from "@eleva/billing/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { expertWorkspacePath } from "@/lib/workspace-paths"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
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

  if (!profile.stripeAccountId) {
    redirect(expertWorkspacePath(session, "setup"))
  }

  const [t, summary, bookings] = await Promise.all([
    getTranslations("finance"),
    financeSummary(session.orgId),
    listFinanceBookings(session.orgId),
  ])

  return (
    <div className="space-y-6">
      <AccountPageHeader title={t("title")} description={t("description")} />
      <FinanceDashboard
        orgSlug={orgSlug}
        summary={summary}
        bookings={bookings}
      />
    </div>
  )
}
