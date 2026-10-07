import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"

export default async function AcademyHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const t = await getTranslations("academy")

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="text-sm text-muted-foreground">
        {t("comingSoon", { orgSlug })}
      </p>
    </>
  )
}
