import { getTranslations } from "next-intl/server"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"

export default async function AcademyHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const t = await getTranslations("academy")

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <EmptyState
        title={t("courses.empty")}
        description={t("comingSoon", { orgSlug })}
      />
    </div>
  )
}
