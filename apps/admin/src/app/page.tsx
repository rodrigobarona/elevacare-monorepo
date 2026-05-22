import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { AccountPageHeader } from "@eleva/dashboard"

export default async function AdminDashboardPage() {
  const session = await getSession()
  const t = await getTranslations()

  return (
    <>
      <AccountPageHeader
        title={t("dashboard.welcome")}
        description={t("dashboard.subtitle")}
      />
      <p className="text-sm text-muted-foreground">
        Signed in as {session?.user.email}
      </p>
    </>
  )
}
