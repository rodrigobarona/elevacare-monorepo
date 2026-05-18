import { getTranslations } from "next-intl/server"
import { guardSessionForOrg } from "@eleva/auth"

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  await guardSessionForOrg(orgSlug)

  const t = await getTranslations()

  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-medium">{t("settings.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
    </header>
  )
}
