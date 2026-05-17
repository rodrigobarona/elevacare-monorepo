import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
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
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <FinanceDashboard />
    </div>
  )
}
