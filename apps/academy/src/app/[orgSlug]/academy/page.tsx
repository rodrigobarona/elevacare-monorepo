import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"

export default async function AcademyHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const t = await getTranslations("academy")

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("subtitle")} />
      <p className="text-sm text-muted-foreground">
        {t("comingSoon", { orgSlug })}
      </p>
    </>
  )
}
