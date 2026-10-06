import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { PageHeader } from "@eleva/ui/components/page-header"

export default async function AdminDashboardPage() {
  const session = await getSession()
  const t = await getTranslations()

  return (
    <>
      <PageHeader
        title={t("dashboard.welcome")}
        description={t("dashboard.subtitle")}
      />
      <p className="text-sm text-muted-foreground">
        {t("dashboard.signedInAs", { email: session?.user.email ?? "" })}
      </p>
    </>
  )
}
