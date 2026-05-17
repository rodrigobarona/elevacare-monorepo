import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { guardSession } from "@eleva/auth"
import { getExpertProfileByUserId } from "@eleva/db"

export const dynamic = "force-dynamic"

export default async function ExpertDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await guardSession()
  if (!session.capabilities.includes("events:manage")) {
    redirect(`/${orgSlug}`)
  }

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile || profile.status === "draft" || profile.status === "approved") {
    redirect(`/${orgSlug}/expert/onboarding`)
  }

  const t = await getTranslations()
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-medium">
        {t("dashboard.expert.welcome", {
          name: session.user.displayName ?? session.user.email,
        })}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("dashboard.expert.subtitle")}
      </p>
    </header>
  )
}
