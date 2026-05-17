import { getTranslations } from "next-intl/server"
import { getSessionForOrg } from "@eleva/auth/server"

export default async function TeamDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const session = await getSessionForOrg(orgSlug)
  const t = await getTranslations()

  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-medium">
        {t("dashboard.welcome", {
          name: session?.user.displayName ?? "",
        })}
      </h1>
      <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
    </header>
  )
}
