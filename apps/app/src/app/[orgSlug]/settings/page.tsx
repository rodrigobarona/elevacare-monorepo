import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
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
    <AccountPageHeader
      title={t("settings.title")}
      description={t("settings.subtitle")}
    />
  )
}
