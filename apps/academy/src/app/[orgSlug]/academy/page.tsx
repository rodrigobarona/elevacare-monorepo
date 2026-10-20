import { getTranslations } from "next-intl/server"
import { GraduationCapIcon } from "@eleva/icons"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { PageHeader } from "@eleva/ui/components/page-header"

export default async function AcademyHomePage() {
  const t = await getTranslations("academy")

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("subtitle")}
      />
      <EmptyState
        icon={<GraduationCapIcon />}
        title={t("courses.empty")}
        description={t("comingSoon")}
      />
    </div>
  )
}
