import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"
import { AppShell } from "@/components/app-shell"

export default async function AdminDashboardPage() {
  const session = await getSession()
  if (!session) redirect("/signin")
  if (!session.capabilities.includes("audit:view_all")) {
    redirect("/")
  }
  const t = await getTranslations()
  return (
    <AppShell session={session}>
      <header className="space-y-2">
        <h1 className="text-2xl font-medium">{t("dashboard.admin.welcome")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.admin.subtitle")}
        </p>
      </header>
    </AppShell>
  )
}
