import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"

export default async function AdminDashboardPage() {
  const session = await getSession()
  const t = await getTranslations()

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">{t("dashboard.welcome")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">
        Signed in as {session?.user.email}
      </p>
    </div>
  )
}
