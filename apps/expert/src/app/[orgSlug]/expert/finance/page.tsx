import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { guardSession } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"
import { FinanceDashboard } from "./finance-dashboard"

export const dynamic = "force-dynamic"

export default async function FinancePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSession()
  if (!session.capabilities.includes("payouts:view_own"))
    redirect(`/${orgSlug}`)

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) redirect(`/${orgSlug}`)
  if (!profile.stripeAccountId) {
    redirect(`/${orgSlug}/expert/onboarding`)
  }

  const t = await getTranslations("finance")

  return (
    <div className="space-y-6">
      <AccountPageHeader title={t("title")} description={t("description")} />
      <FinanceDashboard />
    </div>
  )
}
