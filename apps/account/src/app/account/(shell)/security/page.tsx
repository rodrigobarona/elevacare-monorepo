import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { SecurityPanel } from "./security-panel"

export default async function SecurityPage() {
  const t = await getTranslations("security")

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SecurityPanel />
    </div>
  )
}
